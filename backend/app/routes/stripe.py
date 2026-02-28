import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.database import supabase
from app.schemas.payments import PaymentRecordRequest
from app.schemas.stripe import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    ConfirmPaymentRequest,
    ConfirmPaymentResponse,
    PaymentInfoResponse,
)
from app.services.payments import record_payment
from app.services.stripe_service import create_checkout_session, retrieve_checkout_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["stripe"])


def _get_payment_with_details(payment_id: UUID) -> dict:
    """Fetch a payment row with nested lease → unit and tenant data."""
    result = (
        supabase.table("payments")
        .select(
            "*, leases(id, unit_id, "
            "units(unit_identifier), "
            "tenants(full_name, is_primary_tenant))"
        )
        .eq("id", str(payment_id))
        .single()
        .execute()
    )
    row = result.data
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")

    lease_data = row.get("leases") or {}
    unit_data = lease_data.get("units") or {}
    tenants_list = lease_data.get("tenants") or []
    primary = next((t for t in tenants_list if t.get("is_primary_tenant")), None)

    return {
        "row": row,
        "tenant_name": primary["full_name"] if primary else "Tenant",
        "unit_identifier": unit_data.get("unit_identifier", "Unknown"),
        "amount_due": float(row["amount_due"]),
    }


@router.get("/{payment_id}/pay-info", response_model=PaymentInfoResponse)
async def get_payment_info(payment_id: UUID):
    info = _get_payment_with_details(payment_id)
    row = info["row"]

    if row["status"] in ("paid",):
        raise HTTPException(status_code=400, detail="This payment has already been completed")

    return PaymentInfoResponse(
        payment_id=row["id"],
        lease_id=row["lease_id"],
        tenant_name=info["tenant_name"],
        unit_identifier=info["unit_identifier"],
        amount_due=info["amount_due"],
        due_date=row["due_date"],
        status=row["status"],
    )


@router.post("/{payment_id}/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout(payment_id: UUID, req: CheckoutSessionRequest):
    info = _get_payment_with_details(payment_id)
    row = info["row"]

    if row["status"] in ("paid",):
        raise HTTPException(status_code=400, detail="This payment has already been completed")

    amount_pence = int(round(info["amount_due"] * 100))

    session = create_checkout_session(
        payment_id=str(payment_id),
        amount_pence=amount_pence,
        tenant_name=info["tenant_name"],
        unit_identifier=info["unit_identifier"],
        success_url=req.success_url,
        cancel_url=req.cancel_url,
    )

    return CheckoutSessionResponse(
        session_id=session.id,
        checkout_url=session.url,
    )


@router.post("/{payment_id}/confirm-stripe", response_model=ConfirmPaymentResponse)
async def confirm_stripe_payment(payment_id: UUID, req: ConfirmPaymentRequest):
    # Check if already paid (idempotent)
    payment_row = (
        supabase.table("payments")
        .select("*")
        .eq("id", str(payment_id))
        .single()
        .execute()
        .data
    )
    if not payment_row:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment_row["status"] == "paid":
        return ConfirmPaymentResponse(
            success=True,
            message="Payment already recorded",
            receipt_sent=False,
        )

    # Verify with Stripe
    session = retrieve_checkout_session(req.session_id)

    if session.payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed on Stripe")

    if session.metadata.get("payment_id") != str(payment_id):
        raise HTTPException(status_code=400, detail="Payment ID mismatch")

    # Record via existing payment service (updates DB + sends WhatsApp receipt)
    result = await record_payment(
        PaymentRecordRequest(
            lease_id=payment_row["lease_id"],
            amount=float(payment_row["amount_due"]),
            payment_method="stripe",
            reference=req.session_id,
        )
    )

    return ConfirmPaymentResponse(
        success=True,
        message=result.message,
        receipt_sent=result.receipt_sent,
    )
