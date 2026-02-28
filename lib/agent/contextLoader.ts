import { supabaseAdmin } from '../supabase/server'
import { Database } from '../supabase/database.types'

type Tenant = Database['public']['Tables']['tenants']['Row']
type Lease = Database['public']['Tables']['leases']['Row']
type Unit = Database['public']['Tables']['units']['Row']
type Payment = Database['public']['Tables']['payments']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']
type ConversationContext = Database['public']['Tables']['conversation_context']['Row']
type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row']
type LegalAction = Database['public']['Tables']['legal_actions']['Row']
type Dispute = Database['public']['Tables']['disputes']['Row']
type PaymentPlan = Database['public']['Tables']['payment_plans']['Row']

export interface TenantContext {
  tenant: Tenant
  lease: Lease
  unit: Unit
  landlordId: string
  recentConversations: Conversation[]
  conversationContext: ConversationContext | null
  recentPayments: Payment[]
  activePaymentPlan: PaymentPlan | null
  openMaintenanceRequests: MaintenanceRequest[]
  openLegalActions: LegalAction[]
  openDisputes: Dispute[]
  escalationLevel: number
}

export async function loadTenantContext(whatsappNumber: string): Promise<TenantContext | null> {
  // Step 1: Tenant lookup by WhatsApp number
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .single()

  if (tenantError || !tenant) {
    console.error('Tenant not found for number:', whatsappNumber, tenantError)
    return null
  }

  // Step 2: Lease → unit → landlord
  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('*')
    .eq('id', tenant.lease_id)
    .single()

  if (leaseError || !lease) {
    console.error('Lease not found for tenant:', tenant.id, leaseError)
    return null
  }

  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('*')
    .eq('id', lease.unit_id)
    .single()

  if (unitError || !unit) {
    console.error('Unit not found for lease:', lease.id, unitError)
    return null
  }

  // Fetch all remaining context in parallel
  const [
    conversationsResult,
    contextResult,
    paymentsResult,
    paymentPlanResult,
    maintenanceResult,
    legalActionsResult,
    disputesResult,
  ] = await Promise.all([
    // Last 10 raw messages
    supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('lease_id', lease.id)
      .order('timestamp', { ascending: false })
      .limit(10),

    // Rolling conversation summary
    supabaseAdmin
      .from('conversation_context')
      .select('*')
      .eq('lease_id', lease.id)
      .maybeSingle(),

    // Last 6 months of payments
    supabaseAdmin
      .from('payments')
      .select('*')
      .eq('lease_id', lease.id)
      .order('due_date', { ascending: false })
      .limit(6),

    // Active payment plan if any
    supabaseAdmin
      .from('payment_plans')
      .select('*')
      .eq('lease_id', lease.id)
      .eq('status', 'active')
      .maybeSingle(),

    // Open maintenance requests
    supabaseAdmin
      .from('maintenance_requests')
      .select('*')
      .eq('lease_id', lease.id)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false }),

    // Open legal actions
    supabaseAdmin
      .from('legal_actions')
      .select('*')
      .eq('lease_id', lease.id)
      .in('status', ['issued', 'acknowledged'])
      .order('issued_at', { ascending: false }),

    // Open disputes
    supabaseAdmin
      .from('disputes')
      .select('*')
      .eq('lease_id', lease.id)
      .in('status', ['open', 'under_review'])
      .order('opened_at', { ascending: false }),
  ])

  // Extract escalation level from conversation_context.open_threads
  const contextData = contextResult.data
  let escalationLevel = 1
  if (contextData?.open_threads && typeof contextData.open_threads === 'object' && !Array.isArray(contextData.open_threads)) {
    const threads = contextData.open_threads as Record<string, unknown>
    if (typeof threads.escalation_level === 'number') {
      escalationLevel = threads.escalation_level
    }
  }

  return {
    tenant,
    lease,
    unit,
    landlordId: unit.landlord_id,
    recentConversations: (conversationsResult.data ?? []).reverse(), // chronological order
    conversationContext: contextData ?? null,
    recentPayments: paymentsResult.data ?? [],
    activePaymentPlan: paymentPlanResult.data ?? null,
    openMaintenanceRequests: maintenanceResult.data ?? [],
    openLegalActions: legalActionsResult.data ?? [],
    openDisputes: disputesResult.data ?? [],
    escalationLevel,
  }
}

export async function logConversation(
  leaseId: string,
  direction: 'inbound' | 'outbound',
  messageBody: string,
  whatsappMessageId?: string,
  intentClassification?: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      lease_id: leaseId,
      direction,
      message_body: messageBody,
      whatsapp_message_id: whatsappMessageId ?? null,
      intent_classification: intentClassification ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to log conversation:', error)
    return null
  }

  return data.id
}

export async function logAgentAction(params: {
  leaseId: string
  actionCategory: Database['public']['Tables']['agent_actions']['Row']['action_category']
  actionDescription: string
  toolsCalled?: unknown[]
  inputSummary?: string
  outputSummary?: string
  confidenceScore?: number
}): Promise<void> {
  const { error } = await supabaseAdmin.from('agent_actions').insert({
    lease_id: params.leaseId,
    action_category: params.actionCategory,
    action_description: params.actionDescription,
    tools_called: (params.toolsCalled ?? []) as Database['public']['Tables']['agent_actions']['Insert']['tools_called'],
    input_summary: params.inputSummary ?? null,
    output_summary: params.outputSummary ?? null,
    confidence_score: params.confidenceScore ?? null,
  })

  if (error) {
    console.error('Failed to log agent action:', error)
  }
}

export async function updateConversationContext(
  leaseId: string,
  summary: string,
  openThreads: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_context')
    .upsert(
      {
        lease_id: leaseId,
        summary,
        open_threads: openThreads as Database['public']['Tables']['conversation_context']['Insert']['open_threads'],
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'lease_id' }
    )

  if (error) {
    console.error('Failed to update conversation context:', error)
  }
}
