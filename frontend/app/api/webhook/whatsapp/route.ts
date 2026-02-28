import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioSignature, sendWhatsAppMessage } from '@/lib/twilio/sendMessage'
import { loadTenantContext, logConversation, logAgentAction, updateConversationContext } from '@/lib/agent/contextLoader'
import { runAgentLoop } from '@/lib/agent/agentLoop'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Twilio sends form-encoded POST bodies
async function parseFormBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [key, value] = pair.split('=')
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent((value ?? '').replace(/\+/g, ' '))
    }
  }
  return params
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseFormBody(req)

    // Extract key fields from Twilio webhook payload
    const messageSid = body['MessageSid'] ?? ''
    const from = body['From'] ?? '' // e.g. "whatsapp:+447911123456"
    const messageBody = body['Body'] ?? ''
    const numMedia = parseInt(body['NumMedia'] ?? '0', 10)

    if (!from || !messageBody) {
      return new NextResponse('Bad Request', { status: 400 })
    }

    // Validate Twilio signature to prevent spoofed webhooks
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhook/whatsapp`

    if (process.env.NODE_ENV === 'production' && signature) {
      const isValid = validateTwilioSignature(signature, url, body)
      if (!isValid) {
        console.error('Invalid Twilio signature — rejecting webhook')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    // Normalize phone number: strip "whatsapp:" prefix for DB lookup
    const phoneNumber = from.replace(/^whatsapp:/, '')

    // Load tenant context — if not found, reply with an informational message
    const ctx = await loadTenantContext(phoneNumber)

    if (!ctx) {
      console.log(`Unknown tenant for number: ${phoneNumber}`)
      try {
        await sendWhatsAppMessage(from, 'Hello! I was unable to find your tenancy details. Please contact your property manager directly.')
      } catch (sendErr) {
        console.error('Could not send unknown-tenant reply:', sendErr)
      }
      return new NextResponse(null, { status: 200 })
    }

    // STEP 1: Log the inbound message immediately (paper trail before any processing)
    await logConversation(
      ctx.lease.id,
      'inbound',
      messageBody,
      messageSid
    )

    // STEP 2: Return 200 to Twilio immediately — prevents timeouts and retries
    // The agent runs asynchronously and sends the reply via Twilio REST API
    const responsePromise = processAndReply(ctx, from, messageBody, numMedia)

    // Use waitUntil if available (Vercel Edge), otherwise fire-and-forget
    if (typeof (globalThis as unknown as { EdgeRuntime?: unknown }).EdgeRuntime !== 'undefined') {
      // Edge runtime — not applicable here, handled below
    }

    // Fire-and-forget: Next.js App Router keeps the process alive for ongoing promises
    responsePromise.catch((err) => {
      console.error('Agent processing error:', err)
    })

    return new NextResponse(null, { status: 200 })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

async function processAndReply(
  ctx: Awaited<ReturnType<typeof loadTenantContext>>,
  to: string,
  userMessage: string,
  numMedia: number
): Promise<void> {
  if (!ctx) return

  // Handle media messages — acknowledge and ask for text description
  if (numMedia > 0) {
    const mediaAck = 'I can see you sent a photo or file. Could you describe the issue in a message so I can log it correctly?'
    await logConversation(ctx.lease.id, 'outbound', mediaAck)
    await sendWhatsAppMessage(to, mediaAck)
    return
  }

  let replyMessage: string
  let toolsUsed: string[] = []
  let intentClassification = 'general'

  try {
    // Run the Claude agent loop
    const result = await runAgentLoop(userMessage, ctx)
    replyMessage = result.finalMessage
    toolsUsed = result.toolsUsed
    intentClassification = result.intentClassification

    // Handle any high-severity landlord notifications from tool calls
    if (result.highSeverityActions.length > 0) {
      await notifyLandlord(ctx, result.highSeverityActions)
    }

    // Update the conversation context summary after processing
    await refreshConversationContext(ctx, userMessage, replyMessage, toolsUsed)
  } catch (agentErr) {
    console.error('Agent loop error:', agentErr)
    replyMessage = 'I encountered an issue processing your request. Please try again or contact your property manager directly.'

    await logAgentAction({
      leaseId: ctx.lease.id,
      actionCategory: 'other',
      actionDescription: `Agent error: ${agentErr instanceof Error ? agentErr.message : String(agentErr)}`,
      toolsCalled: [],
      confidenceScore: 0,
    })
  }

  // Log the outbound reply with intent classification
  await logConversation(
    ctx.lease.id,
    'outbound',
    replyMessage,
    undefined,
    intentClassification
  )

  // Send reply via Twilio REST API
  await sendWhatsAppMessage(to, replyMessage)
}

async function notifyLandlord(
  ctx: NonNullable<Awaited<ReturnType<typeof loadTenantContext>>>,
  actions: string[]
): Promise<void> {
  for (const action of actions) {
    // Landlord notifications are already created by tool handlers for specific actions.
    // This handles any additional general alerts.
    console.log(`[LANDLORD NOTIFICATION] ${action}`)
  }

  // Also send a WhatsApp to the landlord if they have a number and high-severity event
  const { data: landlordRow } = await supabaseAdmin
    .from('landlords')
    .select('*')
    .eq('id', ctx.landlordId)
    .single()

  if (landlordRow?.whatsapp_number) {
    const prefs = landlordRow.notification_preferences as Record<string, unknown> | null
    if (prefs?.whatsapp !== false) {
      const summary = `[Property Alert] ${ctx.unit.unit_identifier}, ${ctx.unit.city}: ${actions[0]}`
      await sendWhatsAppMessage(landlordRow.whatsapp_number, summary)
    }
  }
}

async function refreshConversationContext(
  ctx: NonNullable<Awaited<ReturnType<typeof loadTenantContext>>>,
  userMessage: string,
  agentReply: string,
  toolsUsed: string[]
): Promise<void> {
  const currentThreads =
    ctx.conversationContext?.open_threads &&
    typeof ctx.conversationContext.open_threads === 'object' &&
    !Array.isArray(ctx.conversationContext.open_threads)
      ? (ctx.conversationContext.open_threads as Record<string, unknown>)
      : {}

  // Build a brief updated summary
  const prevSummary = ctx.conversationContext?.summary ?? ''
  const newEntry = `[${new Date().toISOString().split('T')[0]}] Tenant: "${userMessage.slice(0, 100)}". Agent: "${agentReply.slice(0, 100)}".${toolsUsed.length > 0 ? ` Tools used: ${toolsUsed.join(', ')}.` : ''}`

  // Keep summary to last ~1000 chars to avoid runaway growth
  const updatedSummary = (prevSummary + '\n' + newEntry).slice(-1000).trim()

  await updateConversationContext(ctx.lease.id, updatedSummary, currentThreads)
}
