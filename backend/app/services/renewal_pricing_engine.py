"""
Dynamic Pricing Optimisation Engine (Part 3)

Simulates rent increase scenarios from 0% → 15% in 1% steps,
computes expected revenue for each, and returns the top-N optimal strategies.
Persists all scenarios to renewal_scenarios table.
"""
from __future__ import annotations

import logging
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.renewal_config import RENEWAL_CONFIG
from app.services.renewal_prediction_service import score_lease

log = logging.getLogger(__name__)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Revenue Formula ──────────────────────────────────────────────────────────

def _compute_turnover_cost(current_rent: float) -> float:
    cfg = RENEWAL_CONFIG
    return cfg.turnover_cost_fixed + (current_rent * cfg.turnover_cost_letting_fee_multiplier)


def _apply_elasticity(
    base_renewal_prob: float,
    increase_pct: float,
    market_delta_pct: float,
) -> float:
    """
    Adjust renewal probability for a given rent increase.
    Tenants below market tolerate more increases (lower effective elasticity).
    Tenants above market are more resistant (higher effective elasticity).

    market_delta_pct: (market_rent - current_rent) / current_rent
      positive → tenant is below market → more tolerant
      negative → tenant is above market → less tolerant
    """
    cfg = RENEWAL_CONFIG
    # Elasticity modifier: being 10% below market halves the elasticity
    elasticity = cfg.base_elasticity * (1.0 - market_delta_pct)
    elasticity = max(0.01, elasticity)  # always some sensitivity

    adjusted = base_renewal_prob - (elasticity * increase_pct)
    return max(0.0, min(1.0, adjusted))


def _expected_revenue(
    new_rent: float,
    renewal_probability: float,
    market_rent: float,
    turnover_cost: float,
) -> float:
    """
    Expected revenue = (P(renew) × new_rent × 12)
                     + (P(churn) × ((market_rent × (12 - vacancy_months)) - turnover_cost))

    If churn: assume unit re-lets at market rent after vacancy period.
    """
    cfg = RENEWAL_CONFIG
    churn_prob = 1.0 - renewal_probability
    renewal_revenue = renewal_probability * new_rent * 12
    churn_revenue = churn_prob * (
        market_rent * (12 - cfg.avg_vacancy_months) - turnover_cost
    )
    return renewal_revenue + churn_revenue


def _risk_label(churn_probability: float) -> str:
    if churn_probability < 0.30:
        return "low"
    if churn_probability < 0.60:
        return "moderate"
    return "high"


# ── Simulation ───────────────────────────────────────────────────────────────

def simulate_scenarios(
    base_renewal_prob: float,
    current_rent: float,
    market_rent: float,
    lease_id: str,
    score_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Run full pricing simulation. Returns list of scenario dicts, sorted by expected_value desc.
    """
    cfg = RENEWAL_CONFIG
    market_delta_pct = (market_rent - current_rent) / max(current_rent, 1.0)
    turnover_cost = _compute_turnover_cost(current_rent)

    scenarios: list[dict[str, Any]] = []

    increase = cfg.min_increase_pct
    while increase <= cfg.max_increase_pct + 1e-9:
        new_rent = current_rent * (1 + increase / 100.0)
        adj_renewal_prob = _apply_elasticity(base_renewal_prob, increase, market_delta_pct)
        adj_churn_prob = 1.0 - adj_renewal_prob
        ev = _expected_revenue(new_rent, adj_renewal_prob, market_rent, turnover_cost)

        scenarios.append({
            "lease_id":                     lease_id,
            "renewal_score_id":             score_id,
            "increase_pct":                 round(increase, 1),
            "projected_renewal_probability": round(adj_renewal_prob, 4),
            "projected_revenue_12m":        round(ev, 2),
            "projected_revenue_24m":        round(ev * 2, 2),
            "vacancy_risk":                 round(adj_churn_prob * cfg.avg_vacancy_months / 12.0, 4),
            "turnover_cost_estimate":       round(turnover_cost * adj_churn_prob, 2),
            "expected_value":               round(ev, 2),
            "risk_label":                   _risk_label(adj_churn_prob),
            "is_recommended":               False,
        })

        increase += cfg.increase_step

    # Mark top-1 by expected value as recommended
    best = max(scenarios, key=lambda s: s["expected_value"])
    best["is_recommended"] = True

    return scenarios


# ── Main Entry Point ─────────────────────────────────────────────────────────

async def run_pricing_simulation(
    lease_id: str,
    market_rent: float | None = None,
) -> dict[str, Any]:
    """
    Score the lease, simulate all price scenarios, persist to DB, return dashboard payload.
    """
    sb = _sb()
    log.info("[PricingEngine] Running simulation for lease %s", lease_id)

    # Score first (or re-use latest)
    score = await score_lease(lease_id, market_rent=market_rent)

    scenarios = simulate_scenarios(
        base_renewal_prob=score["renewal_probability"],
        current_rent=score["current_rent"],
        market_rent=score["market_rent"],
        lease_id=lease_id,
        score_id=score.get("score_id"),
    )

    # Clear old scenarios for this lease before inserting fresh ones
    sb.table("renewal_scenarios").delete().eq("lease_id", lease_id).execute()
    sb.table("renewal_scenarios").insert(scenarios).execute()

    # Find the optimal and top-N
    cfg = RENEWAL_CONFIG
    sorted_scenarios = sorted(scenarios, key=lambda s: s["expected_value"], reverse=True)
    recommended = next(s for s in scenarios if s["is_recommended"])
    top_n = sorted_scenarios[: cfg.top_n_scenarios]

    # Update the score row with the recommended increase
    if score.get("score_id"):
        sb.table("renewal_scores").update({
            "recommended_increase_pct": recommended["increase_pct"],
        }).eq("id", score["score_id"]).execute()

    # Compute worst / best case for dashboard
    worst = min(scenarios, key=lambda s: s["expected_value"])
    no_increase = next((s for s in scenarios if s["increase_pct"] == 0.0), scenarios[0])
    revenue_delta_vs_no_increase = recommended["projected_revenue_12m"] - no_increase["projected_revenue_12m"]

    # Vacancy breakeven: months until vacancy cost is recouped from extra rent
    extra_monthly = (recommended["increase_pct"] / 100.0) * score["current_rent"]
    turnover_cost = _compute_turnover_cost(score["current_rent"])
    vacancy_breakeven_months = (
        round(turnover_cost / extra_monthly, 1)
        if extra_monthly > 0
        else None
    )

    log.info(
        "[PricingEngine] Lease %s → optimal_increase=%.1f%% ev=%.2f",
        lease_id, recommended["increase_pct"], recommended["expected_value"],
    )

    return {
        "lease_id":                 lease_id,
        "score":                    score,
        "recommended_scenario":     recommended,
        "top_scenarios":            top_n,
        "all_scenarios":            scenarios,
        "worst_case":               worst,
        "revenue_delta_vs_no_increase": round(revenue_delta_vs_no_increase, 2),
        "vacancy_breakeven_months": vacancy_breakeven_months,
        "turnover_cost_estimate":   round(turnover_cost, 2),
    }
