from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.schemas.payments import (
    CheckOverdueResult,
    MonthlyReportResponse,
    PaymentRecordRequest,
    PaymentRecordResult,
    PaymentResponse,
)
from app.services.payments import (
    check_overdue_payments,
    generate_monthly_report,
    get_payments,
    record_payment,
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/record", response_model=PaymentRecordResult)
async def record_payment_endpoint(req: PaymentRecordRequest):
    try:
        return await record_payment(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[PaymentResponse])
async def list_payments(
    lease_id: UUID | None = Query(None),
    landlord_id: UUID | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    return await get_payments(
        lease_id=lease_id, landlord_id=landlord_id, status=status, limit=limit, offset=offset
    )


@router.post("/check-overdue", response_model=CheckOverdueResult)
async def check_overdue_endpoint():
    return await check_overdue_payments()


@router.get("/report/{landlord_id}", response_model=MonthlyReportResponse)
async def monthly_report_endpoint(
    landlord_id: UUID,
    year: int | None = Query(None),
    month: int | None = Query(None),
):
    if year is None or month is None:
        today = date.today()
        if today.month == 1:
            year, month = today.year - 1, 12
        else:
            year, month = today.year, today.month - 1
    return await generate_monthly_report(landlord_id, year, month)
