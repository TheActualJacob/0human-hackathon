from __future__ import annotations

import json
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

import anthropic
from supabase import create_client

from app.config import settings
from app.services.twilio_service import send_whatsapp_message


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


REVIEW_AGENT_TOOLS = [
    {
        "name": "make_decision",
        "description": (
            "Make a final approve or reject decision on the rental application. "
            "You MUST call this tool once you have reviewed the application details."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "decision": {
                    "type": "string",
                    "enum": ["approve", "reject"],
                    "description": "Whether to approve or reject the application.",
                },
                "reason": {
                    "type": "string",
                    "description": (
                        "A concise 2–3 sentence explanation of the decision, "
                        "suitable for communicating to the applicant."
                    ),
                },
            },
            "required": ["decision", "reason"],
        },
    }
]


def _build_review_system_prompt(
    application: dict,
    prospect: dict,
    unit: dict,
    monthly_rent: float | None,
) -> str:
    min_income = round(monthly_rent * 2.5, 2) if monthly_rent else "N/A"
    rent_display = f"£{monthly_rent:,.2f}" if monthly_rent else "Not specified"
    income_display = (
        f"£{float(application.get('monthly_income', 0)):,.2f}"
        if application.get("monthly_income") is not None
        else "Not provided"
    )
    unit_identifier = unit.get("unit_identifier", "")
    unit_address = (
        f"{unit_identifier}, {unit.get('address', '')}, {unit.get('city', '')} {unit.get('postcode', '')}".strip(", ")
        if unit
        else "Not specified"
    )

    return f"""You are an AI rental application reviewer for a residential property management company.

## Your Task
Carefully review the rental application below and make a FINAL decision: approve or reject.
You MUST call the `make_decision` tool with your decision and reason. Do not output free text — use the tool.

## Application Details
- **Applicant Name:** {application.get("full_name", "Not provided")}
- **Email:** {application.get("email", "Not provided")}
- **Phone:** {application.get("phone") or prospect.get("phone_number", "Not provided")}
- **Current Address:** {application.get("current_address") or "Not provided"}
- **Employment Status:** {application.get("employment_status") or "Not provided"}
- **Employer / Organisation:** {application.get("employer_name") or "Not provided"}
- **Monthly Income:** {income_display}

## Property Being Applied For
- **Unit:** {unit_address}
- **Monthly Rent:** {rent_display}

## References
{application.get("references_text") or "No references provided."}

## Additional Information
{application.get("additional_info") or "None."}

## Decision Criteria
Evaluate the application against these criteria in order of importance:

1. **Income:** Monthly income should be at least 2.5× the monthly rent.
   - Monthly rent: {rent_display}
   - Minimum required income: £{min_income}
   - Applicant income: {income_display}

2. **Employment Stability:** The applicant should have stable income — employed, self-employed, retired with pension, or documented benefits. Students and unemployed applicants require additional supporting info.

3. **References:** References should be present and should not mention prior evictions, rent arrears, or antisocial behaviour.

4. **Application Completeness:** Name, email, employment status, and income must be provided. Incomplete applications should be rejected.

5. **General Suitability:** Use good judgment. If the application is borderline, lean towards approving and give the benefit of the doubt.

## Instructions
- Call `make_decision` exactly once.
- Your `reason` should be friendly and concise — it will be sent directly to the applicant via WhatsApp.
- Do not reveal internal scoring details in the reason."""


def _load_lease_template(
    sb,
    unit_id: str | None,
    applicant_name: str,
    unit_address: str,
    monthly_rent: float | None,
) -> str:
    """Load a lease template and substitute applicant/unit placeholders."""
    # Determine lease start date: first of the month after today
    today = datetime.now(timezone.utc).date()
    start_date = (today.replace(day=1) + relativedelta(months=1)).isoformat()
    rent_str = f"£{monthly_rent:,.2f}" if monthly_rent else "as agreed"

    template_content = None

    # 1. Try document_templates table
    try:
        dt_res = (
            sb.table("document_templates")
            .select("content")
            .eq("template_type", "lease_agreement")
            .limit(1)
            .maybe_single()
            .execute()
        )
        if dt_res and dt_res.data and dt_res.data.get("content"):
            template_content = dt_res.data["content"]
    except Exception as exc:
        print(f"Review agent: could not query document_templates: {exc}")

    # 2. Try leases.special_terms for the same unit
    if not template_content and unit_id:
        try:
            lease_res = (
                sb.table("leases")
                .select("special_terms")
                .eq("unit_id", unit_id)
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            )
            if lease_res and lease_res.data and lease_res.data.get("special_terms"):
                template_content = lease_res.data["special_terms"]
        except Exception as exc:
            print(f"Review agent: could not query leases.special_terms: {exc}")

    # 3. Try any lease with special_terms as a final DB fallback
    if not template_content:
        try:
            any_lease_res = (
                sb.table("leases")
                .select("special_terms")
                .not_.is_("special_terms", "null")
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            )
            if any_lease_res and any_lease_res.data and any_lease_res.data.get("special_terms"):
                template_content = any_lease_res.data["special_terms"]
        except Exception as exc:
            print(f"Review agent: could not query any lease special_terms: {exc}")

    # 4. Minimal hard-coded fallback
    if not template_content:
        template_content = _DEFAULT_LEASE_TEMPLATE

    # Substitute placeholders
    replacements = {
        "{{tenant_name}}": applicant_name,
        "{{unit_address}}": unit_address,
        "{{monthly_rent}}": rent_str,
        "{{start_date}}": start_date,
        "[TENANT NAME]": applicant_name,
        "[PROPERTY ADDRESS]": unit_address,
        "[MONTHLY RENT]": rent_str,
        "[START DATE]": start_date,
    }
    for placeholder, value in replacements.items():
        template_content = template_content.replace(placeholder, value)

    return template_content


def _upload_lease_preview_pdf(
    sb,
    token_id: str,
    applicant_name: str,
    unit_address: str,
    monthly_rent: float | None,
    lease_content: str,
) -> str | None:
    """Generate an unsigned lease preview PDF, upload to Supabase Storage, return public URL."""
    try:
        from app.routes.signing import generate_lease_preview_pdf
        pdf_bytes = generate_lease_preview_pdf(applicant_name, unit_address, monthly_rent, lease_content)
        filename = f"lease_preview_{token_id[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
        upload_res = sb.storage.from_("leases-signed").upload(
            filename, pdf_bytes, {"content-type": "application/pdf", "upsert": "false"}
        )
        if upload_res:
            return sb.storage.from_("leases-signed").get_public_url(filename)
    except Exception as exc:
        print(f"Review agent: lease preview PDF generation/upload failed: {exc}")
    return None


async def _execute_approve(
    sb,
    application_id: str,
    application: dict,
    prospect: dict,
    unit: dict,
    monthly_rent: float | None,
    reason: str,
) -> None:
    unit_id = application.get("unit_id")
    unit_address = (
        f"{unit.get('unit_identifier', '')}, {unit.get('address', '')}, {unit.get('city', '')}".strip(", ")
        if unit else ""
    )
    applicant_name = application.get("full_name") or prospect.get("name") or "Applicant"

    lease_content = _load_lease_template(sb, unit_id, applicant_name, unit_address, monthly_rent)

    sb.table("lease_applications").update({
        "status": "approved",
        "landlord_notes": f"[AI reviewed] {reason}",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application_id).execute()

    prospect_id = application.get("prospect_id", "")
    sb.table("prospects").update({
        "status": "approved",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prospect_id).execute()

    token_res = sb.table("signing_tokens").insert({
        "prospect_id": prospect_id,
        "application_id": application_id,
        "lease_content": lease_content,
        "prospect_name": applicant_name,
        "prospect_phone": prospect.get("phone_number", ""),
        "unit_address": unit_address,
        "monthly_rent": monthly_rent,
    }).execute()

    if not token_res.data:
        print(f"Review agent: failed to create signing token for application {application_id}")
        return

    token_id = token_res.data[0]["id"]
    app_url = settings.FRONTEND_URL or "http://localhost:3000"
    signing_link = f"{app_url}/sign/{token_id}"

    sb.table("prospects").update({
        "status": "lease_sent",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prospect_id).execute()

    prospect_phone = prospect.get("phone_number", "")
    if prospect_phone:
        wa_number = f"whatsapp:{prospect_phone}" if not prospect_phone.startswith("whatsapp:") else prospect_phone
        approval_text = (
            f"Hi {applicant_name}, great news — your rental application has been approved!\n\n"
            f"{reason}\n\n"
            f"Your tenancy agreement is attached as a PDF for you to read. "
            f"When you're ready, sign it here (link expires in 7 days):\n{signing_link}"
        )
        # Try to generate and upload an unsigned lease PDF to send as attachment
        pdf_url = _upload_lease_preview_pdf(sb, token_id, applicant_name, unit_address, monthly_rent, lease_content)
        try:
            if pdf_url:
                from app.services.twilio_service import send_whatsapp_media
                await send_whatsapp_media(wa_number, approval_text, pdf_url)
            else:
                await send_whatsapp_message(wa_number, approval_text)
        except Exception as exc:
            print(f"Review agent: failed to send approval WhatsApp: {exc}")

    print(f"Review agent: approved application {application_id}, signing token {token_id}")


async def _execute_reject(
    sb,
    application_id: str,
    application: dict,
    prospect: dict,
    reason: str,
) -> None:
    sb.table("lease_applications").update({
        "status": "rejected",
        "landlord_notes": f"[AI reviewed] {reason}",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application_id).execute()

    prospect_id = application.get("prospect_id", "")
    sb.table("prospects").update({
        "status": "rejected",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prospect_id).execute()

    prospect_phone = prospect.get("phone_number", "")
    applicant_name = application.get("full_name") or prospect.get("name") or "there"
    if prospect_phone:
        message = (
            f"Hi {applicant_name}, thank you for applying.\n\n"
            f"Unfortunately we are unable to proceed with your application at this time. "
            f"{reason}\n\n"
            f"If you have any questions or would like to discuss this further, "
            f"please reply to this message."
        )
        try:
            wa_number = f"whatsapp:{prospect_phone}" if not prospect_phone.startswith("whatsapp:") else prospect_phone
            await send_whatsapp_message(wa_number, message)
        except Exception as exc:
            print(f"Review agent: failed to send rejection WhatsApp: {exc}")

    print(f"Review agent: rejected application {application_id}")


async def run_application_review(application_id: str) -> None:
    """AI agent that reviews a submitted rental application and approves or rejects it."""
    sb = _sb()

    app_res = (
        sb.table("lease_applications")
        .select("*, prospects(*), units(*)")
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    if not app_res or not app_res.data:
        print(f"Review agent: application {application_id} not found")
        return

    application = app_res.data
    prospect = application.get("prospects") or {}
    unit = application.get("units") or {}

    monthly_rent: float | None = None
    unit_id = application.get("unit_id")
    if unit_id:
        rent_res = (
            sb.table("leases")
            .select("monthly_rent")
            .eq("unit_id", unit_id)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if rent_res and rent_res.data and rent_res.data.get("monthly_rent"):
            monthly_rent = float(rent_res.data["monthly_rent"])

    system_prompt = _build_review_system_prompt(application, prospect, unit, monthly_rent)
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    messages: list[dict] = [
        {"role": "user", "content": "Please review this rental application and make a decision."}
    ]

    decision: str | None = None
    reason: str = ""

    for _ in range(4):
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=system_prompt,
            tools=REVIEW_AGENT_TOOLS,  # type: ignore[arg-type]
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                if block.name == "make_decision":
                    decision = block.input.get("decision")
                    reason = block.input.get("reason", "")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"acknowledged": True}),
                    })
            messages.append({"role": "user", "content": tool_results})
            if decision:
                break
        elif response.stop_reason == "end_turn":
            break

    if not decision:
        print(f"Review agent: no decision reached for application {application_id}")
        return

    if decision == "approve":
        await _execute_approve(sb, application_id, application, prospect, unit, monthly_rent, reason)
    else:
        await _execute_reject(sb, application_id, application, prospect, reason)


_DEFAULT_LEASE_TEMPLATE = """\
ASSURED SHORTHOLD TENANCY AGREEMENT

This agreement is made between the Landlord and the Tenant named below.

TENANT: {{tenant_name}}
PROPERTY: {{unit_address}}
MONTHLY RENT: {{monthly_rent}}
TENANCY START DATE: {{start_date}}
TENANCY TERM: 12 months (fixed term)

1. RENT
The Tenant agrees to pay the monthly rent of {{monthly_rent}} on the first day of each month,
in advance, by bank transfer or standing order.

2. DEPOSIT
A tenancy deposit equivalent to five weeks' rent is required before move-in. This will be
protected in a government-approved tenancy deposit scheme.

3. TENANT OBLIGATIONS
The Tenant agrees to:
(a) Pay rent on time and in full.
(b) Keep the property clean and in good condition.
(c) Not sublet the property or take in lodgers without written consent from the Landlord.
(d) Report any repairs or maintenance issues promptly.
(e) Allow access for inspections with reasonable notice (at least 24 hours).
(f) Not cause nuisance or annoyance to neighbours.

4. LANDLORD OBLIGATIONS
The Landlord agrees to:
(a) Keep the structure and exterior of the property in repair.
(b) Maintain installations for water, gas, electricity, and heating.
(c) Ensure the property meets all legal safety requirements.

5. NOTICE PERIODS
Either party may end the tenancy after the fixed term by giving at least 2 months' written
notice (Landlord) or 1 month's written notice (Tenant).

6. UTILITIES AND COUNCIL TAX
The Tenant is responsible for paying all utility bills and Council Tax during the tenancy.

7. GOVERNING LAW
This agreement is governed by the laws of England and Wales.

TENANT SIGNATURE: ___________________________  Date: ___________
LANDLORD SIGNATURE: ___________________________  Date: ___________
"""
