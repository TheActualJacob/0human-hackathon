"""
Renewal Probability Engine (Part 2)

Computes a data-driven renewal probability for a given lease using a
weighted scoring model. Designed so the model can be swapped for an ML
classifier later — callers only interact with `score_lease()`.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.renewal_config import RENEWAL_CONFIG

log = logging.getLogger(__name__)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ── Feature Extractors ───────────────────────────────────────────────────────

def _payment_history_score(payments: list[dict]) -> float:
    """Returns 0–1. 1 = always on time, 0 = never."""
    if not payments:
        return 0.5  # no history → neutral
    on_time = sum(1 for p in payments if p.get("status") == "paid" and not _is_late(p))
    return on_time / len(payments)


def _is_late(payment: dict) -> bool:
    paid_at = payment.get("paid_at") or payment.get("updated_at")
    due = payment.get("due_date")
    if not paid_at or not due:
        return False
    try:
        return date.fromisoformat(paid_at[:10]) > date.fromisoformat(due[:10])
    except ValueError:
        return False


def _avg_days_late_score(payments: list[dict]) -> float:
    """Returns 0–1. 1 = never late, 0 = chronically late (≥30 days avg)."""
    late_payments = [p for p in payments if _is_late(p)]
    if not late_payments:
        return 1.0
    delays: list[int] = []
    for p in late_payments:
        try:
            paid = date.fromisoformat((p.get("paid_at") or p.get("updated_at", ""))[:10])
            due = date.fromisoformat(p["due_date"][:10])
            delays.append(max(0, (paid - due).days))
        except (ValueError, KeyError):
            delays.append(7)
    avg_delay = sum(delays) / len(delays)
    # 0 days late → 1.0, 30+ days late → 0.0
    return max(0.0, 1.0 - avg_delay / 30.0)


def _maintenance_frequency_score(requests: list[dict], lease_months: float) -> float:
    """Returns 0–1. Fewer complaints relative to tenancy length → higher score."""
    if lease_months <= 0:
        return 0.5
    monthly_rate = len(requests) / lease_months
    # ≤0.5 requests/month → 1.0; ≥3/month → 0.0
    return max(0.0, 1.0 - monthly_rate / 3.0)


def _lease_duration_score(lease_months: float) -> float:
    """Longer tenure → stickier tenant. Caps at 36 months."""
    return min(1.0, lease_months / 36.0)


def _market_delta_score(current_rent: float, market_rent: float) -> float:
    """
    Returns 0–1.
    If tenant is significantly below market → less likely to leave (score → 1).
    If tenant is significantly above market → more likely to churn (score → 0).
    ±15% band maps to 0–1 linearly.
    """
    if market_rent <= 0:
        return 0.5
    delta_pct = (market_rent - current_rent) / market_rent  # positive = tenant below market
    # Clamp to ±0.15 then normalise to 0–1
    clamped = max(-0.15, min(0.15, delta_pct))
    return (clamped + 0.15) / 0.30


# ── Core Scoring ─────────────────────────────────────────────────────────────

def compute_renewal_probability(
    payments: list[dict],
    maintenance_requests: list[dict],
    lease_months: float,
    current_rent: float,
    market_rent: float,
) -> dict[str, Any]:
    """
    Weighted scoring model. Returns a probability dict.
    Swap this function body for an ML model call without changing callers.
    """
    cfg = RENEWAL_CONFIG

    scores = {
        "payment_history":      _payment_history_score(payments),
        "days_late_avg":        _avg_days_late_score(payments),
        "maintenance_freq":     _maintenance_frequency_score(maintenance_requests, lease_months),
        "lease_duration":       _lease_duration_score(lease_months),
        "market_delta":         _market_delta_score(current_rent, market_rent),
    }

    weights = {
        "payment_history":  cfg.weight_payment_history,
        "days_late_avg":    cfg.weight_days_late_avg,
        "maintenance_freq": cfg.weight_maintenance_freq,
        "lease_duration":   cfg.weight_lease_duration,
        "market_delta":     cfg.weight_market_delta,
    }

    weighted_sum = sum(scores[k] * weights[k] for k in scores)
    renewal_probability = max(0.0, min(1.0, weighted_sum))
    churn_probability = 1.0 - renewal_probability

    # Confidence: how many data points we have
    data_richness = min(1.0, len(payments) / 12.0)
    confidence_score = 0.4 + 0.6 * data_richness  # 0.4 floor, climbs with data

    return {
        "renewal_probability":  round(renewal_probability, 4),
        "churn_probability":    round(churn_probability, 4),
        "confidence_score":     round(confidence_score, 4),
        "feature_scores":       scores,
        "weights":              weights,
    }


# ── Main Entry Point ─────────────────────────────────────────────────────────

async def score_lease(lease_id: str, market_rent: float | None = None) -> dict[str, Any]:
    """
    Fetch all required data for a lease and compute renewal score.
    Persists result to renewal_scores table.
    Returns the full score dict.
    """
    sb = _sb()
    log.info("[RenewalPrediction] Scoring lease %s", lease_id)

    # ── Fetch lease + related data ────────────────────────────────────────────
    lease_res = sb.table("leases").select("*").eq("id", lease_id).single().execute()
    if not lease_res.data:
        raise ValueError(f"Lease {lease_id} not found")
    lease = lease_res.data

    payments_res = (
        sb.table("payments")
        .select("*")
        .eq("lease_id", lease_id)
        .order("due_date", desc=False)
        .execute()
    )
    payments = payments_res.data or []

    maint_res = (
        sb.table("maintenance_requests")
        .select("id, created_at")
        .eq("lease_id", lease_id)
        .execute()
    )
    maintenance_requests = maint_res.data or []

    # ── Compute tenancy length ────────────────────────────────────────────────
    try:
        start = date.fromisoformat(lease["start_date"][:10])
        today = date.today()
        lease_months = max(1.0, (today - start).days / 30.44)
    except (KeyError, ValueError):
        lease_months = 12.0

    current_rent = float(lease.get("monthly_rent") or 0)
    if market_rent is None:
        market_rent = current_rent * 1.05  # fallback: assume 5% above current

    # ── Score ─────────────────────────────────────────────────────────────────
    result = compute_renewal_probability(
        payments=payments,
        maintenance_requests=maintenance_requests,
        lease_months=lease_months,
        current_rent=current_rent,
        market_rent=market_rent,
    )

    input_snapshot = {
        "payment_count":        len(payments),
        "maintenance_count":    len(maintenance_requests),
        "lease_months":         round(lease_months, 1),
        "current_rent":         current_rent,
        "market_rent":          market_rent,
        "feature_scores":       result["feature_scores"],
    }

    # ── Persist ───────────────────────────────────────────────────────────────
    row = {
        "lease_id":                 lease_id,
        "renewal_probability":      result["renewal_probability"],
        "churn_probability":        result["churn_probability"],
        "confidence_score":         result["confidence_score"],
        "recommended_increase_pct": 0.0,  # filled in after pricing engine runs
        "projected_revenue_12m":    current_rent * 12 * result["renewal_probability"],
        "projected_revenue_24m":    current_rent * 24 * result["renewal_probability"],
        "input_snapshot":           input_snapshot,
        "model_version":            RENEWAL_CONFIG.model_version,
    }
    score_res = sb.table("renewal_scores").insert(row).execute()
    score_id = score_res.data[0]["id"] if score_res.data else None

    log.info(
        "[RenewalPrediction] Lease %s → renewal_prob=%.2f churn=%.2f confidence=%.2f",
        lease_id, result["renewal_probability"], result["churn_probability"], result["confidence_score"],
    )

    return {
        **result,
        "score_id":         score_id,
        "lease_id":         lease_id,
        "current_rent":     current_rent,
        "market_rent":      market_rent,
        "lease_months":     lease_months,
        "input_snapshot":   input_snapshot,
    }
