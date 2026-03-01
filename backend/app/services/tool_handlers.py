from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.context_loader import TenantContext, log_agent_action, update_conversation_context

logger = logging.getLogger(__name__)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@dataclass
class ToolResult:
    success: bool
    data: Any = None
    error: str | None = None
    is_high_severity: bool = False
    landlord_notification_message: str | None = None


# ---------------------------------------------------------------------------
# Tool definitions for Claude
# ---------------------------------------------------------------------------

AGENT_TOOLS = [
    {
        "name": "get_rent_status",
        "description": (
            "Retrieves the current rent payment status for the tenant. Returns recent payment history, "
            "any outstanding arrears, and active payment plan details. Use this when the tenant asks "
            "about payments, rent, arrears, or when you need to verify payment status before taking action."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "schedule_maintenance",
        "description": (
            "Creates a maintenance request and assigns the best available contractor from the landlord's "
            "approved list. Use this when the tenant reports a repair issue, fault, or maintenance need. "
            "For emergencies (no hot water, gas leak, flooding, no heating in winter), set urgency to 'emergency'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["plumbing", "electrical", "structural", "appliance", "heating", "pest", "damp", "access", "other"],
                    "description": "The category of the maintenance issue.",
                },
                "description": {
                    "type": "string",
                    "description": "Clear description of the maintenance issue as reported by the tenant.",
                },
                "urgency": {
                    "type": "string",
                    "enum": ["emergency", "high", "routine"],
                    "description": (
                        "Urgency level: emergency = immediate risk to health/safety, "
                        "high = significant inconvenience within 24-48hrs, routine = non-urgent."
                    ),
                },
            },
            "required": ["category", "description", "urgency"],
        },
    },
    {
        "name": "issue_legal_notice",
        "description": (
            "Issues a formal legal notice to the tenant. This generates a PDF document from the "
            "jurisdiction-appropriate template, logs it as a legal action, and notifies the landlord. "
            "Only use this when escalation is warranted by the situation (e.g., persistent rent arrears, "
            "lease violation). This is a serious action — ensure it is appropriate before calling."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "notice_type": {
                    "type": "string",
                    "enum": [
                        "formal_notice",
                        "section_8",
                        "section_21",
                        "payment_demand",
                        "lease_violation_notice",
                        "payment_plan_agreement",
                    ],
                    "description": (
                        "The type of legal notice to issue. section_8 = rent arrears eviction notice, "
                        "section_21 = no-fault eviction notice, payment_demand = formal payment demand letter, "
                        "formal_notice = general formal written warning."
                    ),
                },
                "reason": {
                    "type": "string",
                    "description": "Brief explanation of why this notice is being issued. This is logged as agent_reasoning.",
                },
            },
            "required": ["notice_type", "reason"],
        },
    },
    {
        "name": "update_escalation_level",
        "description": (
            "Updates the escalation level for this tenancy (1=Conversational, 2=Formal Written, "
            "3=Legal Process, 4=Pre-Tribunal). Use this when the situation warrants a change in escalation "
            "— either escalating due to non-compliance or de-escalating when issues are resolved."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "new_level": {
                    "type": "number",
                    "enum": [1, 2, 3, 4],
                    "description": "The new escalation level: 1=Conversational, 2=Formal Written, 3=Legal Process, 4=Pre-Tribunal.",
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for the escalation level change. This is permanently logged.",
                },
            },
            "required": ["new_level", "reason"],
        },
    },
]


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

async def execute_tool(tool_name: str, tool_input: dict[str, Any], ctx: TenantContext) -> ToolResult:
    if tool_name == "get_rent_status":
        return await _get_rent_status(tool_input, ctx)
    elif tool_name == "schedule_maintenance":
        return await _schedule_maintenance(tool_input, ctx)
    elif tool_name == "issue_legal_notice":
        return await _issue_legal_notice(tool_input, ctx)
    elif tool_name == "update_escalation_level":
        return await _update_escalation_level(tool_input, ctx)
    else:
        return ToolResult(success=False, error=f"Unknown tool: {tool_name}")


# ---------------------------------------------------------------------------
# Implementations
# ---------------------------------------------------------------------------

async def _get_rent_status(inp: dict[str, Any], ctx: TenantContext) -> ToolResult:
    sb = _sb()
    lease_id = ctx.lease.id

    payments_res = (
        sb.table("payments")
        .select("*")
        .eq("lease_id", lease_id)
        .order("due_date", desc=True)
        .limit(6)
        .execute()
    )
    plan_res = (
        sb.table("payment_plans")
        .select("*")
        .eq("lease_id", lease_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )

    payments = payments_res.data or []
    total_arrears = sum(
        float(p["amount_due"]) - float(p.get("amount_paid") or 0) for p in payments
    )

    result_data = {
        "payments": [
            {
                "due_date": p["due_date"],
                "amount_due": float(p["amount_due"]),
                "amount_paid": float(p["amount_paid"]) if p.get("amount_paid") is not None else None,
                "status": p.get("status"),
                "arrears": float(p["amount_due"]) - float(p.get("amount_paid") or 0),
            }
            for p in payments
        ],
        "total_arrears": total_arrears,
        "active_payment_plan": (
            {
                "installment_amount": float(plan_res.data["installment_amount"]),
                "frequency": plan_res.data.get("installment_frequency"),
                "status": plan_res.data.get("status"),
            }
            if plan_res and plan_res.data
            else None
        ),
    }

    await log_agent_action(
        lease_id=lease_id,
        action_category="payment",
        action_description=f"Checked rent status. Total arrears: £{total_arrears:.2f}",
        tools_called=[{"tool": "get_rent_status", "input": inp}],
        output_summary=f"Total arrears: £{total_arrears:.2f}",
        confidence_score=1.0,
    )

    return ToolResult(success=True, data=result_data)


async def _schedule_maintenance(inp: dict[str, Any], ctx: TenantContext) -> ToolResult:
    sb = _sb()
    lease_id = ctx.lease.id  # always use context — never trust Claude's lease_id input
    category = inp["category"]
    description = inp["description"]
    urgency = inp["urgency"]
    is_emergency = urgency == "emergency"

    contractors_res = (
        sb.table("contractors")
        .select("*")
        .eq("landlord_id", ctx.landlord_id)
        .contains("trades", [category])
        .execute()
    )
    contractors = contractors_res.data or []

    selected = None
    if contractors:
        eligible = [c for c in contractors if c.get("emergency_available")] if is_emergency else contractors
        selected = (eligible or contractors)[0]

    insert_payload = {
        "lease_id": lease_id,
        "category": category,
        "description": description,
        "urgency": urgency,
        "status": "assigned" if selected else "open",
        "contractor_id": selected["id"] if selected else None,
    }
    import sys
    sys.stderr.write(f"[schedule_maintenance] PAYLOAD: {insert_payload}\n")
    sys.stderr.flush()
    try:
        request_res = (
            sb.table("maintenance_requests")
            .insert(insert_payload)
            .execute()
        )
        sys.stderr.write(f"[schedule_maintenance] INSERT OK: {request_res.data}\n")
        sys.stderr.flush()
    except Exception as exc:
        sys.stderr.write(f"[schedule_maintenance] INSERT ERROR: {type(exc).__name__}: {exc}\n")
        sys.stderr.flush()
        return ToolResult(success=False, error=f"Failed to create maintenance request: {exc}")

    if not request_res.data:
        sys.stderr.write("[schedule_maintenance] INSERT returned no data\n")
        sys.stderr.flush()
        return ToolResult(success=False, error="Failed to create maintenance request")

    request_id = request_res.data[0]["id"]

    # Send email notification to maintenance company
    import asyncio
    from app.services.email_service import send_maintenance_email
    MAINTENANCE_EMAIL = "perfecttouchphotoshopping@gmail.com"
    await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: send_maintenance_email(
            to_email=MAINTENANCE_EMAIL,
            property_address=ctx.unit.address,
            unit_identifier=ctx.unit.unit_identifier,
            tenant_name=ctx.tenant.full_name,
            category=category,
            urgency=urgency,
            description=description,
            request_id=request_id,
            contractor_name=selected["name"] if selected else None,
        ),
    )

    await log_agent_action(
        lease_id=lease_id,
        action_category="maintenance",
        action_description=f"Scheduled {urgency} maintenance: {category} — {description[:80]}",
        tools_called=[{"tool": "schedule_maintenance", "input": inp}],
        output_summary=f"Assigned to {selected['name']}" if selected else "No contractor available, logged as open",
        confidence_score=0.9,
    )

    landlord_msg = None
    if is_emergency:
        contractor_info = (
            f"Assigned to {selected['name']} ({selected.get('phone', 'no phone')})."
            if selected
            else "No contractor assigned — action required."
        )
        landlord_msg = (
            f"EMERGENCY MAINTENANCE logged at {ctx.unit.unit_identifier}, {ctx.unit.address}. "
            f"Issue: {description}. {contractor_info}"
        )

    return ToolResult(
        success=True,
        is_high_severity=is_emergency,
        landlord_notification_message=landlord_msg,
        data={
            "request_id": request_id,
            "status": "assigned" if selected else "open",
            "contractor": (
                {
                    "name": selected["name"],
                    "phone": selected.get("phone"),
                    "email": selected.get("email"),
                    "emergency_available": selected.get("emergency_available"),
                }
                if selected
                else None
            ),
            "message": (
                f"Maintenance request raised and assigned to {selected['name']}"
                + (f" ({selected['phone']})" if selected and selected.get("phone") else "")
                + "."
                if selected
                else "Maintenance request logged. A contractor will be assigned shortly."
            ),
        },
    )


async def _issue_legal_notice(inp: dict[str, Any], ctx: TenantContext) -> ToolResult:
    from app.services.pdf_generator import generate_legal_notice

    sb = _sb()
    lease_id = ctx.lease.id
    notice_type = inp["notice_type"]
    reason = inp["reason"]

    document_url = None
    try:
        pdf_bytes, filename = await generate_legal_notice(notice_type, ctx, reason)
        upload_res = (
            sb.storage.from_("legal-documents")
            .upload(f"{lease_id}/{filename}", pdf_bytes, {"content-type": "application/pdf", "upsert": "false"})
        )
        if upload_res:
            public = sb.storage.from_("legal-documents").get_public_url(f"{lease_id}/{filename}")
            document_url = public
    except Exception as exc:
        print(f"PDF generation/upload error: {exc}")

    deadline = _compute_deadline_days(notice_type, ctx.unit.jurisdiction or "england_wales")
    response_deadline = datetime.now(timezone.utc).replace(
        tzinfo=timezone.utc
    )
    from datetime import timedelta
    response_deadline_dt = datetime.now(timezone.utc) + timedelta(days=deadline)
    response_deadline_str = response_deadline_dt.isoformat()
    deadline_display = response_deadline_dt.strftime("%d %B %Y")

    legal_res = (
        sb.table("legal_actions")
        .insert({
            "lease_id": lease_id,
            "action_type": notice_type,
            "document_url": document_url,
            "response_deadline": response_deadline_str,
            "status": "issued",
            "agent_reasoning": reason,
        })
        .execute()
    )

    if not legal_res.data:
        return ToolResult(success=False, error="Failed to log legal action")

    legal_action_id = legal_res.data[0]["id"]
    requires_sig = notice_type in ("section_8", "section_21")

    sb.table("landlord_notifications").insert({
        "landlord_id": ctx.landlord_id,
        "lease_id": lease_id,
        "notification_type": "legal_notice_issued",
        "message": (
            f"Legal notice issued to {ctx.tenant.full_name} at {ctx.unit.unit_identifier}, "
            f"{ctx.unit.address}. Type: {notice_type}. Reason: {reason}. Deadline: {deadline_display}."
        ),
        "related_record_type": "legal_actions",
        "related_record_id": legal_action_id,
        "requires_signature": requires_sig,
    }).execute()

    await log_agent_action(
        lease_id=lease_id,
        action_category="legal",
        action_description=f"Issued {notice_type} to {ctx.tenant.full_name}. Reason: {reason}",
        tools_called=[{"tool": "issue_legal_notice", "input": inp}],
        output_summary=f"Legal action ID: {legal_action_id}. Deadline: {deadline_display}.",
        confidence_score=0.95,
    )

    notice_desc = _NOTICE_DESCRIPTIONS.get(notice_type, "A formal notice")

    return ToolResult(
        success=True,
        is_high_severity=True,
        landlord_notification_message=(
            f"Legal notice ({notice_type}) has been issued to {ctx.tenant.full_name}. "
            f"Response deadline: {deadline_display}."
        ),
        data={
            "legal_action_id": legal_action_id,
            "notice_type": notice_type,
            "response_deadline": deadline_display,
            "document_url": document_url,
            "message": (
                f"{notice_desc} has been issued. The deadline for response is {deadline_display}."
            ),
        },
    )


async def _update_escalation_level(inp: dict[str, Any], ctx: TenantContext) -> ToolResult:
    lease_id = ctx.lease.id
    new_level = int(inp["new_level"])
    reason = inp["reason"]

    current_threads: dict[str, Any] = {}
    if (
        ctx.conversation_context
        and isinstance(ctx.conversation_context.open_threads, dict)
    ):
        current_threads = dict(ctx.conversation_context.open_threads)

    updated_threads = {
        **current_threads,
        "escalation_level": new_level,
        "escalation_reason": reason,
        "escalation_updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await update_conversation_context(
        lease_id=lease_id,
        summary=ctx.conversation_context.summary if ctx.conversation_context else "",
        open_threads=updated_threads,
    )

    await log_agent_action(
        lease_id=lease_id,
        action_category="escalation",
        action_description=(
            f"Escalation level changed from {ctx.escalation_level} to {new_level}. Reason: {reason}"
        ),
        tools_called=[{"tool": "update_escalation_level", "input": inp}],
        output_summary=f"New level: {new_level}",
        confidence_score=1.0,
    )

    is_high_severity = new_level >= 3

    if is_high_severity:
        sb = _sb()
        sb.table("landlord_notifications").insert({
            "landlord_id": ctx.landlord_id,
            "lease_id": lease_id,
            "notification_type": "general",
            "message": (
                f"Escalation level updated to {new_level}/4 for {ctx.tenant.full_name} "
                f"at {ctx.unit.unit_identifier}. Reason: {reason}"
            ),
            "requires_signature": new_level == 4,
        }).execute()

    return ToolResult(
        success=True,
        is_high_severity=is_high_severity,
        data={
            "previous_level": ctx.escalation_level,
            "new_level": new_level,
            "direction": "escalated" if new_level > ctx.escalation_level else "de-escalated",
        },
    )


def _compute_deadline_days(notice_type: str, jurisdiction: str) -> int:
    if notice_type == "section_8":
        return 28 if jurisdiction == "scotland" else 14
    if notice_type == "section_21":
        return 182 if jurisdiction == "wales" else 56
    if notice_type == "payment_demand":
        return 7
    return 14


_NOTICE_DESCRIPTIONS: dict[str, str] = {
    "section_8": "A Section 8 Notice Seeking Possession",
    "section_21": "A Section 21 Notice to Quit",
    "payment_demand": "A formal payment demand",
    "formal_notice": "A formal written notice",
    "lease_violation_notice": "A lease violation notice",
    "payment_plan_agreement": "A payment plan agreement",
}
