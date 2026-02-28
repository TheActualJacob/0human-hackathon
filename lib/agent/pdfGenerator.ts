import PDFDocument from 'pdfkit'
import { supabaseAdmin } from '../supabase/server'
import { format } from 'date-fns'
import { TenantContext } from './contextLoader'

interface GeneratedDocument {
  buffer: Buffer
  filename: string
  templateUsed: string
  legalBasis: string | null
}

export async function generateLegalNotice(
  noticeType: string,
  ctx: TenantContext,
  reason: string
): Promise<GeneratedDocument> {
  const jurisdiction = ctx.unit.jurisdiction ?? 'england_wales'

  // Fetch template from Supabase
  const { data: template, error } = await supabaseAdmin
    .from('document_templates')
    .select('*')
    .eq('jurisdiction', jurisdiction)
    .eq('document_type', noticeType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  let templateBody: string
  let legalBasis: string | null = null
  let templateUsed: string

  if (error || !template) {
    // Fall back to built-in templates if no DB template exists
    templateBody = getBuiltInTemplate(noticeType, jurisdiction)
    templateUsed = `built-in:${noticeType}:${jurisdiction}`
  } else {
    templateBody = template.template_body
    legalBasis = template.legal_basis
    templateUsed = `db:${template.id}:v${template.version}`
  }

  // Fill in placeholders
  const today = format(new Date(), 'dd MMMM yyyy')
  const deadlineDate = computeDeadline(noticeType, jurisdiction)

  const filled = templateBody
    .replace(/\{\{tenant_name\}\}/g, ctx.tenant.full_name)
    .replace(/\{\{property_address\}\}/g, `${ctx.unit.unit_identifier}, ${ctx.unit.address}, ${ctx.unit.city}`)
    .replace(/\{\{today_date\}\}/g, today)
    .replace(/\{\{monthly_rent\}\}/g, `£${ctx.lease.monthly_rent}`)
    .replace(/\{\{notice_date\}\}/g, today)
    .replace(/\{\{deadline_date\}\}/g, deadlineDate)
    .replace(/\{\{reason\}\}/g, reason)
    .replace(/\{\{lease_start\}\}/g, format(new Date(ctx.lease.start_date), 'dd MMMM yyyy'))
    .replace(
      /\{\{lease_end\}\}/g,
      ctx.lease.end_date ? format(new Date(ctx.lease.end_date), 'dd MMMM yyyy') : 'Periodic tenancy'
    )

  const buffer = await renderPDF(filled, noticeType, ctx)
  const filename = `${noticeType}_${ctx.tenant.full_name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`

  return { buffer, filename, templateUsed, legalBasis }
}

async function renderPDF(content: string, noticeType: string, ctx: TenantContext): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('AI Property Management — Formal Notice', { align: 'right' })
      .text(format(new Date(), 'dd MMMM yyyy'), { align: 'right' })
      .moveDown(1)

    // Title
    const title = NOTICE_TITLES[noticeType] ?? noticeType.replace(/_/g, ' ').toUpperCase()
    doc
      .fontSize(16)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text(title, { align: 'center' })
      .moveDown(1)

    // Address block
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(`To: ${ctx.tenant.full_name}`)
      .text(`Property: ${ctx.unit.unit_identifier}, ${ctx.unit.address}, ${ctx.unit.city}`)
      .moveDown(1)

    // Divider
    doc
      .moveTo(60, doc.y)
      .lineTo(doc.page.width - 60, doc.y)
      .strokeColor('#cccccc')
      .stroke()
      .moveDown(1)

    // Body
    doc
      .fontSize(11)
      .fillColor('#000000')
      .font('Helvetica')
      .text(content, { lineGap: 4 })
      .moveDown(2)

    // Footer
    doc
      .fontSize(9)
      .fillColor('#888888')
      .text(
        'This notice has been issued by an autonomous AI property management system on behalf of the landlord. This document constitutes a formal legal notice.',
        { align: 'center' }
      )
      .moveDown(0.5)
      .text('Document reference: ' + Date.now().toString(36).toUpperCase(), { align: 'center' })

    doc.end()
  })
}

function computeDeadline(noticeType: string, jurisdiction: string): string {
  const today = new Date()
  let daysToAdd = 14 // default

  if (noticeType === 'section_8') {
    daysToAdd = jurisdiction === 'scotland' ? 28 : 14
  } else if (noticeType === 'section_21') {
    daysToAdd = jurisdiction === 'wales' ? 182 : 56 // 6 months Wales, 2 months E&W
  } else if (noticeType === 'payment_demand') {
    daysToAdd = 7
  } else if (noticeType === 'formal_notice') {
    daysToAdd = 14
  } else if (noticeType === 'lease_violation_notice') {
    daysToAdd = 14
  }

  const deadline = new Date(today)
  deadline.setDate(deadline.getDate() + daysToAdd)
  return format(deadline, 'dd MMMM yyyy')
}

const NOTICE_TITLES: Record<string, string> = {
  section_8: 'NOTICE SEEKING POSSESSION — SECTION 8',
  section_21: 'NOTICE TO QUIT — SECTION 21',
  payment_demand: 'FORMAL PAYMENT DEMAND',
  formal_notice: 'FORMAL NOTICE',
  lease_violation_notice: 'NOTICE OF LEASE VIOLATION',
  payment_plan_agreement: 'PAYMENT PLAN AGREEMENT',
}

function getBuiltInTemplate(noticeType: string, jurisdiction: string): string {
  const templates: Record<string, string> = {
    payment_demand: `Dear {{tenant_name}},

This is a formal notice regarding outstanding rent payments at {{property_address}}.

As of {{today_date}}, your account shows arrears in respect of your tenancy at the above address. Monthly rent of {{monthly_rent}} is payable under your tenancy agreement dated {{lease_start}}.

You are required to clear all outstanding arrears in full by {{deadline_date}}.

Failure to make payment by this date may result in further legal action being taken, including an application to court for possession of the property.

Please contact this office immediately to discuss your account.

This notice was issued on {{notice_date}}.`,

    formal_notice: `Dear {{tenant_name}},

FORMAL NOTICE — {{property_address}}

We write to you formally regarding your tenancy at the above property.

The matter relates to: {{reason}}

You are required to address this matter by {{deadline_date}}.

This notice is issued under the terms of your tenancy agreement dated {{lease_start}} and applicable legislation.

Please respond to this notice within the timeframe stated.

Issued: {{notice_date}}`,

    section_8: `Dear {{tenant_name}},

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

After {{deadline_date}}, the landlord may apply to court for possession. The court may not issue an order for possession on the fixed term grounds unless you are given this notice first.

Issued: {{notice_date}}`,

    section_21: `Dear {{tenant_name}},

NOTICE REQUIRING POSSESSION

To: {{tenant_name}}
Of: {{property_address}}

The landlord gives you notice that possession is required of the dwelling house known as {{property_address}}.

You are required to leave by {{deadline_date}}.

This notice is given under Section 21 of the Housing Act 1988 as amended by the Housing Act 1996.

If you do not leave by the date specified above, your landlord may apply to court for an order requiring you to leave.

Reason for notice: {{reason}}

Issued: {{notice_date}}`,

    lease_violation_notice: `Dear {{tenant_name}},

NOTICE OF LEASE VIOLATION

Property: {{property_address}}
Notice Date: {{notice_date}}

This letter is to notify you of a violation of your tenancy agreement.

Nature of violation: {{reason}}

You are required to remedy this violation by {{deadline_date}}.

Failure to remedy this breach may result in further action being taken under your tenancy agreement.

This notice is issued under the terms of your tenancy agreement dated {{lease_start}}.

Issued: {{notice_date}}`,

    payment_plan_agreement: `PAYMENT PLAN AGREEMENT

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
Date: {{today_date}}`,
  }

  return templates[noticeType] ?? templates['formal_notice']
}
