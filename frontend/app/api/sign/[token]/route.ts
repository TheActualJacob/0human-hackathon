import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('signing_tokens')
    .select('id, prospect_name, unit_address, monthly_rent, lease_content, signed_at, expires_at')
    .eq('id', token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ detail: 'Signing link not found.' }, { status: 404 });
  }

  if (data.signed_at) {
    return NextResponse.json({ detail: 'This lease has already been signed.' }, { status: 410 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ detail: 'This signing link has expired.' }, { status: 410 });
  }

  return NextResponse.json({
    token: data.id,
    prospect_name: data.prospect_name,
    unit_address: data.unit_address,
    monthly_rent: data.monthly_rent,
    lease_content: data.lease_content,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from('signing_tokens')
    .select('id, signed_at, expires_at')
    .eq('id', token)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ detail: 'Signing link not found.' }, { status: 404 });
  }

  if (existing.signed_at) {
    return NextResponse.json({ detail: 'This lease has already been signed.' }, { status: 410 });
  }

  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ detail: 'This signing link has expired.' }, { status: 410 });
  }

  const body = await req.json().catch(() => ({}));
  const signatureDataUrl: string | undefined = body.signature_data_url;

  const { error } = await supabase
    .from('signing_tokens')
    .update({
      signed_at: new Date().toISOString(),
      signature_data_url: signatureDataUrl ?? null,
    })
    .eq('id', token);

  if (error) {
    console.error('Failed to mark lease as signed:', error);
    return NextResponse.json({ detail: 'Failed to record signature.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, pdf_url: null });
}
