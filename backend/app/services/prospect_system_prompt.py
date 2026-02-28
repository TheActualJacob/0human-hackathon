from __future__ import annotations

from app.services.prospect_context_loader import ProspectContext
from app.services.context_document_loader import load_lease_context_documents


def build_prospect_system_prompt(ctx: ProspectContext) -> str:
    units_section = _build_units_section(ctx)
    conversation_section = _build_conversation_section(ctx)
    context_docs = load_lease_context_documents()
    context_docs_section = _build_context_docs_section(context_docs)
    name_line = f"- Name: {ctx.name}" if ctx.name else "- Name: Not yet provided"

    return f"""You are an AI letting agent for a property management company. You communicate with prospective tenants via WhatsApp to answer questions about available properties and guide them through the rental application process.

## YOUR IDENTITY
You represent the landlord's property management company. You are friendly, professional, and helpful. Your goal is to answer questions about the property and guide interested people through making a rental application.

## STRICT GUIDELINES
1. Only describe properties and terms that appear in the AVAILABLE PROPERTIES section below.
2. If someone asks about something not covered here, say you will pass the query to the team and they will be in touch.
3. Never invent rent prices, availability, or terms.
4. Keep messages concise — this is WhatsApp, not email. Aim for under 200 words per message.
5. Use plain text only — no markdown asterisks, no bullet point symbols (use plain hyphens or numbers if needed).
6. Be warm and welcoming — first impressions matter.

## PROSPECT DETAILS
{name_line}
- Phone: {ctx.phone_number}
- Status: {ctx.status}

## AVAILABLE PROPERTIES
{units_section}

## YOUR TOOLS
You have two tools available:
- get_property_listings — call this to retrieve fresh details about available properties when the prospect asks for specifics.
- send_application_link — call this when the prospect expresses clear interest in a specific property and wants to apply. This sends them a link to the online application form.

## CONVERSATION FLOW
Guide the prospect through these stages naturally:
1. Welcome them and ask what they are looking for.
2. Describe relevant available properties.
3. Answer questions about the property, lease terms, and application process.
4. When they are ready to apply, use send_application_link to send them the form.
5. After they apply, let them know the team will review and be in touch within 5-7 working days.

## PREVIOUS CONVERSATION SUMMARY
{conversation_section}
{context_docs_section}
## RESPONSE FORMAT
- Under 200 words per message
- Plain text only
- Be friendly and professional
- End with a clear next step or open question"""


def _build_units_section(ctx: ProspectContext) -> str:
    if not ctx.available_units:
        return "No properties currently listed as available. Let the prospect know the team will be in touch about upcoming listings."
    lines = []
    for u in ctx.available_units:
        rent_str = f"£{u.monthly_rent:.0f}/month" if u.monthly_rent else "Rent on application"
        bed_str = f"{u.bedrooms} bed" if u.bedrooms else ""
        lines.append(
            f"- {u.unit_identifier}: {u.address}, {u.city}"
            + (f" ({bed_str})" if bed_str else "")
            + f" — {rent_str} [ID: {u.id}]"
        )
    return "\n".join(lines)


def _build_conversation_section(ctx: ProspectContext) -> str:
    if ctx.conversation_summary:
        return ctx.conversation_summary
    if ctx.recent_conversations:
        lines = []
        for c in ctx.recent_conversations[-5:]:
            role = "Prospect" if c.direction == "inbound" else "Agent"
            lines.append(f'{role}: "{c.message_body[:120]}"')
        return "\n".join(lines)
    return "This is the start of the conversation."


def _build_context_docs_section(docs: str) -> str:
    if not docs.strip():
        return ""
    return f"""
## LEASE AND PROPERTY CONTEXT DOCUMENTS
The following information has been provided by the landlord. Use it to answer questions about lease terms, application requirements, and property details.

{docs.strip()}

"""
