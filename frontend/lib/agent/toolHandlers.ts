import { supabaseAdmin } from '../supabase/server'
import { TenantContext, logAgentAction, updateConversationContext } from './contextLoader'
import { generateLegalNotice } from './pdfGenerator'
import { ToolName, ToolInput } from './tools'
import { format } from 'date-fns'

export type ToolResult = {
  success: boolean
  data?: unknown
  error?: string
  isHighSeverity?: boolean
  landlordNotificationMessage?: string
}

// Dispatch table
export async function executeTool<T extends ToolName>(
  toolName: T,
  input: ToolInput[T],
  ctx: TenantContext
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_rent_status':
      return getRentStatus(input as ToolInput['get_rent_status'], ctx)
    case 'schedule_maintenance':
      return scheduleMaintenance(input as ToolInput['schedule_maintenance'], ctx)
    case 'issue_legal_notice':
      return issueLegalNotice(input as ToolInput['issue_legal_notice'], ctx)
    case 'update_escalation_level':
      return updateEscalationLevel(input as ToolInput['update_escalation_level'], ctx)
    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

async function getRentStatus(
  input: ToolInput['get_rent_status'],
  ctx: TenantContext
): Promise<ToolResult> {
  const { data: payments, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('lease_id', input.lease_id)
    .order('due_date', { ascending: false })
    .limit(6)

  if (error) {
    return { success: false, error: `Failed to fetch payments: ${error.message}` }
  }

  const { data: paymentPlan } = await supabaseAdmin
    .from('payment_plans')
    .select('*')
    .eq('lease_id', input.lease_id)
    .eq('status', 'active')
    .maybeSingle()

  const totalArrears = (payments ?? []).reduce(
    (sum, p) => sum + (p.amount_due - (p.amount_paid ?? 0)),
    0
  )

  const result = {
    payments: (payments ?? []).map((p) => ({
      due_date: p.due_date,
      amount_due: p.amount_due,
      amount_paid: p.amount_paid,
      status: p.status,
      arrears: p.amount_due - (p.amount_paid ?? 0),
    })),
    total_arrears: totalArrears,
    active_payment_plan: paymentPlan
      ? {
          installment_amount: paymentPlan.installment_amount,
          frequency: paymentPlan.installment_frequency,
          status: paymentPlan.status,
        }
      : null,
  }

  await logAgentAction({
    leaseId: input.lease_id,
    actionCategory: 'payment',
    actionDescription: `Checked rent status. Total arrears: £${totalArrears}`,
    toolsCalled: [{ tool: 'get_rent_status', input }],
    outputSummary: `Total arrears: £${totalArrears}`,
    confidenceScore: 1.0,
  })

  return { success: true, data: result }
}

async function scheduleMaintenance(
  input: ToolInput['schedule_maintenance'],
  ctx: TenantContext
): Promise<ToolResult> {
  // Find best matching contractor for this trade
  const { data: contractors, error: contractorError } = await supabaseAdmin
    .from('contractors')
    .select('*')
    .eq('landlord_id', ctx.landlordId)
    .contains('trades', [input.category])

  const isEmergency = input.urgency === 'emergency'

  let selectedContractor = null
  if (!contractorError && contractors && contractors.length > 0) {
    // For emergencies, prefer emergency-available contractors
    const eligible = isEmergency
      ? contractors.filter((c) => c.emergency_available) ?? contractors
      : contractors
    selectedContractor = (eligible.length > 0 ? eligible : contractors)[0]
  }

  // Create the maintenance request
  const { data: request, error: requestError } = await supabaseAdmin
    .from('maintenance_requests')
    .insert({
      lease_id: input.lease_id,
      category: input.category as 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'heating' | 'pest' | 'damp' | 'access' | 'other',
      description: input.description,
      urgency: input.urgency,
      status: selectedContractor ? 'assigned' : 'open',
      contractor_id: selectedContractor?.id ?? null,
    })
    .select('id')
    .single()

  if (requestError) {
    return { success: false, error: `Failed to create maintenance request: ${requestError.message}` }
  }

  await logAgentAction({
    leaseId: input.lease_id,
    actionCategory: 'maintenance',
    actionDescription: `Scheduled ${input.urgency} maintenance: ${input.category} — ${input.description.slice(0, 80)}`,
    toolsCalled: [{ tool: 'schedule_maintenance', input }],
    outputSummary: selectedContractor
      ? `Assigned to ${selectedContractor.name}`
      : 'No contractor available, logged as open',
    confidenceScore: 0.9,
  })

  const isHighSeverity = isEmergency
  const landlordNotificationMessage = isHighSeverity
    ? `EMERGENCY MAINTENANCE logged at ${ctx.unit.unit_identifier}, ${ctx.unit.address}. Issue: ${input.description}. ${selectedContractor ? `Assigned to ${selectedContractor.name} (${selectedContractor.phone ?? 'no phone'}).` : 'No contractor assigned — action required.'}`
    : undefined

  return {
    success: true,
    isHighSeverity,
    landlordNotificationMessage,
    data: {
      request_id: request.id,
      status: selectedContractor ? 'assigned' : 'open',
      contractor: selectedContractor
        ? {
            name: selectedContractor.name,
            phone: selectedContractor.phone,
            email: selectedContractor.email,
            emergency_available: selectedContractor.emergency_available,
          }
        : null,
      message: selectedContractor
        ? `Maintenance request raised and assigned to ${selectedContractor.name}${selectedContractor.phone ? ` (${selectedContractor.phone})` : ''}.`
        : 'Maintenance request logged. A contractor will be assigned shortly.',
    },
  }
}

async function issueLegalNotice(
  input: ToolInput['issue_legal_notice'],
  ctx: TenantContext
): Promise<ToolResult> {
  // Generate the PDF
  let documentUrl: string | null = null
  try {
    const { buffer, filename } = await generateLegalNotice(input.notice_type, ctx, input.reason)

    // Upload PDF to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('legal-documents')
      .upload(`${input.lease_id}/${filename}`, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (!uploadError && uploadData) {
      const { data: publicUrl } = supabaseAdmin.storage
        .from('legal-documents')
        .getPublicUrl(uploadData.path)
      documentUrl = publicUrl.publicUrl
    }
  } catch (pdfError) {
    console.error('PDF generation/upload error:', pdfError)
    // Continue without PDF — still log the legal action
  }

  // Compute response deadline based on notice type and jurisdiction
  const deadlineDays = getDeadlineDays(input.notice_type, ctx.unit.jurisdiction ?? 'england_wales')
  const responseDeadline = new Date()
  responseDeadline.setDate(responseDeadline.getDate() + deadlineDays)

  // Log the legal action
  const { data: legalAction, error: legalError } = await supabaseAdmin
    .from('legal_actions')
    .insert({
      lease_id: input.lease_id,
      action_type: input.notice_type as 'formal_notice' | 'section_8' | 'section_21' | 'payment_demand' | 'lease_violation_notice' | 'payment_plan_agreement',
      document_url: documentUrl,
      response_deadline: responseDeadline.toISOString(),
      status: 'issued',
      agent_reasoning: input.reason,
    })
    .select('id')
    .single()

  if (legalError) {
    return { success: false, error: `Failed to log legal action: ${legalError.message}` }
  }

  // Notify landlord
  await supabaseAdmin.from('landlord_notifications').insert({
    landlord_id: ctx.landlordId,
    lease_id: input.lease_id,
    notification_type: 'legal_notice_issued',
    message: `Legal notice issued to ${ctx.tenant.full_name} at ${ctx.unit.unit_identifier}, ${ctx.unit.address}. Type: ${input.notice_type}. Reason: ${input.reason}. Deadline: ${format(responseDeadline, 'dd MMM yyyy')}.`,
    related_record_type: 'legal_actions',
    related_record_id: legalAction.id,
    requires_signature: ['section_8', 'section_21'].includes(input.notice_type),
  })

  await logAgentAction({
    leaseId: input.lease_id,
    actionCategory: 'legal',
    actionDescription: `Issued ${input.notice_type} to ${ctx.tenant.full_name}. Reason: ${input.reason}`,
    toolsCalled: [{ tool: 'issue_legal_notice', input }],
    outputSummary: `Legal action ID: ${legalAction.id}. Deadline: ${format(responseDeadline, 'dd MMM yyyy')}.`,
    confidenceScore: 0.95,
  })

  return {
    success: true,
    isHighSeverity: true,
    landlordNotificationMessage: `Legal notice (${input.notice_type}) has been issued to ${ctx.tenant.full_name}. Response deadline: ${format(responseDeadline, 'dd MMM yyyy')}.`,
    data: {
      legal_action_id: legalAction.id,
      notice_type: input.notice_type,
      response_deadline: format(responseDeadline, 'dd MMMM yyyy'),
      document_url: documentUrl,
      message: `${NOTICE_DESCRIPTIONS[input.notice_type] ?? 'A formal notice'} has been issued. The deadline for response is ${format(responseDeadline, 'dd MMMM yyyy')}.`,
    },
  }
}

async function updateEscalationLevel(
  input: ToolInput['update_escalation_level'],
  ctx: TenantContext
): Promise<ToolResult> {
  const currentThreads =
    ctx.conversationContext?.open_threads &&
    typeof ctx.conversationContext.open_threads === 'object' &&
    !Array.isArray(ctx.conversationContext.open_threads)
      ? (ctx.conversationContext.open_threads as Record<string, unknown>)
      : {}

  const updatedThreads: Record<string, unknown> = {
    ...currentThreads,
    escalation_level: input.new_level,
    escalation_reason: input.reason,
    escalation_updated_at: new Date().toISOString(),
  }

  await updateConversationContext(
    input.lease_id,
    ctx.conversationContext?.summary ?? '',
    updatedThreads
  )

  await logAgentAction({
    leaseId: input.lease_id,
    actionCategory: 'escalation',
    actionDescription: `Escalation level changed from ${ctx.escalationLevel} to ${input.new_level}. Reason: ${input.reason}`,
    toolsCalled: [{ tool: 'update_escalation_level', input }],
    outputSummary: `New level: ${input.new_level}`,
    confidenceScore: 1.0,
  })

  const isEscalating = input.new_level > ctx.escalationLevel
  const isHighSeverity = input.new_level >= 3

  if (isHighSeverity) {
    await supabaseAdmin.from('landlord_notifications').insert({
      landlord_id: ctx.landlordId,
      lease_id: input.lease_id,
      notification_type: 'general',
      message: `Escalation level updated to ${input.new_level}/4 for ${ctx.tenant.full_name} at ${ctx.unit.unit_identifier}. Reason: ${input.reason}`,
      requires_signature: input.new_level === 4,
    })
  }

  return {
    success: true,
    isHighSeverity,
    data: {
      previous_level: ctx.escalationLevel,
      new_level: input.new_level,
      direction: isEscalating ? 'escalated' : 'de-escalated',
    },
  }
}

function getDeadlineDays(noticeType: string, jurisdiction: string): number {
  if (noticeType === 'section_8') return jurisdiction === 'scotland' ? 28 : 14
  if (noticeType === 'section_21') return jurisdiction === 'wales' ? 182 : 56
  if (noticeType === 'payment_demand') return 7
  return 14
}

const NOTICE_DESCRIPTIONS: Record<string, string> = {
  section_8: 'A Section 8 Notice Seeking Possession',
  section_21: 'A Section 21 Notice to Quit',
  payment_demand: 'A formal payment demand',
  formal_notice: 'A formal written notice',
  lease_violation_notice: 'A lease violation notice',
  payment_plan_agreement: 'A payment plan agreement',
}
