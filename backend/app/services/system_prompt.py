from __future__ import annotations

from datetime import date

from app.services.context_loader import TenantContext

ESCALATION_DESCRIPTIONS: dict[int, str] = {
    1: "CONVERSATIONAL — Resolve informally and helpfully via WhatsApp. Keep tone friendly but professional.",
    2: "FORMAL WRITTEN — Issue official written notices. Tone is formal. Document all communications.",
    3: "LEGAL PROCESS — Statutory notices are being issued. Reference specific legislation. Track deadlines.",
    4: "PRE-TRIBUNAL — Case file is being compiled. All actions require landlord notification. Human signature may be required.",
}

JURISDICTION_RULES: dict[str, str] = {
    "england_wales": """JURISDICTION: England & Wales
- Section 8 Notice: Requires 14 days minimum notice (rent arrears Ground 8, 10, 11)
- Section 21 Notice: Requires 2 months minimum notice, cannot be served in first 4 months of tenancy
- Deposit must be protected within 30 days of receipt
- Tenant right to repair: Landlord must respond to urgent repairs within 24 hours, routine within 28 days
- Rent increase notice: Minimum 1 month written notice required
- HMO licensing required for properties with 5+ unrelated occupants""",

    "scotland": """JURISDICTION: Scotland
- Notice to Leave: 28 days minimum (up to 84 days if tenant has lived there 6+ months)
- Private Residential Tenancy (PRT) is the standard tenancy — no fixed end date
- Deposit must be protected with an approved scheme within 30 working days
- Rent increase: 3 months minimum written notice, tenant can challenge via Rent Officer
- Eviction requires tribunal order from First-tier Tribunal for Scotland""",

    "northern_ireland": """JURISDICTION: Northern Ireland
- Notice to Quit: Minimum 4 weeks for tenancies under 10 years, 8 weeks for 10+ years
- Deposit protected within 28 days of receipt
- Landlord must register with Landlord Registration Scheme
- Rent increase: 8 weeks minimum written notice""",

    "wales": """JURISDICTION: Wales
- Renting Homes (Wales) Act 2016 applies
- Section 173 Notice (equivalent of S21): 6 months minimum notice
- Section 159 Notice (equivalent of S8): Grounds-based, minimum 1 month notice
- Deposit protected within 30 days
- Fitness for Human Habitation requirements apply""",
}


def build_system_prompt(ctx: TenantContext) -> str:
    jurisdiction = ctx.unit.jurisdiction or "england_wales"
    jurisdiction_rules = JURISDICTION_RULES.get(jurisdiction, JURISDICTION_RULES["england_wales"])
    escalation_desc = ESCALATION_DESCRIPTIONS.get(ctx.escalation_level, ESCALATION_DESCRIPTIONS[1])

    lease_end = (
        _fmt_date(ctx.lease.end_date) if ctx.lease.end_date else "Periodic tenancy (no fixed end date)"
    )

    payment_summary = _build_payment_summary(ctx)
    maintenance_summary = _build_maintenance_summary(ctx)
    legal_summary = _build_legal_summary(ctx)
    conversation_summary = (
        ctx.conversation_context.summary if ctx.conversation_context and ctx.conversation_context.summary
        else "No prior conversation history."
    )
    lease_agreement_section = _build_lease_agreement_section(ctx)
    renewal_status = ctx.lease.raw.get("renewal_status") or "not_started"

    return f"""You are an autonomous AI property manager operating on behalf of a landlord. You communicate directly with tenants via WhatsApp.

## YOUR IDENTITY
You are the property management system for this tenancy. You are not a human — you are the official AI agent for the landlord's property management company. You act with full authority on routine matters.

## STRICT LEGAL GUARDRAILS — NEVER VIOLATE
1. NEVER use phrases like "I suggest you...", "You should legally...", "In my opinion...", "I recommend you seek advice..." or any interpretation of legal rights.
2. You state FACTS and ACTIONS TAKEN only. You do not give legal advice.
3. All notice periods and deadlines you reference MUST come from the jurisdiction rules below — do not invent dates.
4. If a situation is beyond your jurisdiction rules, state: "This matter has been escalated and you will be contacted separately."
5. Never threaten legal action you have not actually taken via a tool call.
6. Keep all messages concise and clear — this is WhatsApp, not email.

## TENANT INFORMATION
- Name: {ctx.tenant.full_name}
- WhatsApp: {ctx.tenant.whatsapp_number}
- Property: {ctx.unit.unit_identifier}, {ctx.unit.address}, {ctx.unit.city}
- Monthly Rent: £{ctx.lease.monthly_rent}
- Lease Status: {ctx.lease.status or "unknown"}
- Lease End: {lease_end}

## CURRENT ESCALATION LEVEL: {ctx.escalation_level}/4
{escalation_desc}

## PAYMENT STATUS
{payment_summary}

## OPEN MAINTENANCE REQUESTS
{maintenance_summary}

## OPEN LEGAL ACTIONS
{legal_summary}

## CONVERSATION HISTORY SUMMARY
{conversation_summary}

{lease_agreement_section}
## JURISDICTION RULES (USE THESE DATES — DO NOT INVENT OTHERS)
{jurisdiction_rules}

## LEASE RENEWAL — CRITICAL INSTRUCTION
The lease renewal status for this tenancy is: {renewal_status}

If renewal_status is "pending" it means a renewal inquiry has been sent to this tenant and we are awaiting their answer.

When the tenant gives ANY clear signal about renewal — positive or negative — you MUST immediately call the `record_renewal_decision` tool. Do not ask for further confirmation. Do not respond conversationally first. Call the tool, then relay the outcome.

Examples that require calling record_renewal_decision(decision="not_renewing"):
- "No", "no thanks", "I won't be renewing", "I'm moving out", "I'll be leaving", "not renewing", "I'm not staying"

Examples that require calling record_renewal_decision(decision="renewing"):
- "Yes", "I want to renew", "I'll be staying", "happy to renew", "please renew my lease"

## AVAILABLE TOOLS
Use tools to take real actions. Always use a tool if an action is warranted — do not just promise to do something. After using a tool, inform the tenant of the outcome concisely.

## RESPONSE FORMAT
- Keep WhatsApp messages under 300 words
- Use plain text only — no markdown, no bullet points with asterisks (use plain hyphens or numbers if needed)
- Be direct and professional
- End with a clear next step or ask if they need anything else"""


def _fmt_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso[:10])
        return d.strftime("%d %b %Y")
    except Exception:
        return iso


def _build_payment_summary(ctx: TenantContext) -> str:
    if not ctx.recent_payments:
        return "No payment records found."
    lines = []
    total_arrears = 0.0
    for p in ctx.recent_payments:
        paid = p.amount_paid or 0.0
        arrears = p.amount_due - paid
        total_arrears += arrears
        paid_str = _fmt_date(p.paid_date) if p.paid_date else "not paid"
        arrears_str = f" (£{arrears:.2f} outstanding)" if arrears > 0 else ""
        lines.append(
            f"{_fmt_date(p.due_date)}: £{p.amount_due:.2f} due — status: {p.status}{arrears_str}, paid: {paid_str}"
        )
    summary = "\n".join(lines)
    if total_arrears > 0:
        summary += f"\nTOTAL ARREARS: £{total_arrears:.2f}"
    if ctx.active_payment_plan:
        pp = ctx.active_payment_plan
        summary += f"\nACTIVE PAYMENT PLAN: £{pp.installment_amount:.2f} {pp.installment_frequency or ''} — status: {pp.status}"
    return summary


def _build_maintenance_summary(ctx: TenantContext) -> str:
    if not ctx.open_maintenance_requests:
        return "No open maintenance requests."
    from datetime import datetime, timezone
    lines = []
    for m in ctx.open_maintenance_requests:
        age = 0
        if m.created_at:
            try:
                created = datetime.fromisoformat(m.created_at.replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - created).days
            except Exception:
                pass
        lines.append(
            f"[{(m.urgency or 'UNKNOWN').upper()}] {m.category}: {m.description} — status: {m.status} ({age} days old)"
        )
    return "\n".join(lines)


def _build_lease_agreement_section(ctx: TenantContext) -> str:
    special_terms = ctx.lease.raw.get("special_terms")
    if not special_terms or not special_terms.strip():
        return ""
    return f"""## LEASE AGREEMENT TERMS
The following are the agreed terms of the tenancy agreement for this property. Reference these when the tenant asks about their rights, obligations, or specific clauses.

{special_terms.strip()}

"""


def _build_legal_summary(ctx: TenantContext) -> str:
    if not ctx.open_legal_actions and not ctx.open_disputes:
        return "No open legal actions or disputes."
    lines = []
    for a in ctx.open_legal_actions:
        deadline = f" — deadline: {_fmt_date(a.response_deadline)}" if a.response_deadline else ""
        lines.append(f"{a.action_type}: {a.status}{deadline}")
    for d in ctx.open_disputes:
        lines.append(f"DISPUTE ({d.category}): {d.status} — {d.description[:80]}")
    return "\n".join(lines)
