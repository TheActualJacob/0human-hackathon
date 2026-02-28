from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.prospect_context_loader import ProspectContext, update_prospect


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@dataclass
class ProspectToolResult:
    success: bool
    data: Any = None
    error: str | None = None


PROSPECT_AGENT_TOOLS = [
    {
        "name": "get_property_listings",
        "description": (
            "Returns up-to-date details about properties that are currently available to rent. "
            "Use this when the prospect asks for property details, prices, bedrooms, location, "
            "or any specific information about available rentals."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_city": {"type": "string", "description": "Optional city name to filter results."},
                "max_rent": {"type": "number", "description": "Optional maximum monthly rent in GBP."},
            },
            "required": [],
        },
    },
    {
        "name": "send_application_link",
        "description": (
            "Sends the prospect a link to the online rental application form. "
            "Call this when the prospect expresses clear interest in applying for a specific property."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "unit_id": {"type": "string", "description": "The ID of the unit the prospect wants to apply for."},
                "unit_description": {"type": "string", "description": "Short description of the unit for the confirmation message."},
            },
            "required": ["unit_id", "unit_description"],
        },
    },
    {
        "name": "sign_lease_agreement",
        "description": (
            "Completes the lease signing on behalf of the prospect when they have explicitly confirmed "
            "they accept all terms of the tenancy agreement. Only call this after the prospect has "
            "clearly and unambiguously stated they agree to the lease — do not call it based on vague "
            "responses. There must be a pending lease agreement (shown in PENDING LEASE AGREEMENT section). "
            "Records the prospect's digital consent and generates a signed PDF."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "consent_statement": {
                    "type": "string",
                    "description": "The exact words the prospect used to confirm their agreement to the lease.",
                },
            },
            "required": ["consent_statement"],
        },
    },
]


async def execute_prospect_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    ctx: ProspectContext,
) -> ProspectToolResult:
    if tool_name == "get_property_listings":
        return await _get_property_listings(tool_input, ctx)
    elif tool_name == "send_application_link":
        return await _send_application_link(tool_input, ctx)
    elif tool_name == "sign_lease_agreement":
        return await _sign_lease_agreement(tool_input, ctx)
    else:
        return ProspectToolResult(success=False, error=f"Unknown tool: {tool_name}")


async def _get_property_listings(inp: dict[str, Any], ctx: ProspectContext) -> ProspectToolResult:
    sb = _sb()
    units_res = sb.table("units").select("*, leases(status, monthly_rent)").execute()
    all_units = units_res.data or []

    filter_city = (inp.get("filter_city") or "").lower()
    max_rent = inp.get("max_rent")

    listings = []
    for u in all_units:
        leases = u.get("leases") or []
        if any(l.get("status") == "active" for l in leases):
            continue
        rent: float | None = None
        for l in leases:
            if l.get("monthly_rent"):
                rent = float(l["monthly_rent"])
                break
        if filter_city and filter_city not in (u.get("city") or "").lower():
            continue
        if max_rent and rent and rent > max_rent:
            continue
        listings.append({
            "id": u["id"],
            "unit_identifier": u.get("unit_identifier"),
            "address": u.get("address"),
            "city": u.get("city"),
            "postcode": u.get("postcode"),
            "monthly_rent": rent,
            "jurisdiction": u.get("jurisdiction"),
        })

    return ProspectToolResult(success=True, data={"listings": listings, "count": len(listings)})


async def _send_application_link(inp: dict[str, Any], ctx: ProspectContext) -> ProspectToolResult:
    unit_id = inp.get("unit_id", "")
    unit_description = inp.get("unit_description", "the property")

    app_url = settings.FRONTEND_URL or "http://localhost:3000"
    application_link = f"{app_url}/apply/{ctx.prospect_id}"

    await update_prospect(ctx.prospect_id, {"interested_unit_id": unit_id})

    return ProspectToolResult(
        success=True,
        data={
            "application_link": application_link,
            "unit_id": unit_id,
            "message": f"Application link sent for {unit_description}. The prospect should visit: {application_link}",
        },
    )


async def _sign_lease_agreement(inp: dict[str, Any], ctx: ProspectContext) -> ProspectToolResult:
    """
    Conversational lease signing — called when the prospect confirms agreement via
    WhatsApp or Instagram DM instead of the web signing page.
    """
    if not ctx.pending_signing_token:
        return ProspectToolResult(
            success=False,
            error="No pending lease agreement found for this prospect.",
        )

    token_row = ctx.pending_signing_token
    token_id = token_row.get("id")
    consent_statement = inp.get("consent_statement", "")
    channel = ctx.source_channel  # 'whatsapp' or 'instagram_dm'

    from datetime import datetime, timezone
    from app.routes.signing import _generate_signed_lease_pdf, _activate_lease_from_signing

    sb = _sb()
    signed_at = datetime.now(timezone.utc).isoformat()

    # Build a text-based signature data URL that records the consent
    channel_label = "WhatsApp" if channel == "whatsapp" else "Instagram DM"
    sig_text = (
        f"Digitally signed via {channel_label} on {datetime.now(timezone.utc).strftime('%d %B %Y at %H:%M UTC')}.\n"
        f"Consent statement: \"{consent_statement}\""
    )
    # Encode as a plain-text data URL so the PDF renderer can display it
    import base64
    sig_b64 = base64.b64encode(sig_text.encode()).decode()
    signature_data_url = f"data:text/plain;base64,{sig_b64}"

    # Generate the signed PDF
    pdf_url: str | None = None
    try:
        pdf_bytes = _generate_signed_lease_pdf(token_row, signature_data_url)
        filename = f"signed_lease_{token_id[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
        upload_res = sb.storage.from_("leases-signed").upload(
            filename, pdf_bytes, {"content-type": "application/pdf", "upsert": "false"}
        )
        if upload_res:
            pdf_url = sb.storage.from_("leases-signed").get_public_url(filename)
    except Exception as exc:
        print(f"[ProspectTool] Signed PDF error: {exc}")

    # Mark the token as signed
    sb.table("signing_tokens").update({
        "signature_data_url": signature_data_url,
        "signed_at": signed_at,
        "pdf_url": pdf_url,
    }).eq("id", token_id).execute()

    # Update prospect status
    sb.table("prospects").update({
        "status": "signed",
        "updated_at": signed_at,
    }).eq("id", ctx.prospect_id).execute()

    # Activate the lease — creates leases, tenants, unit_status records
    # Merge signed_at into token_row for the activation function
    _activate_lease_from_signing({**token_row, "signed_at": signed_at}, sb)

    # Send the signed PDF back to the prospect if we have a URL
    if pdf_url:
        try:
            if channel == "whatsapp":
                from app.services.twilio_service import send_whatsapp_media
                prospect_phone = token_row.get("prospect_phone", "")
                if prospect_phone:
                    wa_number = prospect_phone if prospect_phone.startswith("whatsapp:") else f"whatsapp:{prospect_phone}"
                    await send_whatsapp_media(
                        wa_number,
                        f"Your signed tenancy agreement is attached. Welcome — we'll be in touch with next steps!",
                        pdf_url,
                    )
            elif channel == "instagram_dm":
                from app.services.instagram_dm_service import send_instagram_dm
                # Instagram DMs can't send files, so just mention the PDF link
                await send_instagram_dm(
                    ctx.phone_number.removeprefix("ig:"),
                    f"Your lease has been signed! Your signed copy is available here: {pdf_url}",
                )
        except Exception as exc:
            print(f"[ProspectTool] Error sending signed PDF: {exc}")

    unit_address = token_row.get("unit_address", "the property")
    monthly_rent = token_row.get("monthly_rent")
    rent_str = f" (£{float(monthly_rent):.0f}/month)" if monthly_rent else ""

    return ProspectToolResult(
        success=True,
        data={
            "signed": True,
            "pdf_url": pdf_url,
            "message": (
                f"Lease signed successfully for {unit_address}{rent_str}. "
                f"The unit has been marked as occupied and a signed copy has been sent."
            ),
        },
    )
