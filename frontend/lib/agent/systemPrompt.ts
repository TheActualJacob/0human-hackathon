import { TenantContext } from './contextLoader'
import { format, differenceInDays } from 'date-fns'

const ESCALATION_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'CONVERSATIONAL — Resolve informally and helpfully via WhatsApp. Keep tone friendly but professional.',
  2: 'FORMAL WRITTEN — Issue official written notices. Tone is formal. Document all communications.',
  3: 'LEGAL PROCESS — Statutory notices are being issued. Reference specific legislation. Track deadlines.',
  4: 'PRE-TRIBUNAL — Case file is being compiled. All actions require landlord notification. Human signature may be required.',
}

const JURISDICTION_RULES: Record<string, string> = {
  england_wales: `
JURISDICTION: England & Wales
- Section 8 Notice: Requires 14 days minimum notice (rent arrears Ground 8, 10, 11)
- Section 21 Notice: Requires 2 months minimum notice, cannot be served in first 4 months of tenancy
- Deposit must be protected within 30 days of receipt
- Tenant right to repair: Landlord must respond to urgent repairs within 24 hours, routine within 28 days
- Rent increase notice: Minimum 1 month written notice required
- HMO licensing required for properties with 5+ unrelated occupants
`.trim(),
  scotland: `
JURISDICTION: Scotland
- Notice to Leave: 28 days minimum (up to 84 days if tenant has lived there 6+ months)
- Private Residential Tenancy (PRT) is the standard tenancy — no fixed end date
- Deposit must be protected with an approved scheme within 30 working days
- Rent increase: 3 months minimum written notice, tenant can challenge via Rent Officer
- Eviction requires tribunal order from First-tier Tribunal for Scotland
`.trim(),
  northern_ireland: `
JURISDICTION: Northern Ireland
- Notice to Quit: Minimum 4 weeks for tenancies under 10 years, 8 weeks for 10+ years
- Deposit protected within 28 days of receipt
- Landlord must register with Landlord Registration Scheme
- Rent increase: 8 weeks minimum written notice
`.trim(),
  wales: `
JURISDICTION: Wales
- Renting Homes (Wales) Act 2016 applies
- Section 173 Notice (equivalent of S21): 6 months minimum notice
- Section 159 Notice (equivalent of S8): Grounds-based, minimum 1 month notice
- Deposit protected within 30 days
- Fitness for Human Habitation requirements apply
`.trim(),
}

export function buildSystemPrompt(ctx: TenantContext): string {
  const jurisdictionRules =
    JURISDICTION_RULES[ctx.unit.jurisdiction ?? 'england_wales'] ??
    JURISDICTION_RULES['england_wales']

  const escalationDesc =
    ESCALATION_LEVEL_DESCRIPTIONS[ctx.escalationLevel] ??
    ESCALATION_LEVEL_DESCRIPTIONS[1]

  const paymentSummary = buildPaymentSummary(ctx)
  const maintenanceSummary = buildMaintenanceSummary(ctx)
  const legalSummary = buildLegalSummary(ctx)
  const conversationSummary = ctx.conversationContext?.summary ?? 'No prior conversation history.'

  const leaseStatus = ctx.lease.status ?? 'unknown'
  const monthlyRent = ctx.lease.monthly_rent
  const leaseEnd = ctx.lease.end_date
    ? format(new Date(ctx.lease.end_date), 'dd MMM yyyy')
    : 'Periodic tenancy (no fixed end date)'

  return `You are an autonomous AI property manager operating on behalf of a landlord. You communicate directly with tenants via WhatsApp.

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
- Name: ${ctx.tenant.full_name}
- WhatsApp: ${ctx.tenant.whatsapp_number}
- Property: ${ctx.unit.unit_identifier}, ${ctx.unit.address}, ${ctx.unit.city}
- Monthly Rent: £${monthlyRent}
- Lease Status: ${leaseStatus}
- Lease End: ${leaseEnd}

## CURRENT ESCALATION LEVEL: ${ctx.escalationLevel}/4
${escalationDesc}

## PAYMENT STATUS
${paymentSummary}

## OPEN MAINTENANCE REQUESTS
${maintenanceSummary}

## OPEN LEGAL ACTIONS
${legalSummary}

## CONVERSATION HISTORY SUMMARY
${conversationSummary}

## JURISDICTION RULES (USE THESE DATES — DO NOT INVENT OTHERS)
${jurisdictionRules}

## AVAILABLE TOOLS
Use tools to take real actions. Always use a tool if an action is warranted — do not just promise to do something. After using a tool, inform the tenant of the outcome concisely.

## RESPONSE FORMAT
- Keep WhatsApp messages under 300 words
- Use plain text only — no markdown, no bullet points with asterisks (use plain hyphens or numbers if needed)
- Be direct and professional
- End with a clear next step or ask if they need anything else`
}

function buildPaymentSummary(ctx: TenantContext): string {
  if (ctx.recentPayments.length === 0) {
    return 'No payment records found.'
  }

  const lines = ctx.recentPayments.map((p) => {
    const due = format(new Date(p.due_date), 'dd MMM yyyy')
    const paid = p.paid_date ? format(new Date(p.paid_date), 'dd MMM yyyy') : 'not paid'
    const arrears = p.amount_due - (p.amount_paid ?? 0)
    return `${due}: £${p.amount_due} due — status: ${p.status}${arrears > 0 ? ` (£${arrears} outstanding)` : ''}, paid: ${paid}`
  })

  const totalArrears = ctx.recentPayments.reduce(
    (sum, p) => sum + (p.amount_due - (p.amount_paid ?? 0)),
    0
  )

  let summary = lines.join('\n')
  if (totalArrears > 0) {
    summary += `\nTOTAL ARREARS: £${totalArrears}`
  }
  if (ctx.activePaymentPlan) {
    summary += `\nACTIVE PAYMENT PLAN: £${ctx.activePaymentPlan.installment_amount} ${ctx.activePaymentPlan.installment_frequency} — status: ${ctx.activePaymentPlan.status}`
  }
  return summary
}

function buildMaintenanceSummary(ctx: TenantContext): string {
  if (ctx.openMaintenanceRequests.length === 0) {
    return 'No open maintenance requests.'
  }
  return ctx.openMaintenanceRequests
    .map((m) => {
      const age = differenceInDays(new Date(), new Date(m.created_at!))
      return `[${m.urgency?.toUpperCase()}] ${m.category}: ${m.description} — status: ${m.status} (${age} days old)`
    })
    .join('\n')
}

function buildLegalSummary(ctx: TenantContext): string {
  if (ctx.openLegalActions.length === 0 && ctx.openDisputes.length === 0) {
    return 'No open legal actions or disputes.'
  }

  const actions = ctx.openLegalActions.map((a) => {
    const deadline = a.response_deadline
      ? ` — deadline: ${format(new Date(a.response_deadline), 'dd MMM yyyy')}`
      : ''
    return `${a.action_type}: ${a.status}${deadline}`
  })

  const disputes = ctx.openDisputes.map(
    (d) => `DISPUTE (${d.category}): ${d.status} — ${d.description.slice(0, 80)}`
  )

  return [...actions, ...disputes].join('\n')
}
