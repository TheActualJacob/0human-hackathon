from datetime import date
from uuid import UUID

from pydantic import BaseModel


class PaymentRecordRequest(BaseModel):
    lease_id: UUID | None = None
    tenant_whatsapp: str | None = None
    amount: float
    payment_method: str | None = None
    reference: str | None = None
    paid_date: date | None = None


class PaymentResponse(BaseModel):
    id: UUID
    lease_id: UUID
    amount_due: float
    amount_paid: float | None
    due_date: date
    paid_date: date | None
    status: str
    payment_method: str | None
    notes: str | None
    tenant_name: str | None = None
    unit_identifier: str | None = None

    model_config = {"from_attributes": True}


class PaymentRecordResult(BaseModel):
    payment: PaymentResponse
    matched: bool
    receipt_sent: bool
    message: str


class CheckOverdueResult(BaseModel):
    processed: int
    reminders_sent: int
    landlord_alerts: int
    escalations: list[dict]


class LatePatternItem(BaseModel):
    tenant_name: str
    unit_identifier: str
    times_late: int
    avg_days_late: float


class PropertyBreakdownItem(BaseModel):
    unit_identifier: str
    expected: float
    collected: float
    status: str


class MonthlyReportResponse(BaseModel):
    landlord_id: UUID
    landlord_name: str
    period: str
    total_expected: float
    total_collected: float
    total_outstanding: float
    collection_rate: float
    payments_on_time: int
    payments_late: int
    payments_missed: int
    late_patterns: list[LatePatternItem]
    property_breakdown: list[PropertyBreakdownItem]
    active_payment_plans: int
    total_arrears_under_plan: float


class GenerateLeasePaymentsResult(BaseModel):
    created: int
    lease_id: str
    message: str
