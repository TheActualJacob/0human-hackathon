from uuid import UUID

from pydantic import BaseModel


class PaymentInfoResponse(BaseModel):
    payment_id: UUID
    lease_id: UUID
    tenant_name: str
    unit_identifier: str
    amount_due: float
    due_date: str
    status: str


class CheckoutSessionRequest(BaseModel):
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str


class ConfirmPaymentRequest(BaseModel):
    session_id: str


class ConfirmPaymentResponse(BaseModel):
    success: bool
    message: str
    receipt_sent: bool
