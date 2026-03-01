"""
Renewal Engine Configuration
All tunable constants live here — no magic numbers in service logic.
Replace with DB-backed config or env vars for per-landlord customisation.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass(frozen=True)
class RenewalEngineConfig:
    # ── Vacancy & Turnover Cost Assumptions ──────────────────────────────────
    # Average months a unit sits empty between tenants
    avg_vacancy_months: float = 1.5
    # Fixed one-time costs when tenant churns (cleaning, repairs, admin)
    turnover_cost_fixed: float = 1_500.0
    # Re-letting fee as a multiple of monthly rent (e.g. 0.5 = half a month)
    turnover_cost_letting_fee_multiplier: float = 0.5

    # ── Probability Model Weights (must sum to 1.0) ──────────────────────────
    weight_payment_history: float = 0.30      # on-time payment ratio
    weight_maintenance_freq: float = 0.15     # complaints volume (inverse)
    weight_lease_duration: float = 0.15       # longer tenure → stickier
    weight_market_delta: float = 0.25         # how far below/above market
    weight_days_late_avg: float = 0.15        # average days late on payments

    # ── Elasticity Curve ─────────────────────────────────────────────────────
    # Base probability drop per 1% rent increase, at market parity.
    # Adjust per region; negative market_delta (tenant below market) reduces elasticity.
    base_elasticity: float = 0.035

    # ── Renewal Probability Thresholds ───────────────────────────────────────
    high_probability_threshold: float = 0.70   # use growth strategy
    low_probability_threshold: float = 0.40    # use conservative strategy
    min_confidence_to_auto_send: float = 0.65  # below this, require landlord sign-off

    # ── Pricing Simulation Range ─────────────────────────────────────────────
    min_increase_pct: float = 0.0
    max_increase_pct: float = 15.0
    increase_step: float = 1.0
    top_n_scenarios: int = 3   # how many scenarios to surface on the dashboard

    # ── Workflow Timing ───────────────────────────────────────────────────────
    first_contact_days_before_expiry: int = 90
    followup_days_no_response: int = 7
    auto_list_days_no_response: int = 14

    # ── AI ────────────────────────────────────────────────────────────────────
    claude_model: str = "claude-3-5-sonnet-20241022"
    claude_max_tokens_offer: int = 1_500
    claude_max_tokens_negotiation: int = 800
    claude_temperature: float = 0.4

    # ── Scoring Model Version ─────────────────────────────────────────────────
    model_version: str = "weighted-v1"


# Singleton used across all services
RENEWAL_CONFIG = RenewalEngineConfig()
