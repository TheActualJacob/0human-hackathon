import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase(useServiceRole = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = useServiceRole
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars: url=${!!url} key=${!!key}`);
  }
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = getSupabase(false);

    const { data, error } = await supabase
      .from('signing_tokens')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (error) {
      console.error('signing_tokens select error:', error);
      return NextResponse.json({ detail: `DB error: ${error.message}` }, { status: 500 });
    }

    if (!data) {
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
      prospect_name: data.prospect_name ?? null,
      unit_address: data.unit_address ?? null,
      monthly_rent: data.monthly_rent ?? null,
      lease_content: data.lease_content ?? 'No lease content available.',
    });
  } catch (err) {
    console.error('GET /api/sign/[token] error:', err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = getSupabase(true);

    const { data: existing, error: fetchErr } = await supabase
      .from('signing_tokens')
      .select('id, signed_at, expires_at')
      .eq('id', token)
      .maybeSingle();

    if (fetchErr) {
      console.error('signing_tokens fetch error:', fetchErr);
      return NextResponse.json({ detail: `DB error: ${fetchErr.message}` }, { status: 500 });
    }

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

    const { error: updateErr } = await supabase
      .from('signing_tokens')
      .update({
        signed_at: new Date().toISOString(),
        signature_data_url: signatureDataUrl ?? null,
      })
      .eq('id', token);

    if (updateErr) {
      console.error('Failed to mark lease as signed:', updateErr);
      return NextResponse.json({ detail: `Failed to record signature: ${updateErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, pdf_url: null });
  } catch (err) {
    console.error('POST /api/sign/[token] error:', err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
