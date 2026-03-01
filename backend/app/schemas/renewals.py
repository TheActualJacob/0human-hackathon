from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class LandlordTerms(BaseModel):
    """Hard constraints the landlord sets before the agent begins negotiating."""
    min_acceptable_rent: float = Field(..., gt=0, description="Floor rent — agent will never agree below this")
    preferred_duration_months: int = Field(12, ge=6, le=36, description="Preferred lease duration in months")
    concessions: str | None = Field(None, description="Concessions landlord is willing to offer (e.g. repaint, appliance fix)")
    auto_negotiate: bool = Field(True, description="If True, agent negotiates fully autonomously without landlord input per message")


class RunSimulationRequest(BaseModel):
    market_rent: float | None = Field(None, description="Current market rent for comparables. Auto-estimated if omitted.")


class InitiateRenewalRequest(BaseModel):
    market_rent: float | None = None
    terms: LandlordTerms | None = None


class TenantResponseRequest(BaseModel):
    tenant_message: str = Field(..., min_length=1, description="Raw message text from the tenant")


class LandlordDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(accept|counter|reject|escalate)$")
    counter_rent: float | None = Field(None, gt=0)
    notes: str | None = None


class RenewalScoreOut(BaseModel):
    score_id: str | None
    lease_id: str
    renewal_probability: float
    churn_probability: float
    confidence_score: float
    recommended_increase_pct: float
    current_rent: float
    market_rent: float
    lease_months: float


class ScenarioOut(BaseModel):
    increase_pct: float
    projected_renewal_probability: float
    projected_revenue_12m: float
    projected_revenue_24m: float
    vacancy_risk: float
    turnover_cost_estimate: float
    expected_value: float
    risk_label: str
    is_recommended: bool


class SimulationOut(BaseModel):
    lease_id: str
    score: dict[str, Any]
    recommended_scenario: ScenarioOut
    top_scenarios: list[ScenarioOut]
    all_scenarios: list[ScenarioOut]
    worst_case: ScenarioOut
    revenue_delta_vs_no_increase: float
    vacancy_breakeven_months: float | None
    turnover_cost_estimate: float


class NegotiationAnalysisOut(BaseModel):
    offer_id: str
    lease_id: str
    classification: str
    new_offer_status: str
    analysis: dict[str, Any]
    suggested_counter_rent: float | None
    ai_suggested_response: str
    escalate: bool
