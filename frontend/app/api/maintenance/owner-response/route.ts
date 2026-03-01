import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { AIAnalysis } from '@/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { workflow_id, response, message } = await request.json();

    if (!workflow_id || !response) {
      return NextResponse.json(
        { error: 'workflow_id and response are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: workflow, error: fetchError } = await supabase
      .from('maintenance_workflows')
      .select('*')
      .eq('id', workflow_id)
      .single();

    if (fetchError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const aiAnalysis = workflow.ai_analysis as AIAnalysis;

    // Record owner response → OWNER_RESPONDED
    await supabase
      .from('maintenance_workflows')
      .update({
        owner_response: response as 'approved' | 'denied' | 'question',
        owner_message: message ?? null,
        current_state: 'OWNER_RESPONDED',
      })
      .eq('id', workflow_id);

    const ownerMessage =
      response === 'denied'
        ? `Request denied. ${message ?? 'No additional notes.'}`
        : response === 'question'
          ? `Owner question: ${message}`
          : `Request approved. ${message ?? 'Proceeding with maintenance workflow.'}`;

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'owner',
      sender_name: 'Property Owner',
      message: ownerMessage,
      metadata: { type: 'owner_response', response } as any,
    });

    // ── DENIED ────────────────────────────────────────────────────────────────
    if (response === 'denied') {
      await supabase
        .from('maintenance_workflows')
        .update({ current_state: 'CLOSED_DENIED' })
        .eq('id', workflow_id);

      await supabase
        .from('maintenance_requests')
        .update({ status: 'closed' })
        .eq('id', workflow.maintenance_request_id);

      await supabase.from('workflow_communications').insert({
        workflow_id,
        sender_type: 'system',
        sender_name: 'AI System',
        message:
          'Maintenance request denied by the property owner. Workflow closed. Tenant has been notified.',
        metadata: { type: 'closed_denied' } as any,
      });

      return NextResponse.json({ success: true, current_state: 'CLOSED_DENIED' });
    }

    // ── QUESTION ──────────────────────────────────────────────────────────────
    if (response === 'question') {
      await supabase.from('workflow_communications').insert({
        workflow_id,
        sender_type: 'system',
        sender_name: 'AI System',
        message:
          'Owner has requested additional information. Workflow on hold pending clarification.',
        metadata: { type: 'owner_question' } as any,
      });

      return NextResponse.json({ success: true, current_state: 'OWNER_RESPONDED' });
    }

    // ── APPROVED → DECISION_MADE ──────────────────────────────────────────────
    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'DECISION_MADE' })
      .eq('id', workflow_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: `Owner approved. AI decision: ${aiAnalysis?.vendor_required ? 'Vendor intervention required — initiating outreach.' : 'No vendor required — providing tenant resolution guidance.'}`,
      metadata: {
        type: 'decision_made',
        vendor_required: aiAnalysis?.vendor_required,
      } as any,
    });

    if (aiAnalysis?.vendor_required) {
      let vendorMessage = `Dear Contractor,

We have a ${aiAnalysis.urgency} urgency ${aiAnalysis.category} maintenance request requiring your immediate attention.

Issue Summary: ${aiAnalysis.reasoning}

Please confirm your availability and provide an estimated time of arrival (ETA).

Thank you for your prompt attention.

Best regards,
Property Management`;

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const resp = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            temperature: 0.3 as any,
            messages: [
              {
                role: 'user',
                content: `Write a professional, concise vendor outreach message for this maintenance issue. Category: ${aiAnalysis.category}, Urgency: ${aiAnalysis.urgency}, Context: ${aiAnalysis.reasoning}. Do not include a subject line. Return only the message body.`,
              },
            ],
          });
          const content = resp.content[0];
          if (content.type === 'text' && content.text.trim()) {
            vendorMessage = content.text.trim();
          }
        } catch (err: any) {
          console.error('[vendor message] Claude call failed:', err?.message ?? err);
        }
      }

      // VENDOR_CONTACTED
      await supabase
        .from('maintenance_workflows')
        .update({
          current_state: 'VENDOR_CONTACTED',
          vendor_message: vendorMessage,
        })
        .eq('id', workflow_id);

      await supabase.from('workflow_communications').insert({
        workflow_id,
        sender_type: 'system',
        sender_name: 'AI System',
        message:
          'Vendor outreach message generated and sent. Awaiting vendor confirmation and ETA.',
        metadata: { type: 'vendor_contacted', vendor_message: vendorMessage } as any,
      });

      // AWAITING_VENDOR_RESPONSE
      await supabase
        .from('maintenance_workflows')
        .update({ current_state: 'AWAITING_VENDOR_RESPONSE' })
        .eq('id', workflow_id);

      return NextResponse.json({
        success: true,
        current_state: 'AWAITING_VENDOR_RESPONSE',
        vendor_message: vendorMessage,
      });
    }

    // ── No vendor → IN_PROGRESS ───────────────────────────────────────────────
    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'IN_PROGRESS' })
      .eq('id', workflow_id);

    await supabase
      .from('maintenance_requests')
      .update({ status: 'in_progress' })
      .eq('id', workflow.maintenance_request_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'system',
      sender_name: 'AI System',
      message:
        'No professional vendor required. Tenant has been advised on self-resolution steps. Issue is now in progress.',
      metadata: { type: 'in_progress_no_vendor' } as any,
    });

    return NextResponse.json({ success: true, current_state: 'IN_PROGRESS' });
  } catch (error: any) {
    console.error('Owner response error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
