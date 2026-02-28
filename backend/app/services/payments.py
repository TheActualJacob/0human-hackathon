import json
import logging
from datetime import date, datetime, timezone
from uuid import UUID

from app.database import supabase
from app.schemas.payments import (
    CheckOverdueResult,
    LatePatternItem,
    MonthlyReportResponse,
    PaymentRecordRequest,
    PaymentRecordResult,
    PaymentResponse,
    PropertyBreakdownItem,
)
from app.services.whatsapp import whatsapp_service

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_response(
    row: dict,
    tenant_name: str | None = None,
    unit_identifier: str | None = None,
) -> PaymentResponse:
    return PaymentResponse(
        id=row["id"],
        lease_id=row["lease_id"],
        amount_due=float(row["amount_due"]),
        amount_paid=float(row["amount_paid"]) if row.get("amount_paid") is not None else None,
        due_date=row["due_date"],
        paid_date=row.get("paid_date"),
        status=row["status"],
        payment_method=row.get("payment_method"),
        notes=row.get("notes"),
        tenant_name=tenant_name,
        unit_identifier=unit_identifier,
    )


# ── 1. Record Payment ──


async def record_payment(req: PaymentRecordRequest) -> PaymentRecordResult:
    today = str(req.paid_date or date.today())

    # Resolve lease
    lease_id: str | None = str(req.lease_id) if req.lease_id else None
    if not lease_id and req.tenant_whatsapp:
        result = supabase.table("tenants").select("*").eq("whatsapp_number", req.tenant_whatsapp).execute()
        if not result.data:
            raise ValueError(f"No tenant found with WhatsApp number {req.tenant_whatsapp}")
        lease_id = result.data[0]["lease_id"]

    if not lease_id:
        raise ValueError("Either lease_id or tenant_whatsapp must be provided")

    # Find matching pending/late payment
    candidates = (
        supabase.table("payments")
        .select("*")
        .eq("lease_id", lease_id)
        .in_("status", ["pending", "late"])
        .order("due_date")
        .execute()
        .data
    )

    matched_payment: dict | None = None
    for c in candidates:
        if abs(float(c["amount_due"]) - req.amount) < 0.01:
            matched_payment = c
            break

    if not matched_payment and candidates:
        matched_payment = candidates[0]

    matched = matched_payment is not None

    if matched_payment:
        new_status = "paid" if req.amount >= float(matched_payment["amount_due"]) else "partial"
        result = (
            supabase.table("payments")
            .update({
                "amount_paid": req.amount,
                "paid_date": today,
                "payment_method": req.payment_method,
                "status": new_status,
            })
            .eq("id", matched_payment["id"])
            .execute()
        )
        payment = result.data[0]
    else:
        result = (
            supabase.table("payments")
            .insert({
                "lease_id": lease_id,
                "amount_due": req.amount,
                "amount_paid": req.amount,
                "due_date": today,
                "paid_date": today,
                "status": "paid",
                "payment_method": req.payment_method,
                "notes": f"Reference: {req.reference}" if req.reference else None,
            })
            .execute()
        )
        payment = result.data[0]

    # Look up tenant + unit for receipt
    lease = supabase.table("leases").select("*").eq("id", lease_id).single().execute().data
    tenant_result = (
        supabase.table("tenants")
        .select("*")
        .eq("lease_id", lease_id)
        .eq("is_primary_tenant", True)
        .execute()
    )
    tenant = tenant_result.data[0] if tenant_result.data else None
    unit = supabase.table("units").select("*").eq("id", lease["unit_id"]).single().execute().data

    tenant_name = tenant["full_name"] if tenant else "Tenant"
    unit_name = unit["unit_identifier"]

    # Send WhatsApp receipt
    receipt_sent = False
    if tenant and tenant.get("whatsapp_number"):
        body = whatsapp_service.format_receipt(tenant_name, req.amount, unit_name, today)
        sid = await whatsapp_service.send_message(tenant["whatsapp_number"], body)
        receipt_sent = sid is not None or whatsapp_service._client is None  # DRY RUN counts as sent

        supabase.table("conversations").insert({
            "lease_id": lease_id,
            "direction": "outbound",
            "message_body": body,
            "whatsapp_message_id": sid,
            "intent_classification": "payment_receipt",
            "timestamp": _now_iso(),
        }).execute()

    # Log agent action
    supabase.table("agent_actions").insert({
        "lease_id": lease_id,
        "action_category": "payment",
        "action_description": f"Payment of £{req.amount:.2f} recorded for {tenant_name} at {unit_name}",
        "confidence_score": 1.0,
        "timestamp": _now_iso(),
    }).execute()

    return PaymentRecordResult(
        payment=_row_to_response(payment, tenant_name, unit_name),
        matched=matched,
        receipt_sent=receipt_sent,
        message=f"Payment of £{req.amount:.2f} {'matched and updated' if matched else 'recorded'}. "
        f"Receipt {'sent' if receipt_sent else 'not sent (no WhatsApp number)'}.",
    )


# ── 2. Check Overdue Payments ──

ESCALATION_LEVELS = ["none", "green", "yellow", "red", "day20", "missed"]


def _get_escalation_level(days_overdue: int) -> str:
    if days_overdue < 5:
        return "none"
    if days_overdue < 10:
        return "green"
    if days_overdue < 15:
        return "yellow"
    if days_overdue < 20:
        return "red"
    if days_overdue < 30:
        return "day20"
    return "missed"


def _parse_escalation_notes(notes: str | None) -> dict:
    if not notes:
        return {}
    try:
        return json.loads(notes)
    except (json.JSONDecodeError, TypeError):
        return {}


def _should_escalate(current_level: str, last_level: str) -> bool:
    return ESCALATION_LEVELS.index(current_level) > ESCALATION_LEVELS.index(last_level)


async def check_overdue_payments() -> CheckOverdueResult:
    today = date.today()

    # Get overdue payments with nested joins via PostgREST embedded resources
    result = (
        supabase.table("payments")
        .select(
            "*, leases("
            "id, unit_id, "
            "units(id, unit_identifier, landlord_id, "
            "landlords(id, full_name, whatsapp_number)), "
            "tenants(id, full_name, whatsapp_number, is_primary_tenant, lease_id))"
        )
        .in_("status", ["pending", "late"])
        .lt("due_date", str(today))
        .execute()
    )

    processed = 0
    reminders_sent = 0
    landlord_alerts = 0
    escalations: list[dict] = []

    for row in result.data:
        processed += 1
        days_overdue = (today - date.fromisoformat(row["due_date"])).days
        current_level = _get_escalation_level(days_overdue)

        # Parse last escalation from notes
        meta = _parse_escalation_notes(row.get("notes"))
        last_level = meta.get("escalation", "none")

        # Determine new status
        new_status = row["status"]
        if row["status"] == "pending" and days_overdue > 0:
            new_status = "late"
        if days_overdue >= 30:
            new_status = "missed"

        # Extract nested data
        lease_data = row.get("leases") or {}
        unit_data = lease_data.get("units") or {}
        landlord_data = unit_data.get("landlords") or {}
        tenants_list = lease_data.get("tenants") or []
        tenant = next((t for t in tenants_list if t.get("is_primary_tenant")), None)

        # Check if we need to escalate
        if current_level == "none" or not _should_escalate(current_level, last_level):
            # Still update status if changed
            if new_status != row["status"]:
                supabase.table("payments").update({"status": new_status}).eq("id", row["id"]).execute()
            continue

        tenant_name = tenant["full_name"] if tenant else "Tenant"
        unit_name = unit_data.get("unit_identifier", "Unknown")
        amount = float(row["amount_due"])
        lease_id = row["lease_id"]

        # Send appropriate message
        if current_level == "green" and tenant and tenant.get("whatsapp_number"):
            body = whatsapp_service.format_reminder_green(tenant_name, amount, unit_name, days_overdue)
            sid = await whatsapp_service.send_message(tenant["whatsapp_number"], body)
            reminders_sent += 1
            supabase.table("conversations").insert({
                "lease_id": lease_id, "direction": "outbound", "message_body": body,
                "whatsapp_message_id": sid, "intent_classification": "payment_reminder_green",
                "timestamp": _now_iso(),
            }).execute()

        elif current_level == "yellow" and tenant and tenant.get("whatsapp_number"):
            body = whatsapp_service.format_reminder_yellow(tenant_name, amount, unit_name, days_overdue)
            sid = await whatsapp_service.send_message(tenant["whatsapp_number"], body)
            reminders_sent += 1
            supabase.table("conversations").insert({
                "lease_id": lease_id, "direction": "outbound", "message_body": body,
                "whatsapp_message_id": sid, "intent_classification": "payment_reminder_yellow",
                "timestamp": _now_iso(),
            }).execute()

        elif current_level == "red":
            # Send to tenant
            if tenant and tenant.get("whatsapp_number"):
                body = whatsapp_service.format_reminder_red(tenant_name, amount, unit_name, days_overdue)
                sid = await whatsapp_service.send_message(tenant["whatsapp_number"], body)
                reminders_sent += 1
                supabase.table("conversations").insert({
                    "lease_id": lease_id, "direction": "outbound", "message_body": body,
                    "whatsapp_message_id": sid, "intent_classification": "payment_reminder_red",
                    "timestamp": _now_iso(),
                }).execute()

            # Alert landlord
            if landlord_data.get("whatsapp_number"):
                ll_body = whatsapp_service.format_landlord_alert(
                    landlord_data["full_name"], tenant_name, unit_name, amount, days_overdue
                )
                await whatsapp_service.send_message(landlord_data["whatsapp_number"], ll_body)

            supabase.table("landlord_notifications").insert({
                "landlord_id": landlord_data.get("id"),
                "lease_id": lease_id,
                "notification_type": "rent_overdue",
                "message": f"FINAL NOTICE sent to {tenant_name} at {unit_name}. "
                           f"£{amount:.2f} is {days_overdue} days overdue.",
                "related_record_type": "payment",
                "related_record_id": row["id"],
                "created_at": _now_iso(),
            }).execute()
            landlord_alerts += 1

        elif current_level == "day20":
            if landlord_data.get("whatsapp_number"):
                ll_body = whatsapp_service.format_landlord_day20(
                    landlord_data["full_name"], tenant_name, unit_name, amount, days_overdue
                )
                await whatsapp_service.send_message(landlord_data["whatsapp_number"], ll_body)

            supabase.table("landlord_notifications").insert({
                "landlord_id": landlord_data.get("id"),
                "lease_id": lease_id,
                "notification_type": "rent_overdue",
                "message": f"DECISION REQUIRED: {tenant_name} at {unit_name} is {days_overdue} days overdue "
                           f"on £{amount:.2f}. Awaiting landlord instruction.",
                "related_record_type": "payment",
                "related_record_id": row["id"],
                "requires_signature": True,
                "created_at": _now_iso(),
            }).execute()
            landlord_alerts += 1

        # Update payment: status + escalation metadata
        meta["escalation"] = current_level
        meta["reminded_at"] = str(today)
        supabase.table("payments").update({
            "status": new_status,
            "notes": json.dumps(meta),
        }).eq("id", row["id"]).execute()

        # Log agent action
        supabase.table("agent_actions").insert({
            "lease_id": lease_id,
            "action_category": "payment",
            "action_description": f"Escalation [{current_level}]: {tenant_name} at {unit_name}, "
                                  f"£{amount:.2f}, {days_overdue} days overdue",
            "confidence_score": 0.95,
            "timestamp": _now_iso(),
        }).execute()

        escalations.append({
            "payment_id": str(row["id"]),
            "tenant": tenant_name,
            "unit": unit_name,
            "days_overdue": days_overdue,
            "level": current_level,
            "amount": amount,
        })

    return CheckOverdueResult(
        processed=processed,
        reminders_sent=reminders_sent,
        landlord_alerts=landlord_alerts,
        escalations=escalations,
    )


# ── 3. Get Payments ──


async def get_payments(
    lease_id: UUID | None = None,
    landlord_id: UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PaymentResponse]:
    query = supabase.table("payments").select(
        "*, leases(id, unit_id, units(unit_identifier), tenants(full_name, is_primary_tenant))"
    )

    if lease_id:
        query = query.eq("lease_id", str(lease_id))
    if status:
        query = query.eq("status", status)

    # landlord_id filter requires resolving through units → leases
    if landlord_id:
        units_result = supabase.table("units").select("id").eq("landlord_id", str(landlord_id)).execute()
        unit_ids = [u["id"] for u in units_result.data]
        if not unit_ids:
            return []
        leases_result = supabase.table("leases").select("id").in_("unit_id", unit_ids).execute()
        lease_ids = [l["id"] for l in leases_result.data]
        if not lease_ids:
            return []
        query = query.in_("lease_id", lease_ids)

    query = query.order("due_date", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    responses = []
    for row in result.data:
        lease_data = row.get("leases") or {}
        unit_data = lease_data.get("units") or {}
        tenants_list = lease_data.get("tenants") or []
        primary_tenant = next((t for t in tenants_list if t.get("is_primary_tenant")), None)

        responses.append(_row_to_response(
            row,
            tenant_name=primary_tenant["full_name"] if primary_tenant else None,
            unit_identifier=unit_data.get("unit_identifier"),
        ))

    return responses


# ── 4. Monthly Report ──


async def generate_monthly_report(
    landlord_id: UUID,
    year: int,
    month: int,
) -> MonthlyReportResponse:
    # Get landlord
    landlord = supabase.table("landlords").select("*").eq("id", str(landlord_id)).single().execute().data

    # Get all units for landlord
    units = supabase.table("units").select("*").eq("landlord_id", str(landlord_id)).execute().data
    unit_ids = [u["id"] for u in units]

    if not unit_ids:
        return MonthlyReportResponse(
            landlord_id=landlord_id,
            landlord_name=landlord["full_name"],
            period=f"{year}-{month:02d}",
            total_expected=0, total_collected=0, total_outstanding=0,
            collection_rate=0, payments_on_time=0, payments_late=0, payments_missed=0,
            late_patterns=[], property_breakdown=[], active_payment_plans=0,
            total_arrears_under_plan=0,
        )

    # Get leases for those units
    leases = supabase.table("leases").select("*").in_("unit_id", unit_ids).execute().data
    lease_ids = [l["id"] for l in leases]

    if not lease_ids:
        return MonthlyReportResponse(
            landlord_id=landlord_id,
            landlord_name=landlord["full_name"],
            period=f"{year}-{month:02d}",
            total_expected=0, total_collected=0, total_outstanding=0,
            collection_rate=0, payments_on_time=0, payments_late=0, payments_missed=0,
            late_patterns=[], property_breakdown=[], active_payment_plans=0,
            total_arrears_under_plan=0,
        )

    # Get payments for target month (filter by date range instead of extract())
    first_day = f"{year}-{month:02d}-01"
    if month == 12:
        next_month_first = f"{year + 1}-01-01"
    else:
        next_month_first = f"{year}-{month + 1:02d}-01"

    payments = (
        supabase.table("payments")
        .select("*")
        .in_("lease_id", lease_ids)
        .gte("due_date", first_day)
        .lt("due_date", next_month_first)
        .execute()
        .data
    )

    # Aggregates
    total_expected = sum(float(p["amount_due"]) for p in payments)
    total_collected = sum(
        float(p.get("amount_paid") or 0) for p in payments if p["status"] in ("paid", "partial")
    )
    total_outstanding = total_expected - total_collected

    payments_on_time = sum(
        1 for p in payments
        if p["status"] == "paid" and p.get("paid_date") and p["paid_date"] <= p["due_date"]
    )
    payments_late = sum(1 for p in payments if p["status"] in ("late", "partial"))
    payments_missed = sum(1 for p in payments if p["status"] == "missed")

    collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

    # Get primary tenants for these leases
    tenants = (
        supabase.table("tenants")
        .select("*")
        .in_("lease_id", lease_ids)
        .eq("is_primary_tenant", True)
        .execute()
        .data
    )
    tenant_by_lease = {t["lease_id"]: t for t in tenants}

    # Late patterns
    lease_map = {l["id"]: l for l in leases}
    unit_map = {u["id"]: u for u in units}

    late_data: dict[str, dict] = {}
    for p in payments:
        if p["status"] not in ("late", "missed", "partial"):
            if not (p["status"] == "paid" and p.get("paid_date") and p["paid_date"] > p["due_date"]):
                continue
        lease = lease_map.get(p["lease_id"])
        tenant = tenant_by_lease.get(p["lease_id"])
        unit = unit_map.get(lease["unit_id"]) if lease else None
        key = p["lease_id"]

        if key not in late_data:
            late_data[key] = {
                "tenant_name": tenant["full_name"] if tenant else "Unknown",
                "unit_identifier": unit["unit_identifier"] if unit else "Unknown",
                "times_late": 0,
                "total_days_late": 0,
            }
        late_data[key]["times_late"] += 1
        if p.get("paid_date"):
            late_data[key]["total_days_late"] += (
                date.fromisoformat(p["paid_date"]) - date.fromisoformat(p["due_date"])
            ).days

    late_patterns = [
        LatePatternItem(
            tenant_name=v["tenant_name"],
            unit_identifier=v["unit_identifier"],
            times_late=v["times_late"],
            avg_days_late=v["total_days_late"] / v["times_late"] if v["times_late"] > 0 else 0,
        )
        for v in late_data.values()
    ]

    # Property breakdown
    property_breakdown: list[PropertyBreakdownItem] = []
    for unit in units:
        unit_lease_ids = [l["id"] for l in leases if l["unit_id"] == unit["id"]]
        unit_payments = [p for p in payments if p["lease_id"] in unit_lease_ids]
        expected = sum(float(p["amount_due"]) for p in unit_payments)
        collected = sum(
            float(p.get("amount_paid") or 0)
            for p in unit_payments
            if p["status"] in ("paid", "partial")
        )
        if not unit_payments:
            pstatus = "no_payments"
        elif collected >= expected:
            pstatus = "fully_collected"
        elif collected > 0:
            pstatus = "partially_collected"
        else:
            pstatus = "not_collected"
        property_breakdown.append(PropertyBreakdownItem(
            unit_identifier=unit["unit_identifier"],
            expected=expected,
            collected=collected,
            status=pstatus,
        ))

    # Payment plans
    plans = (
        supabase.table("payment_plans")
        .select("*")
        .in_("lease_id", lease_ids)
        .eq("status", "active")
        .execute()
        .data
    )

    return MonthlyReportResponse(
        landlord_id=landlord_id,
        landlord_name=landlord["full_name"],
        period=f"{year}-{month:02d}",
        total_expected=total_expected,
        total_collected=total_collected,
        total_outstanding=total_outstanding,
        collection_rate=round(collection_rate, 1),
        payments_on_time=payments_on_time,
        payments_late=payments_late,
        payments_missed=payments_missed,
        late_patterns=late_patterns,
        property_breakdown=property_breakdown,
        active_payment_plans=len(plans),
        total_arrears_under_plan=sum(float(p["total_arrears"]) for p in plans),
    )
