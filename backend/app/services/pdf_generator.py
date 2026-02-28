from __future__ import annotations

import base64
import io
from datetime import datetime, timedelta, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.platypus.flowables import HRFlowable
from supabase import create_client

from app.config import settings
from app.services.context_loader import TenantContext


NOTICE_TITLES: dict[str, str] = {
    "section_8": "NOTICE SEEKING POSSESSION — SECTION 8",
    "section_21": "NOTICE TO QUIT — SECTION 21",
    "payment_demand": "FORMAL PAYMENT DEMAND",
    "formal_notice": "FORMAL NOTICE",
    "lease_violation_notice": "NOTICE OF LEASE VIOLATION",
    "payment_plan_agreement": "PAYMENT PLAN AGREEMENT",
}


async def generate_legal_notice(
    notice_type: str,
    ctx: TenantContext,
    reason: str,
) -> tuple[bytes, str]:
    """Generate a PDF legal notice. Returns (pdf_bytes, filename)."""
    jurisdiction = ctx.unit.jurisdiction or "england_wales"

    # Try to fetch template from DB
    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    template_res = (
        sb.table("document_templates")
        .select("*")
        .eq("jurisdiction", jurisdiction)
        .eq("document_type", notice_type)
        .order("version", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    if template_res and template_res.data:
        template_body = template_res.data["template_body"]
    else:
        template_body = _get_builtin_template(notice_type)

    today = datetime.now(timezone.utc)
    today_str = today.strftime("%d %B %Y")
    deadline_days = _deadline_days(notice_type, jurisdiction)
    deadline_str = (today + timedelta(days=deadline_days)).strftime("%d %B %Y")
    lease_end = (
        _fmt_date(ctx.lease.end_date) if ctx.lease.end_date else "Periodic tenancy"
    )

    filled = (
        template_body
        .replace("{{tenant_name}}", ctx.tenant.full_name)
        .replace("{{property_address}}", f"{ctx.unit.unit_identifier}, {ctx.unit.address}, {ctx.unit.city}")
        .replace("{{today_date}}", today_str)
        .replace("{{monthly_rent}}", f"£{ctx.lease.monthly_rent:.2f}")
        .replace("{{notice_date}}", today_str)
        .replace("{{deadline_date}}", deadline_str)
        .replace("{{reason}}", reason)
        .replace("{{lease_start}}", _fmt_date(ctx.lease.start_date))
        .replace("{{lease_end}}", lease_end)
    )

    pdf_bytes = _render_pdf(filled, notice_type, ctx)
    safe_name = ctx.tenant.full_name.replace(" ", "_")
    filename = f"{notice_type}_{safe_name}_{today.strftime('%Y%m%d')}.pdf"

    return pdf_bytes, filename


def _fmt_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso[:10]).strftime("%d %B %Y")
    except Exception:
        return iso


def _deadline_days(notice_type: str, jurisdiction: str) -> int:
    if notice_type == "section_8":
        return 28 if jurisdiction == "scotland" else 14
    if notice_type == "section_21":
        return 182 if jurisdiction == "wales" else 56
    if notice_type == "payment_demand":
        return 7
    return 14


def _render_pdf(content: str, notice_type: str, ctx: TenantContext) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        "header", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"), alignment=2
    )
    title_style = ParagraphStyle(
        "title", parent=styles["Normal"], fontSize=16, fontName="Helvetica-Bold",
        textColor=colors.black, alignment=1, spaceAfter=8
    )
    address_style = ParagraphStyle(
        "address", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#333333"), spaceAfter=4
    )
    body_style = ParagraphStyle(
        "body", parent=styles["Normal"], fontSize=11, leading=16, spaceAfter=6
    )
    footer_style = ParagraphStyle(
        "footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#888888"), alignment=1
    )

    today_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    title = NOTICE_TITLES.get(notice_type, notice_type.replace("_", " ").upper())
    doc_ref = base64.b32encode(str(int(datetime.now().timestamp())).encode()).decode()[:8]

    story = [
        Paragraph("AI Property Management — Formal Notice", header_style),
        Paragraph(today_str, header_style),
        Spacer(1, 8 * mm),
        Paragraph(title, title_style),
        Spacer(1, 4 * mm),
        Paragraph(f"To: {ctx.tenant.full_name}", address_style),
        Paragraph(f"Property: {ctx.unit.unit_identifier}, {ctx.unit.address}, {ctx.unit.city}", address_style),
        Spacer(1, 4 * mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 4 * mm),
    ]

    # Body paragraphs — split on double newlines to preserve layout
    for para in content.split("\n\n"):
        text = para.replace("\n", "<br/>")
        story.append(Paragraph(text, body_style))
        story.append(Spacer(1, 2 * mm))

    story += [
        Spacer(1, 8 * mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 3 * mm),
        Paragraph(
            "This notice has been issued by an autonomous AI property management system on behalf of the landlord. "
            "This document constitutes a formal legal notice.",
            footer_style,
        ),
        Paragraph(f"Document reference: {doc_ref}", footer_style),
    ]

    doc.build(story)
    return buf.getvalue()


def _get_builtin_template(notice_type: str) -> str:
    templates = {
        "payment_demand": """Dear {{tenant_name}},

This is a formal notice regarding outstanding rent payments at {{property_address}}.

As of {{today_date}}, your account shows arrears in respect of your tenancy at the above address. Monthly rent of {{monthly_rent}} is payable under your tenancy agreement dated {{lease_start}}.

You are required to clear all outstanding arrears in full by {{deadline_date}}.

Failure to make payment by this date may result in further legal action being taken, including an application to court for possession of the property.

Please contact this office immediately to discuss your account.

This notice was issued on {{notice_date}}.""",

        "formal_notice": """Dear {{tenant_name}},

FORMAL NOTICE — {{property_address}}

We write to you formally regarding your tenancy at the above property.

The matter relates to: {{reason}}

You are required to address this matter by {{deadline_date}}.

This notice is issued under the terms of your tenancy agreement dated {{lease_start}} and applicable legislation.

Please respond to this notice within the timeframe stated.

Issued: {{notice_date}}""",

        "section_8": """Dear {{tenant_name}},

NOTICE SEEKING POSSESSION OF A PROPERTY LET ON AN ASSURED TENANCY OR AN ASSURED AGRICULTURAL OCCUPANCY

To: {{tenant_name}}
Of: {{property_address}}

The landlord/licensor gives you notice that they intend to apply to the court for an order requiring you to give up possession of:

{{property_address}}

On the grounds set out in Schedule 2 to the Housing Act 1988 as amended by the Housing Act 1996.

The grounds are:
Ground 8 — The tenant owed at least 2 months' rent both when the landlord served this notice and at the date of the court hearing.
Ground 10 — Some rent lawfully due from the tenant is unpaid.
Ground 11 — The tenant has persistently delayed paying rent which has become lawfully due.

Particulars of grounds: {{reason}}

After {{deadline_date}}, the landlord may apply to court for possession.

Issued: {{notice_date}}""",

        "section_21": """Dear {{tenant_name}},

NOTICE REQUIRING POSSESSION

To: {{tenant_name}}
Of: {{property_address}}

The landlord gives you notice that possession is required of the dwelling house known as {{property_address}}.

You are required to leave by {{deadline_date}}.

This notice is given under Section 21 of the Housing Act 1988 as amended by the Housing Act 1996.

If you do not leave by the date specified above, your landlord may apply to court for an order requiring you to leave.

Reason for notice: {{reason}}

Issued: {{notice_date}}""",

        "lease_violation_notice": """Dear {{tenant_name}},

NOTICE OF LEASE VIOLATION

Property: {{property_address}}
Notice Date: {{notice_date}}

This letter is to notify you of a violation of your tenancy agreement.

Nature of violation: {{reason}}

You are required to remedy this violation by {{deadline_date}}.

Failure to remedy this breach may result in further action being taken under your tenancy agreement.

This notice is issued under the terms of your tenancy agreement dated {{lease_start}}.

Issued: {{notice_date}}""",

        "payment_plan_agreement": """PAYMENT PLAN AGREEMENT

Between: Landlord (represented by AI Property Management)
And: {{tenant_name}} of {{property_address}}
Date: {{today_date}}

This agreement sets out the terms under which outstanding rent arrears will be repaid.

Property: {{property_address}}
Monthly Rent: {{monthly_rent}}
Agreement Date: {{today_date}}

The parties agree that all arrears will be repaid according to the schedule agreed separately.

Breach of this payment plan may result in formal legal action being taken without further notice.

Signed (on behalf of Landlord): AI Property Management System
Date: {{today_date}}""",
    }
    return templates.get(notice_type, templates["formal_notice"])
