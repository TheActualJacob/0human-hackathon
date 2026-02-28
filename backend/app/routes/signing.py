from __future__ import annotations

import base64
import io
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["signing"])


def _sb():
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class SignRequest(BaseModel):
    signature_data_url: str


@router.get("/api/sign/{token}")
async def get_signing_page_data(token: str):
    sb = _sb()
    res = sb.table("signing_tokens").select("*").eq("id", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Signing link not found")

    row = res.data

    if row.get("signed_at"):
        raise HTTPException(status_code=410, detail="This document has already been signed")

    expires_at = row.get("expires_at")
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="This signing link has expired")
        except ValueError:
            pass

    return {
        "token": token,
        "prospect_name": row.get("prospect_name"),
        "unit_address": row.get("unit_address"),
        "monthly_rent": row.get("monthly_rent"),
        "lease_content": row.get("lease_content"),
    }


@router.post("/api/sign/{token}")
async def submit_signature(token: str, body: SignRequest):
    sb = _sb()
    token_res = sb.table("signing_tokens").select("*").eq("id", token).maybe_single().execute()
    if not token_res or not token_res.data:
        raise HTTPException(status_code=404, detail="Signing link not found")

    row = token_res.data

    if row.get("signed_at"):
        raise HTTPException(status_code=410, detail="Already signed")

    expires_at = row.get("expires_at")
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Signing link has expired")
        except ValueError:
            pass

    pdf_url: str | None = None
    try:
        pdf_bytes = _generate_signed_lease_pdf(row, body.signature_data_url)
        filename = f"signed_lease_{token[:8]}_{datetime.now().strftime('%Y%m%d')}.pdf"
        upload_res = sb.storage.from_("leases-signed").upload(filename, pdf_bytes, {"content-type": "application/pdf", "upsert": "false"})
        if upload_res:
            pdf_url = sb.storage.from_("leases-signed").get_public_url(filename)
    except Exception as exc:
        print(f"Signed PDF generation/upload error: {exc}")

    signed_at = datetime.now(timezone.utc).isoformat()

    sb.table("signing_tokens").update({
        "signature_data_url": body.signature_data_url,
        "signed_at": signed_at,
        "pdf_url": pdf_url,
    }).eq("id", token).execute()

    prospect_id = row.get("prospect_id")
    if prospect_id:
        sb.table("prospects").update({"status": "signed", "updated_at": signed_at}).eq("id", prospect_id).execute()

    _activate_lease_from_signing(row, sb)
    _notify_landlord_signed(row, pdf_url)
    await _send_signed_confirmation(row, pdf_url)

    return {"signed": True, "pdf_url": pdf_url}


def _generate_signed_lease_pdf(token_row: dict, signature_data_url: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle("header", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"), alignment=2)
    title_style = ParagraphStyle("title", parent=styles["Normal"], fontSize=16, fontName="Helvetica-Bold", textColor=colors.black, alignment=1, spaceAfter=8)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=11, leading=16, spaceAfter=6)
    label_style = ParagraphStyle("label", parent=styles["Normal"], fontSize=10, fontName="Helvetica-Bold", spaceAfter=2)
    footer_style = ParagraphStyle("footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#888888"), alignment=1)

    today_str = datetime.now(timezone.utc).strftime("%d %B %Y at %H:%M UTC")
    prospect_name = token_row.get("prospect_name", "Tenant")
    unit_address = token_row.get("unit_address", "")
    monthly_rent = token_row.get("monthly_rent")
    lease_content = token_row.get("lease_content", "")

    story = [
        Paragraph("PropAI Property Management — Signed Tenancy Agreement", header_style),
        Paragraph(today_str, header_style),
        Spacer(1, 8*mm),
        Paragraph("TENANCY AGREEMENT", title_style),
        Spacer(1, 2*mm),
        Paragraph(f"Tenant: {prospect_name}", body_style),
    ]
    if unit_address:
        story.append(Paragraph(f"Property: {unit_address}", body_style))
    if monthly_rent:
        story.append(Paragraph(f"Monthly Rent: £{float(monthly_rent):.2f}", body_style))
    story += [Spacer(1, 4*mm), HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")), Spacer(1, 4*mm)]

    for para in lease_content.split("\n\n"):
        text = para.replace("\n", "<br/>").strip()
        if text:
            story.append(Paragraph(text, body_style))
            story.append(Spacer(1, 2*mm))

    story += [
        Spacer(1, 8*mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 4*mm),
        Paragraph("SIGNATURES", title_style),
        Spacer(1, 4*mm),
        Paragraph(f"Tenant: {prospect_name}", label_style),
        Paragraph(f"Signed digitally on: {today_str}", body_style),
    ]

    sig_image = _decode_signature_image(signature_data_url)
    if sig_image:
        story.append(Image(sig_image, width=60*mm, height=20*mm))

    story += [
        Spacer(1, 8*mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 3*mm),
        Paragraph("This tenancy agreement has been digitally signed via PropAI. The digital signature is legally binding under the Electronic Communications Act 2000.", footer_style),
        Paragraph(f"Document token: {token_row.get('id', '')[:8]}", footer_style),
    ]

    doc.build(story)
    return buf.getvalue()


def _decode_signature_image(data_url: str) -> io.BytesIO | None:
    try:
        if "," not in data_url:
            return None
        _, encoded = data_url.split(",", 1)
        return io.BytesIO(base64.b64decode(encoded))
    except Exception:
        return None


def _activate_lease_from_signing(token_row: dict, sb) -> None:
    """
    After a lease is signed (web or conversational), create the live records:
      - leases row with status='active'
      - tenants row for the new tenant
      - unit_status upsert → 'occupied'

    The unit is identified via: signing_tokens.application_id
                                → lease_applications.unit_id
    """
    try:
        application_id = token_row.get("application_id")
        if not application_id:
            print("[Signing] No application_id on token — skipping lease activation")
            return

        app_res = (
            sb.table("lease_applications")
            .select("unit_id, full_name, email, monthly_income")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
        if not app_res or not app_res.data:
            print(f"[Signing] Application {application_id} not found — skipping activation")
            return

        app = app_res.data
        unit_id = app.get("unit_id")
        if not unit_id:
            print("[Signing] Application has no unit_id — skipping lease activation")
            return

        # Fetch landlord_id from the unit
        unit_res = sb.table("units").select("landlord_id").eq("id", unit_id).maybe_single().execute()
        landlord_id = unit_res.data.get("landlord_id") if (unit_res and unit_res.data) else None

        today = datetime.now(timezone.utc).date()
        end_date = today.replace(year=today.year + 1)

        monthly_rent = token_row.get("monthly_rent")
        deposit = float(monthly_rent) * 5 / 52 * 4 if monthly_rent else None  # ~4 weeks deposit

        # Create the active lease
        lease_res = sb.table("leases").insert({
            "unit_id": unit_id,
            "start_date": today.isoformat(),
            "end_date": end_date.isoformat(),
            "monthly_rent": float(monthly_rent) if monthly_rent else None,
            "deposit_amount": round(deposit, 2) if deposit else None,
            "status": "active",
            "renewal_status": "pending",
        }).execute()

        if not lease_res.data:
            print("[Signing] Failed to insert lease — skipping tenant/unit_status creation")
            return

        lease_id = lease_res.data[0]["id"]
        prospect_phone = token_row.get("prospect_phone", "")

        # Create the tenant record
        sb.table("tenants").insert({
            "lease_id": lease_id,
            "full_name": token_row.get("prospect_name") or app.get("full_name", ""),
            "email": app.get("email", ""),
            "whatsapp_number": prospect_phone or None,
            "is_primary_tenant": True,
        }).execute()

        # Mark the unit as occupied (upsert in case a row already exists)
        sb.table("unit_status").upsert({
            "unit_id": unit_id,
            "occupancy_status": "occupied",
            "move_in_date": today.isoformat(),
        }, on_conflict="unit_id").execute()

        # Notify landlord if we have their ID
        if landlord_id:
            tenant_name = token_row.get("prospect_name") or app.get("full_name", "Tenant")
            unit_address = token_row.get("unit_address", "")
            try:
                sb.table("landlord_notifications").insert({
                    "landlord_id": landlord_id,
                    "lease_id": lease_id,
                    "notification_type": "general",
                    "message": (
                        f"{tenant_name} has signed their tenancy agreement"
                        + (f" for {unit_address}" if unit_address else "")
                        + ". The unit has been marked as occupied and the lease is now active."
                    ),
                    "requires_signature": False,
                }).execute()
            except Exception as notify_exc:
                print(f"[Signing] Landlord notification error: {notify_exc}")

        print(f"[Signing] Lease {lease_id} activated for unit {unit_id}")

    except Exception as exc:
        print(f"[Signing] Lease activation error: {exc}")


def _notify_landlord_signed(token_row: dict, pdf_url: str | None) -> None:
    try:
        sb = _sb()
        landlords_res = sb.table("landlords").select("*").limit(1).execute()
        if landlords_res and landlords_res.data:
            landlord = landlords_res.data[0]
            pdf_str = f" Signed PDF: {pdf_url}" if pdf_url else ""
            sb.table("landlord_notifications").insert({
                "landlord_id": landlord["id"],
                "notification_type": "general",
                "message": (
                    f"{token_row.get('prospect_name', 'Applicant')} has signed their tenancy agreement"
                    + (f" for {token_row.get('unit_address', '')}" if token_row.get("unit_address") else "")
                    + f".{pdf_str}"
                ),
                "requires_signature": False,
            }).execute()
    except Exception as exc:
        print(f"Landlord signed notification error: {exc}")


async def _send_signed_confirmation(token_row: dict, pdf_url: str | None) -> None:
    from app.services.twilio_service import send_whatsapp_message, send_whatsapp_media

    prospect_phone = token_row.get("prospect_phone", "")
    if not prospect_phone:
        return

    prospect_name = token_row.get("prospect_name", "there")
    unit_str = f" for {token_row['unit_address']}" if token_row.get("unit_address") else ""
    wa_number = f"whatsapp:{prospect_phone}" if not prospect_phone.startswith("whatsapp:") else prospect_phone

    body = (
        f"Hi {prospect_name}, your tenancy agreement{unit_str} has been signed successfully! "
        f"Your signed copy is attached below. Welcome — the team will be in touch with next steps."
    )

    try:
        if pdf_url:
            await send_whatsapp_media(wa_number, body, pdf_url)
        else:
            await send_whatsapp_message(wa_number, body)
    except Exception as exc:
        print(f"Failed to send signed confirmation via WhatsApp: {exc}")


def generate_lease_preview_pdf(
    applicant_name: str,
    unit_address: str,
    monthly_rent: float | None,
    lease_content: str,
) -> bytes:
    """Generate an unsigned lease agreement PDF for sending as a preview."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle("header", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"), alignment=2)
    title_style = ParagraphStyle("title", parent=styles["Normal"], fontSize=16, fontName="Helvetica-Bold", textColor=colors.black, alignment=1, spaceAfter=8)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=11, leading=16, spaceAfter=6)
    note_style = ParagraphStyle("note", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#555555"), alignment=1, spaceAfter=4)

    story = [
        Paragraph("PropAI Property Management — Tenancy Agreement (For Review)", header_style),
        Spacer(1, 8 * mm),
        Paragraph("TENANCY AGREEMENT", title_style),
        Paragraph("Please review this agreement carefully before signing.", note_style),
        Spacer(1, 2 * mm),
        Paragraph(f"Tenant: {applicant_name}", body_style),
    ]
    if unit_address:
        story.append(Paragraph(f"Property: {unit_address}", body_style))
    if monthly_rent:
        story.append(Paragraph(f"Monthly Rent: £{float(monthly_rent):.2f}", body_style))

    story += [
        Spacer(1, 4 * mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 4 * mm),
    ]

    for para in lease_content.split("\n\n"):
        text = para.replace("\n", "<br/>").strip()
        if text:
            story.append(Paragraph(text, body_style))
            story.append(Spacer(1, 2 * mm))

    story += [
        Spacer(1, 8 * mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 4 * mm),
        Paragraph("AWAITING SIGNATURE", title_style),
        Paragraph("This document has not yet been signed. Please use the signing link sent to you to review and sign digitally.", note_style),
    ]

    doc.build(story)
    return buf.getvalue()
