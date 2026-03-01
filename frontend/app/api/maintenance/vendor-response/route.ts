import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { workflow_id, eta, notes } = await request.json();

    if (!workflow_id || !eta) {
      return NextResponse.json(
        { error: 'workflow_id and eta are required' },
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

    const etaDate = new Date(eta);
    const formattedEta = etaDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // ETA_CONFIRMED
    await supabase
      .from('maintenance_workflows')
      .update({
        vendor_eta: eta,
        vendor_notes: notes ?? null,
        current_state: 'ETA_CONFIRMED',
      })
      .eq('id', workflow_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'vendor',
      sender_name: 'Vendor',
      message: `ETA confirmed: ${formattedEta}${notes ? `. Notes: ${notes}` : '.'}`,
      metadata: { type: 'vendor_response', eta, notes } as any,
    });

    // TENANT_NOTIFIED
    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'TENANT_NOTIFIED' })
      .eq('id', workflow_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: `Tenant notified. A contractor has been scheduled and will arrive on ${formattedEta}.`,
      metadata: { type: 'tenant_notified', eta: formattedEta } as any,
    });

    // IN_PROGRESS
    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'IN_PROGRESS' })
      .eq('id', workflow_id);

    await supabase
      .from('maintenance_requests')
      .update({
        status: 'in_progress',
        scheduled_at: eta,
      })
      .eq('id', workflow.maintenance_request_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: 'Work is now in progress. Monitoring for completion.',
      metadata: { type: 'in_progress' } as any,
    });

    return NextResponse.json({
      success: true,
      current_state: 'IN_PROGRESS',
      eta: formattedEta,
    });
  } catch (error: any) {
    console.error('Vendor response error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
