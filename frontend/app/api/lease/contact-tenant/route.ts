import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python backend's full renewal workflow:
 * score → price → AI offer → send WhatsApp to tenant.
 *
 * Uses the service role key as the bearer token — the backend's
 * _get_verified_user() accepts this for internal calls.
 */
export async function POST(req: NextRequest) {
  try {
    const { lease_id } = await req.json();
    if (!lease_id) return NextResponse.json({ error: 'lease_id required' }, { status: 400 });

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ??
      'http://localhost:8000';

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/api/renewals/leases/${lease_id}/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[contact-tenant] Backend error:', res.status, data);
      return NextResponse.json(
        { error: data?.detail ?? `Backend returned ${res.status}` },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    console.error('[contact-tenant] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
