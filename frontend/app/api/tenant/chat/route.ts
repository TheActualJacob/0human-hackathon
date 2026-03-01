import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function buildSystemPrompt(context: {
  tenantName: string;
  address: string;
  city: string;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  securityDeposit: number;
  leaseStatus: string;
  daysRemaining: number;
  payments: Array<{ due_date: string; amount: number; amount_paid: number | null; status: string }>;
  maintenanceRequests: Array<{ category: string; description: string; status: string; created_at: string }>;
}) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const paymentLines = context.payments.length
    ? context.payments
        .map(p => `  - ${new Date(p.due_date).toLocaleDateString('en-GB')}: £${p.amount} — ${p.status}${p.amount_paid ? ` (paid £${p.amount_paid})` : ''}`)
        .join('\n')
    : '  No payment records found.';

  const maintenanceLines = context.maintenanceRequests.length
    ? context.maintenanceRequests
        .map(m => `  - [${m.status.toUpperCase()}] ${m.category}: "${m.description.slice(0, 80)}" (${new Date(m.created_at).toLocaleDateString('en-GB')})`)
        .join('\n')
    : '  No active maintenance requests.';

  const leaseEndDate = new Date(context.leaseEnd).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `You are an AI property manager assistant for PropAI, representing the property management company. You help tenants with any questions or concerns about their tenancy in a professional, empathetic, and direct manner.

TODAY'S DATE: ${today}

TENANT DETAILS:
- Name: ${context.tenantName}
- Property: ${context.address}, ${context.city}
- Lease Start: ${new Date(context.leaseStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
- Lease End: ${leaseEndDate}
- Days Remaining on Lease: ${context.daysRemaining} days (${Math.floor(context.daysRemaining / 30)} months)
- Monthly Rent: £${context.rentAmount}
- Security Deposit: £${context.securityDeposit}
- Lease Status: ${context.leaseStatus}

PAYMENT HISTORY (last 6):
${paymentLines}

ACTIVE MAINTENANCE REQUESTS:
${maintenanceLines}

GUIDELINES:
- Use the actual tenant data above to answer questions precisely — never guess or approximate dates/amounts
- For lease duration questions: calculate from today's date (${today}) to the lease end (${leaseEndDate})
- For payment/rent questions: reference the actual amounts and history above
- If a tenant shares an image of damage or an issue, assess its urgency and recommend whether they should submit a formal maintenance request
- For issues outside your authority (e.g., changing the rent amount, lease termination decisions): explain the process and advise the tenant to contact the property management office directly
- Keep responses concise and helpful — use bullet points for clarity when listing information
- If a tenant is upset or frustrated, acknowledge their concern empathetically before addressing it
- Always be professional. Sign off responses as "PropAI Property Manager" only when closing a conversation, not on every message
- Do not invent information not present in the context above`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      tenantId,
      leaseId,
      message,
      imageBase64,
      imageMimeType,
    } = await request.json() as {
      sessionId: string | null;
      tenantId: string;
      leaseId: string | null;
      message: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!tenantId || !message?.trim()) {
      return NextResponse.json({ error: 'tenantId and message are required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // ── 1. Fetch tenant context ────────────────────────────────────────────
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*, leases(*, units(*))')
      .eq('id', tenantId)
      .maybeSingle();

    const lease = tenant?.leases;
    const unit = lease?.units;

    // Days remaining calculation
    const leaseEnd = lease?.end_date ? new Date(lease.end_date) : null;
    const daysRemaining = leaseEnd
      ? Math.max(0, Math.ceil((leaseEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Last 6 payments
    const activeLeaseId = leaseId ?? lease?.id;
    let payments: any[] = [];
    let maintenanceRequests: any[] = [];

    if (activeLeaseId) {
      const { data: payData } = await supabase
        .from('payments')
        .select('due_date, amount, amount_paid, status')
        .eq('lease_id', activeLeaseId)
        .order('due_date', { ascending: false })
        .limit(6);
      payments = payData ?? [];

      const { data: maintData } = await supabase
        .from('maintenance_requests')
        .select('category, description, status, created_at')
        .eq('lease_id', activeLeaseId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
      maintenanceRequests = maintData ?? [];
    }

    const systemPrompt = buildSystemPrompt({
      tenantName: tenant?.full_name ?? 'Tenant',
      address: unit?.address ?? 'your property',
      city: unit?.city ?? '',
      leaseStart: lease?.start_date ?? '',
      leaseEnd: lease?.end_date ?? '',
      rentAmount: lease?.rent_amount ?? 0,
      securityDeposit: lease?.security_deposit ?? 0,
      leaseStatus: lease?.status ?? 'unknown',
      daysRemaining,
      payments,
      maintenanceRequests,
    });

    // ── 2. Resolve or create session ─────────────────────────────────────
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const { data: newSession, error: sessionErr } = await supabase
        .from('tenant_chat_sessions')
        .insert({
          tenant_id: tenantId,
          lease_id: activeLeaseId ?? null,
          title: message.trim().slice(0, 50) + (message.trim().length > 50 ? '…' : ''),
        })
        .select('id')
        .single();

      if (sessionErr || !newSession) {
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
      currentSessionId = newSession.id;
    }

    // ── 3. Load conversation history for this session ─────────────────────
    const { data: history } = await supabase
      .from('tenant_chat_messages')
      .select('role, content, image_url')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });

    // ── 4. Save the user message ──────────────────────────────────────────
    // (image_url will be set after upload on client side, we store a placeholder)
    await supabase.from('tenant_chat_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message,
      image_url: null, // client uploads separately and we don't block on it
    });

    // ── 5. Build Claude messages ──────────────────────────────────────────
    type TextBlock = { type: 'text'; text: string };
    type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
    type ContentBlock = TextBlock | ImageBlock;

    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }> = [];

    // Past messages (exclude the one we just saved — it's the current turn)
    for (const msg of history ?? []) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        claudeMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    // Current user message — with optional image
    if (imageBase64 && imageMimeType) {
      const userContent: ContentBlock[] = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: imageBase64,
          },
        },
        { type: 'text', text: message },
      ];
      claudeMessages.push({ role: 'user', content: userContent });
    } else {
      claudeMessages.push({ role: 'user', content: message });
    }

    // ── 6. Call Claude ────────────────────────────────────────────────────
    let reply = "I'm sorry, I couldn't process your request right now. Please try again.";

    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        temperature: 0.3 as any,
        system: systemPrompt,
        messages: claudeMessages,
      });
      const firstContent = response.content[0];
      if (firstContent.type === 'text') {
        reply = firstContent.text.trim();
      }
    } else {
      // Fallback when no API key — give a basic canned response
      reply = `Thank you for your message. I can see you have a lease at ${unit?.address ?? 'your property'} running until ${lease?.end_date ? new Date(lease.end_date).toLocaleDateString('en-GB') : 'the agreed date'}. For a full AI-powered response, please ensure the ANTHROPIC_API_KEY is configured.`;
    }

    // ── 7. Save assistant reply ───────────────────────────────────────────
    await supabase.from('tenant_chat_messages').insert({
      session_id: currentSessionId,
      role: 'assistant',
      content: reply,
    });

    // ── 8. Update session updated_at (and title if first message) ─────────
    const isFirstMessage = !history || history.length === 0;
    await supabase
      .from('tenant_chat_sessions')
      .update({
        updated_at: new Date().toISOString(),
        ...(isFirstMessage
          ? { title: message.trim().slice(0, 50) + (message.trim().length > 50 ? '…' : '') }
          : {}),
      })
      .eq('id', currentSessionId);

    return NextResponse.json({ reply, sessionId: currentSessionId });
  } catch (error: any) {
    console.error('Tenant chat error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
