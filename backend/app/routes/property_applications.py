from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

import anthropic
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.application_review_agent import (
    _load_lease_template,
    _upload_lease_preview_pdf,
)
from app.services.twilio_service import send_whatsapp_message, send_whatsapp_media

router = APIRouter(prefix="/api/property-applications", tags=["property-applications"])


def _sb():
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


_IMAGE_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


def _download_file(sb, url: str) -> tuple[str, str] | None:
    """
    Download a file from Supabase Storage.
    Returns (base64_data, media_type) or None on failure.
    """
    try:
        if "/application-documents/" not in url:
            return None
        storage_path = url.split("/application-documents/")[1].split("?")[0]
        ext = storage_path.rsplit(".", 1)[-1].lower() if "." in storage_path else ""
        media_type = _IMAGE_MEDIA_TYPES.get(ext, "application/pdf")
        file_bytes = sb.storage.from_("application-documents").download(storage_path)
        return base64.b64encode(file_bytes).decode(), media_type
    except Exception as exc:
        print(f"property_applications: could not download file from {url}: {exc}")
        return None


def _make_file_block(b64: str, media_type: str) -> dict:
    """Build a Claude content block appropriate for the media type."""
    if media_type.startswith("image/"):
        return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}
    return {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": b64}}


SELECT_TENANT_TOOL = {
    "name": "select_tenant",
    "description": (
        "Select the best tenant from the applicants provided. "
        "You MUST call this tool once you have reviewed all application details and documents."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "winner_application_id": {
                "type": "string",
                "description": "The application ID of the best candidate.",
            },
            "reason": {
                "type": "string",
                "description": (
                    "A friendly 2-3 sentence explanation of why this applicant was selected, "
                    "suitable for sending to them via WhatsApp."
                ),
            },
            "summary": {
                "type": "string",
                "description": "A brief 1-2 sentence summary for the landlord dashboard.",
            },
        },
        "required": ["winner_application_id", "reason", "summary"],
    },
}


@router.post("/select-best/{unit_id}")
async def select_best_tenant(unit_id: str):
    """
    AI reviews all pending applications for a unit, selects the best tenant,
    creates a lease, and sends it to the winner via WhatsApp.
    """
    sb = _sb()

    # 1. Fetch all pending applications with tenant + unit details
    apps_res = (
        sb.table("property_applications")
        .select("*, tenants(*), units(*)")
        .eq("unit_id", unit_id)
        .in_("status", ["pending", "under_review", "ai_screening"])
        .execute()
    )
    if not apps_res or not apps_res.data:
        raise HTTPException(status_code=404, detail="No pending applications found for this unit")

    applications = apps_res.data
    unit = applications[0].get("units") or {}

    monthly_rent: float | None = unit.get("rent_amount")
    unit_identifier = unit.get("unit_identifier", "")
    unit_address = f"{unit_identifier}, {unit.get('address', '')}, {unit.get('city', '')}".strip(", ")
    security_deposit: float | None = unit.get("security_deposit") or monthly_rent
    available_date: str | None = unit.get("available_date")

    rent_display = f"£{monthly_rent:,.2f}" if monthly_rent else "not specified"
    min_income = f"£{monthly_rent * 2.5:,.2f}" if monthly_rent else "N/A"

    # 2. Build Claude message: text + PDFs for each applicant
    message_content: list[dict] = []

    for i, app in enumerate(applications):
        applicant_data = app.get("applicant_data") or {}
        tenant = app.get("tenants") or {}

        applicant_text = (
            f"\n--- APPLICANT {i + 1} ---\n"
            f"Application ID: {app['id']}\n"
            f"Name: {applicant_data.get('fullName') or tenant.get('full_name', 'Unknown')}\n"
            f"Preferred Move-in: {applicant_data.get('preferredMoveInDate', 'ASAP')}\n"
            f"Number of Occupants: {applicant_data.get('numberOfOccupants', '1')}\n"
            f"Note: {applicant_data.get('note') or 'None'}\n"
            f"Applied: {app.get('created_at', 'Unknown')}\n"
        )
        message_content.append({"type": "text", "text": applicant_text})

        documents = (applicant_data.get("documents") or {})

        bank_url = documents.get("bankStatement")
        if bank_url:
            result = _download_file(sb, bank_url)
            if result:
                b64, media_type = result
                message_content.append({"type": "text", "text": f"Bank Statement for Applicant {i + 1}:"})
                message_content.append(_make_file_block(b64, media_type))

        income_url = documents.get("incomeProof")
        if income_url:
            result = _download_file(sb, income_url)
            if result:
                b64, media_type = result
                message_content.append({"type": "text", "text": f"Proof of Income for Applicant {i + 1}:"})
                message_content.append(_make_file_block(b64, media_type))

    message_content.append({
        "type": "text",
        "text": (
            f"\nProperty: {unit_address}\n"
            f"Monthly Rent: {rent_display}\n"
            f"Minimum Income Needed (2.5× rent): {min_income}\n\n"
            "Review all applicants above and call select_tenant with the best candidate's application ID."
        ),
    })

    # 3. Call Claude to select the winner
    system_prompt = (
        "You are an expert rental application reviewer for a residential letting agency.\n\n"
        "Compare all the applicants provided and select the single best candidate based on:\n"
        "1. Financial stability — monthly income must be at least 2.5× the rent (verify from bank statements)\n"
        "2. Employment/income stability — check income proof documents\n"
        "3. Earliest preferred move-in date\n"
        "4. Application completeness — all documents provided\n"
        "5. Fewer occupants generally preferred\n\n"
        "You MUST call the select_tenant tool with your final decision. Do not output free text."
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages: list[dict] = [{"role": "user", "content": message_content}]

    winner_application_id: str | None = None
    reason = ""
    summary = ""

    for _ in range(4):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system_prompt,
            tools=[SELECT_TENANT_TOOL],  # type: ignore[arg-type]
            messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                if block.name == "select_tenant":
                    winner_application_id = block.input.get("winner_application_id")
                    reason = block.input.get("reason", "")
                    summary = block.input.get("summary", reason)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"acknowledged": True}),
                    })
            messages.append({"role": "user", "content": tool_results})
            if winner_application_id:
                break
        elif response.stop_reason == "end_turn":
            break

    if not winner_application_id:
        raise HTTPException(status_code=500, detail="AI could not select a tenant — no decision reached")

    # 4. Locate the winning application
    winner = next((a for a in applications if a["id"] == winner_application_id), None)
    if not winner:
        raise HTTPException(
            status_code=500,
            detail=f"AI selected unknown application ID: {winner_application_id}"
        )

    winner_tenant = winner.get("tenants") or {}
    winner_applicant_data = winner.get("applicant_data") or {}
    applicant_name = winner_applicant_data.get("fullName") or winner_tenant.get("full_name", "Applicant")
    tenant_id: str | None = winner.get("tenant_id")
    tenant_phone: str = winner_tenant.get("whatsapp_number", "")

    now = datetime.now(timezone.utc).isoformat()

    # 5a. Mark winner as accepted
    sb.table("property_applications").update({
        "status": "accepted",
        "ai_screening_result": {"summary": summary, "reason": reason},
        "ai_screening_score": 0.9,
        "updated_at": now,
    }).eq("id", winner_application_id).execute()

    # 5a-immediate. Send a basic acceptance WhatsApp right away (before lease/signing steps)
    if tenant_phone:
        try:
            wa_number = f"whatsapp:{tenant_phone}" if not tenant_phone.startswith("whatsapp:") else tenant_phone
            await send_whatsapp_message(
                wa_number,
                f"Hi {applicant_name}, congratulations! Your application for {unit_address} has been approved. "
                f"We are preparing your tenancy agreement and will send it to you shortly."
            )
        except Exception as exc:
            print(f"property_applications: immediate acceptance WhatsApp failed: {exc}")

    # 5b. Reject all other applicants
    other_ids = [a["id"] for a in applications if a["id"] != winner_application_id]
    if other_ids:
        sb.table("property_applications").update({
            "status": "rejected",
            "updated_at": now,
        }).in_("id", other_ids).execute()

    # 5c–5g: Create lease, signing token, send WhatsApp.
    # Wrapped in try/except so the AI selection result is always returned
    # even if downstream steps fail.
    new_lease_id: str | None = None
    signing_link: str | None = None

    try:
        today = datetime.now(timezone.utc).date()
        lease_start = available_date or (today.replace(day=1) + relativedelta(months=1)).isoformat()

        lease_res = (
            sb.table("leases")
            .insert({
                "unit_id": unit_id,
                "start_date": lease_start,
                "monthly_rent": monthly_rent,
                "deposit_amount": security_deposit,
                "status": "pending",
            })
            .execute()
        )
        if lease_res and lease_res.data:
            new_lease_id = lease_res.data[0]["id"]

            # Link tenant to the new lease
            if tenant_id:
                sb.table("tenants").update({"lease_id": new_lease_id}).eq("id", tenant_id).execute()

            # Generate lease document text
            lease_content = _load_lease_template(sb, unit_id, applicant_name, unit_address, monthly_rent)

            # Create signing token
            # Note: application_id is NOT set here — it's a FK to lease_applications,
            # not property_applications, so passing winner_application_id would fail.
            token_insert: dict = {
                "lease_content": lease_content,
                "prospect_name": applicant_name,
                "prospect_phone": tenant_phone,
                "unit_address": unit_address,
                "monthly_rent": monthly_rent,
            }

            token_res = sb.table("signing_tokens").insert(token_insert).execute()

            if token_res and token_res.data:
                token_id = token_res.data[0]["id"]
                frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
                signing_link = f"{frontend_url}/sign/{token_id}"

                # Send WhatsApp with lease
                if tenant_phone:
                    wa_number = f"whatsapp:{tenant_phone}" if not tenant_phone.startswith("whatsapp:") else tenant_phone
                    rent_str = f"£{monthly_rent:,.0f}" if monthly_rent else "as agreed"
                    whatsapp_body = (
                        f"Hi {applicant_name}, great news — your application for {unit_address} has been approved! 🎉\n\n"
                        f"{reason}\n\n"
                        f"Monthly rent: {rent_str}. "
                        f"Please sign your tenancy agreement here (link expires in 7 days):\n{signing_link}"
                    )
                    pdf_url = _upload_lease_preview_pdf(
                        sb, token_id, applicant_name, unit_address, monthly_rent, lease_content
                    )
                    try:
                        if pdf_url:
                            await send_whatsapp_media(wa_number, whatsapp_body, pdf_url)
                        else:
                            await send_whatsapp_message(wa_number, whatsapp_body)
                        # Send link as a separate message so it's easy to copy-paste
                        await send_whatsapp_message(wa_number, signing_link)
                    except Exception as exc:
                        print(f"property_applications: WhatsApp send failed: {exc}")
            else:
                print("property_applications: failed to create signing token")
        else:
            print("property_applications: failed to create lease record")
    except Exception as exc:
        print(f"property_applications: post-selection steps failed: {exc}")

    return {
        "selected_application_id": winner_application_id,
        "tenant_name": applicant_name,
        "reason": reason,
        "summary": summary,
        "signing_link": signing_link,
        "lease_id": new_lease_id,
    }
