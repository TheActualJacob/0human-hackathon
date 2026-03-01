import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospect_name, unit_address, monthly_rent, lease_content, prospect_phone, prospect_email, unit_id } = body;

    if (!prospect_name || !lease_content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase
      .from('signing_tokens')
      .insert({
        prospect_name,
        unit_address: unit_address ?? null,
        monthly_rent: monthly_rent ?? null,
        lease_content,
        prospect_phone: prospect_phone ?? null,
        prospect_email: prospect_email ?? null,
        unit_id: unit_id ?? null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('signing_tokens insert error:', error);
      return NextResponse.json({ error: 'Failed to create signing token', details: error?.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('sign/create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
