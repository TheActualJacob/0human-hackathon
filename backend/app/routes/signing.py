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
        sb.storage.from_("leases-signed").upload(filename, pdf_bytes, {"content-type": "application/pdf", "upsert": "true"})
        pdf_url = sb.storage.from_("leases-signed").get_public_url(filename)
    except Exception as exc:
        import traceback
        print(f"Signed PDF generation/upload error: {exc}")
        traceback.print_exc()

    signed_at = datetime.now(timezone.utc).isoformat()

    sb.table("signing_tokens").update({
        "signature_data_url": body.signature_data_url,
        "signed_at": signed_at,
        "pdf_url": pdf_url,
    }).eq("id", token).execute()

    prospect_id = row.get("prospect_id")
    if prospect_id:
        sb.table("prospects").update({"status": "signed", "updated_at": signed_at}).eq("id", prospect_id).execute()

    # Activate the lease associated with this tenant
    prospect_phone = row.get("prospect_phone", "")
    if prospect_phone:
        try:
            tenant_res = (
                sb.table("tenants")
                .select("lease_id")
                .eq("whatsapp_number", prospect_phone)
                .maybe_single()
                .execute()
            )
            if tenant_res and tenant_res.data and tenant_res.data.get("lease_id"):
                lease_id = tenant_res.data["lease_id"]
                sb.table("leases").update({
                    "status": "active",
                    "lease_document_url": pdf_url,
                }).eq("id", lease_id).execute()
                print(f"Lease {lease_id} activated after signing")
                try:
                    from app.services.payments import generate_payments_for_lease
                    result = await generate_payments_for_lease(lease_id)
                    print(f"Generated {result.created} payment records for lease {lease_id}")
                except Exception as pay_exc:
                    print(f"Warning: could not generate payments for lease {lease_id}: {pay_exc}")
        except Exception as exc:
            print(f"Failed to activate lease: {exc}")

    _notify_landlord_signed(row, pdf_url)
    await _send_signed_confirmation(row, pdf_url)

    return {"signed": True, "pdf_url": pdf_url}


def _generate_signed_lease_pdf(token_row: dict, signature_data_url: str) -> bytes:
    today_str = datetime.now(timezone.utc).strftime("%d %B %Y at %H:%M UTC")
    prospect_name = token_row.get("prospect_name", "Tenant")
    unit_address = token_row.get("unit_address", "")
    monthly_rent = token_row.get("monthly_rent")
    lease_content = token_row.get("lease_content", "")
    token_id = token_row.get("id", "")

    sig_image = _decode_signature_image(signature_data_url)

    buf = io.BytesIO()
    story = _build_pdf_story(
        lease_content=lease_content,
        prospect_name=prospect_name,
        unit_address=unit_address,
        monthly_rent=monthly_rent,
        signed_at=today_str,
        token_id=token_id,
        sig_image=sig_image,
    )
    _render_pdf(buf, story)
    return buf.getvalue()


def _build_pdf_story(
    lease_content: str,
    prospect_name: str,
    unit_address: str,
    monthly_rent,
    signed_at: str | None = None,
    token_id: str = "",
    sig_image: io.BytesIO | None = None,
) -> list:
    import re
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import Paragraph, Spacer, HRFlowable, Table, TableStyle, Image

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("title", parent=styles["Normal"], fontSize=15, fontName="Helvetica-Bold", textColor=colors.black, alignment=TA_CENTER, spaceAfter=4)
    section_style = ParagraphStyle("section", parent=styles["Normal"], fontSize=11, fontName="Helvetica-Bold", textColor=colors.black, alignment=TA_LEFT, spaceBefore=8, spaceAfter=3)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=15, alignment=TA_JUSTIFY, spaceAfter=4)
    meta_label_style = ParagraphStyle("meta_label", parent=styles["Normal"], fontSize=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#333333"))
    meta_value_style = ParagraphStyle("meta_value", parent=styles["Normal"], fontSize=10, textColor=colors.black)
    header_left_style = ParagraphStyle("hdr_left", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#555555"), alignment=TA_LEFT)
    header_right_style = ParagraphStyle("hdr_right", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#555555"), alignment=TA_RIGHT)
    footer_style = ParagraphStyle("footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#888888"), alignment=TA_CENTER)
    sig_note_style = ParagraphStyle("sig_note", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#666666"), alignment=TA_CENTER)

    PAGE_W = 170 * mm  # usable width (210mm A4 minus 20mm margins each side)

    story = []

    # ── Header: company left, date right ──
    date_str = signed_at or datetime.now(timezone.utc).strftime("%d %B %Y")
    header_table = Table(
        [[Paragraph("PropAI Property Management", header_left_style),
          Paragraph(date_str, header_right_style)]],
        colWidths=[PAGE_W * 0.6, PAGE_W * 0.4],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(header_table)
    story.append(Spacer(1, 5 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#222222")))
    story.append(Spacer(1, 5 * mm))

    # ── Document title ──
    story.append(Paragraph("TENANCY AGREEMENT", title_style))
    story.append(Spacer(1, 5 * mm))

    # ── Key-info table ──
    rent_str = f"£{float(monthly_rent):.2f}" if monthly_rent else "As agreed"
    info_rows = [
        [Paragraph("TENANT", meta_label_style), Paragraph(prospect_name, meta_value_style)],
        [Paragraph("PROPERTY", meta_label_style), Paragraph(unit_address or "—", meta_value_style)],
        [Paragraph("MONTHLY RENT", meta_label_style), Paragraph(rent_str, meta_value_style)],
    ]
    info_table = Table(info_rows, colWidths=[PAGE_W * 0.28, PAGE_W * 0.72])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#cccccc")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    # ── Lease body: detect numbered section headers ──
    section_header_re = re.compile(r"^\d+[\.\)]\s+[A-Z]")
    for block in lease_content.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()
        first_line = lines[0].strip()
        if section_header_re.match(first_line):
            # Bold header line, then body for the rest
            story.append(Paragraph(first_line, section_style))
            rest = "\n".join(lines[1:]).strip()
            if rest:
                story.append(Paragraph(rest.replace("\n", "<br/>"), body_style))
        else:
            story.append(Paragraph(block.replace("\n", "<br/>"), body_style))
        story.append(Spacer(1, 1 * mm))

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 5 * mm))

    # ── Signatures ──
    story.append(Paragraph("SIGNATURES", title_style))
    story.append(Spacer(1, 5 * mm))

    LINE = "_" * 42

    if sig_image:
        tenant_sig_content = Image(sig_image, width=55 * mm, height=18 * mm)
    else:
        tenant_sig_content = Paragraph("<i>AWAITING TENANT SIGNATURE</i>", sig_note_style)

    tenant_label = Paragraph(
        f"<b>Tenant:</b> {prospect_name}" + (f"<br/>Signed: {signed_at}" if signed_at else ""),
        sig_note_style,
    )
    landlord_label = Paragraph("<b>Landlord / Agent</b><br/>Signature: " + LINE, sig_note_style)

    sig_table = Table(
        [[tenant_sig_content, landlord_label]],
        colWidths=[PAGE_W * 0.5, PAGE_W * 0.5],
    )
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#aaaaaa")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#aaaaaa")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 4 * mm))
    story.append(tenant_label)

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "This tenancy agreement has been digitally signed via PropAI. "
        "The digital signature is legally binding under the Electronic Communications Act 2000.",
        footer_style,
    ))
    if token_id:
        story.append(Paragraph(f"Document ref: {token_id[:8]}", footer_style))

    return story


def _render_pdf(buf: io.BytesIO, story: list) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )
    doc.build(story)


def _decode_signature_image(data_url: str) -> io.BytesIO | None:
    try:
        if "," not in data_url:
            return None
        _, encoded = data_url.split(",", 1)
        return io.BytesIO(base64.b64decode(encoded))
    except Exception:
        return None


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
    buf = io.BytesIO()
    story = _build_pdf_story(
        lease_content=lease_content,
        prospect_name=applicant_name,
        unit_address=unit_address,
        monthly_rent=monthly_rent,
        signed_at=None,
        token_id="",
        sig_image=None,
    )
    _render_pdf(buf, story)
    return buf.getvalue()
