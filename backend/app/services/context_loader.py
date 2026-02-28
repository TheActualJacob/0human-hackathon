from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from supabase import create_client, Client

from app.config import settings


def _get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ---------------------------------------------------------------------------
# Data classes mirroring the DB row shapes needed by the agent
# ---------------------------------------------------------------------------

@dataclass
class Tenant:
    id: str
    full_name: str
    whatsapp_number: str
    lease_id: str
    raw: dict[str, Any]


@dataclass
class Lease:
    id: str
    unit_id: str
    start_date: str
    end_date: str | None
    monthly_rent: float
    status: str | None
    raw: dict[str, Any]


@dataclass
class Unit:
    id: str
    landlord_id: str
    unit_identifier: str
    address: str
    city: str
    jurisdiction: str | None
    raw: dict[str, Any]


@dataclass
class Payment:
    due_date: str
    amount_due: float
    amount_paid: float | None
    status: str | None
    paid_date: str | None
    raw: dict[str, Any]


@dataclass
class PaymentPlan:
    installment_amount: float
    installment_frequency: str | None
    status: str | None
    raw: dict[str, Any]


@dataclass
class MaintenanceRequest:
    id: str
    category: str | None
    description: str
    urgency: str | None
    status: str | None
    created_at: str | None
    raw: dict[str, Any]


@dataclass
class LegalAction:
    id: str
    action_type: str
    status: str | None
    response_deadline: str | None
    raw: dict[str, Any]


@dataclass
class Dispute:
    id: str
    category: str | None
    description: str
    status: str | None
    opened_at: str | None
    raw: dict[str, Any]


@dataclass
class Conversation:
    id: str
    direction: str
    message_body: str
    timestamp: str | None
    raw: dict[str, Any]


@dataclass
class ConversationContext:
    lease_id: str
    summary: str | None
    open_threads: dict[str, Any]
    raw: dict[str, Any]


@dataclass
class TenantContext:
    tenant: Tenant
    lease: Lease
    unit: Unit
    landlord_id: str
    recent_conversations: list[Conversation] = field(default_factory=list)
    conversation_context: ConversationContext | None = None
    recent_payments: list[Payment] = field(default_factory=list)
    active_payment_plan: PaymentPlan | None = None
    open_maintenance_requests: list[MaintenanceRequest] = field(default_factory=list)
    open_legal_actions: list[LegalAction] = field(default_factory=list)
    open_disputes: list[Dispute] = field(default_factory=list)
    escalation_level: int = 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def load_tenant_context(whatsapp_number: str) -> TenantContext | None:
    sb = _get_supabase()

    # Strip whatsapp: prefix if present
    phone = whatsapp_number.removeprefix("whatsapp:")

    tenant_res = sb.table("tenants").select("*").eq("whatsapp_number", phone).single().execute()
    if not tenant_res.data:
        return None
    t = tenant_res.data
    tenant = Tenant(
        id=t["id"],
        full_name=t["full_name"],
        whatsapp_number=t["whatsapp_number"],
        lease_id=t["lease_id"],
        raw=t,
    )

    lease_res = sb.table("leases").select("*").eq("id", tenant.lease_id).single().execute()
    if not lease_res.data:
        return None
    l = lease_res.data
    lease = Lease(
        id=l["id"],
        unit_id=l["unit_id"],
        start_date=l["start_date"],
        end_date=l.get("end_date"),
        monthly_rent=float(l["monthly_rent"]),
        status=l.get("status"),
        raw=l,
    )

    unit_res = sb.table("units").select("*").eq("id", lease.unit_id).single().execute()
    if not unit_res.data:
        return None
    u = unit_res.data
    unit = Unit(
        id=u["id"],
        landlord_id=u["landlord_id"],
        unit_identifier=u["unit_identifier"],
        address=u["address"],
        city=u["city"],
        jurisdiction=u.get("jurisdiction"),
        raw=u,
    )

    # Fetch remaining context in parallel-ish (supabase-py is sync, so sequential)
    conversations_res = (
        sb.table("conversations")
        .select("*")
        .eq("lease_id", lease.id)
        .order("timestamp", desc=True)
        .limit(10)
        .execute()
    )
    context_res = (
        sb.table("conversation_context")
        .select("*")
        .eq("lease_id", lease.id)
        .maybe_single()
        .execute()
    )
    payments_res = (
        sb.table("payments")
        .select("*")
        .eq("lease_id", lease.id)
        .order("due_date", desc=True)
        .limit(6)
        .execute()
    )
    payment_plan_res = (
        sb.table("payment_plans")
        .select("*")
        .eq("lease_id", lease.id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    maintenance_res = (
        sb.table("maintenance_requests")
        .select("*")
        .eq("lease_id", lease.id)
        .in_("status", ["open", "assigned", "in_progress"])
        .order("created_at", desc=True)
        .execute()
    )
    legal_res = (
        sb.table("legal_actions")
        .select("*")
        .eq("lease_id", lease.id)
        .in_("status", ["issued", "acknowledged"])
        .order("issued_at", desc=True)
        .execute()
    )
    disputes_res = (
        sb.table("disputes")
        .select("*")
        .eq("lease_id", lease.id)
        .in_("status", ["open", "under_review"])
        .order("opened_at", desc=True)
        .execute()
    )

    # Parse conversation context & escalation level
    ctx_data = context_res.data if context_res else None
    conversation_context: ConversationContext | None = None
    escalation_level = 1
    if ctx_data:
        open_threads = ctx_data.get("open_threads") or {}
        if isinstance(open_threads, dict) and isinstance(open_threads.get("escalation_level"), int):
            escalation_level = open_threads["escalation_level"]
        conversation_context = ConversationContext(
            lease_id=ctx_data["lease_id"],
            summary=ctx_data.get("summary"),
            open_threads=open_threads,
            raw=ctx_data,
        )

    def _conv(row: dict) -> Conversation:
        return Conversation(
            id=row["id"],
            direction=row["direction"],
            message_body=row["message_body"],
            timestamp=row.get("timestamp"),
            raw=row,
        )

    raw_convs = conversations_res.data or []
    # reverse so they are chronological (oldest first → Claude history order)
    recent_conversations = [_conv(r) for r in reversed(raw_convs)]

    def _payment(row: dict) -> Payment:
        return Payment(
            due_date=row["due_date"],
            amount_due=float(row["amount_due"]),
            amount_paid=float(row["amount_paid"]) if row.get("amount_paid") is not None else None,
            status=row.get("status"),
            paid_date=row.get("paid_date"),
            raw=row,
        )

    recent_payments = [_payment(r) for r in (payments_res.data or [])]

    active_payment_plan: PaymentPlan | None = None
    if payment_plan_res and payment_plan_res.data:
        pp = payment_plan_res.data
        active_payment_plan = PaymentPlan(
            installment_amount=float(pp["installment_amount"]),
            installment_frequency=pp.get("installment_frequency"),
            status=pp.get("status"),
            raw=pp,
        )

    def _maintenance(row: dict) -> MaintenanceRequest:
        return MaintenanceRequest(
            id=row["id"],
            category=row.get("category"),
            description=row.get("description", ""),
            urgency=row.get("urgency"),
            status=row.get("status"),
            created_at=row.get("created_at"),
            raw=row,
        )

    def _legal(row: dict) -> LegalAction:
        return LegalAction(
            id=row["id"],
            action_type=row["action_type"],
            status=row.get("status"),
            response_deadline=row.get("response_deadline"),
            raw=row,
        )

    def _dispute(row: dict) -> Dispute:
        return Dispute(
            id=row["id"],
            category=row.get("category"),
            description=row.get("description", ""),
            status=row.get("status"),
            opened_at=row.get("opened_at"),
            raw=row,
        )

    return TenantContext(
        tenant=tenant,
        lease=lease,
        unit=unit,
        landlord_id=unit.landlord_id,
        recent_conversations=recent_conversations,
        conversation_context=conversation_context,
        recent_payments=recent_payments,
        active_payment_plan=active_payment_plan,
        open_maintenance_requests=[_maintenance(r) for r in (maintenance_res.data or [])],
        open_legal_actions=[_legal(r) for r in (legal_res.data or [])],
        open_disputes=[_dispute(r) for r in (disputes_res.data or [])],
        escalation_level=escalation_level,
    )


async def log_conversation(
    lease_id: str,
    direction: str,
    message_body: str,
    whatsapp_message_id: str | None = None,
    intent_classification: str | None = None,
) -> str | None:
    sb = _get_supabase()
    res = (
        sb.table("conversations")
        .insert({
            "lease_id": lease_id,
            "direction": direction,
            "message_body": message_body,
            "whatsapp_message_id": whatsapp_message_id,
            "intent_classification": intent_classification,
        })
        .execute()
    )
    if res.data:
        return res.data[0]["id"]
    return None


async def log_agent_action(
    lease_id: str,
    action_category: str,
    action_description: str,
    tools_called: list[Any] | None = None,
    input_summary: str | None = None,
    output_summary: str | None = None,
    confidence_score: float | None = None,
) -> None:
    sb = _get_supabase()
    sb.table("agent_actions").insert({
        "lease_id": lease_id,
        "action_category": action_category,
        "action_description": action_description,
        "tools_called": tools_called or [],
        "input_summary": input_summary,
        "output_summary": output_summary,
        "confidence_score": confidence_score,
    }).execute()


async def update_conversation_context(
    lease_id: str,
    summary: str,
    open_threads: dict[str, Any],
) -> None:
    sb = _get_supabase()
    from datetime import datetime, timezone
    sb.table("conversation_context").upsert(
        {
            "lease_id": lease_id,
            "summary": summary,
            "open_threads": open_threads,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="lease_id",
    ).execute()
