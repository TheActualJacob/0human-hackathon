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
    const { workflow_id } = await request.json();

    if (!workflow_id) {
      return NextResponse.json({ error: 'workflow_id is required' }, { status: 400 });
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

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(workflow.created_at).getTime();
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));
    const durationText =
      durationHours < 24
        ? `${durationHours} hour${durationHours !== 1 ? 's' : ''}`
        : `${Math.round(durationHours / 24)} day${Math.round(durationHours / 24) !== 1 ? 's' : ''}`;

    await supabase
      .from('maintenance_workflows')
      .update({ current_state: 'COMPLETED' })
      .eq('id', workflow_id);

    await supabase
      .from('maintenance_requests')
      .update({
        status: 'completed',
        completed_at: completedAt,
      })
      .eq('id', workflow.maintenance_request_id);

    await supabase.from('workflow_communications').insert({
      workflow_id,
      sender_type: 'system',
      sender_name: 'AI System',
      message: `Maintenance request completed successfully. Total resolution time: ${durationText}. Tenant has been notified. Workflow closed.`,
      metadata: { type: 'completed', completed_at: completedAt, duration: durationText } as any,
    });

    return NextResponse.json({
      success: true,
      current_state: 'COMPLETED',
      duration: durationText,
    });
  } catch (error: any) {
    console.error('Complete workflow error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
