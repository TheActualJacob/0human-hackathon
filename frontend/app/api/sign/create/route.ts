import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

async function generateOfficialLease(params: {
  prospect_name: string;
  unit_address: string;
  monthly_rent: number;
  landlord_name?: string;
  deposit_amount?: number;
  start_date?: string;
}): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date();
  const startDate = params.start_date
    ? new Date(params.start_date)
    : new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from today

  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const prompt = `Generate a complete, official UK Assured Shorthold Tenancy (AST) agreement for the following:

Landlord: ${params.landlord_name ?? 'Robert Ryan'}
Tenant: ${params.prospect_name}
Property: ${params.unit_address}
Monthly Rent: £${params.monthly_rent}
Deposit: £${params.deposit_amount ?? params.monthly_rent * 2}
Tenancy Start: ${fmt(startDate)}
Tenancy End: ${fmt(endDate)}
Notice Period: 2 months (landlord), 1 month (tenant)

Write a complete, professional AST that:
- Uses proper UK legal language and references relevant Acts (Housing Act 1988, Landlord and Tenant Act 1985, Deregulation Act 2015, etc.)
- Includes all standard clauses: parties, property, term, rent payment, deposit protection (DPS), repairs, access, restrictions, termination, break clause
- Covers permitted occupiers, subletting restrictions, alterations, pets
- Includes energy efficiency, smoke/CO alarm obligations
- Has a governing law clause
- Feels like a real solicitor-drafted document
- Uses numbered sections with clear headings
- Do NOT include signature lines or dates at the bottom — those will be added separately
- Format with blank lines between sections for readability
- Length: comprehensive but not excessive (aim for ~800-1000 words of content)

Output ONLY the lease text itself, starting with "ASSURED SHORTHOLD TENANCY AGREEMENT". No preamble, no markdown, no explanation.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = msg.content[0];
  if (content.type !== 'text') throw new Error('Unexpected Claude response type');
  return content.text.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prospect_name,
      unit_address,
      monthly_rent,
      prospect_phone,
      prospect_email,
      unit_id,
      landlord_name,
      deposit_amount,
    } = body;

    if (!prospect_name || !unit_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate official lease via Claude
    let lease_content: string;
    try {
      lease_content = await generateOfficialLease({
        prospect_name,
        unit_address,
        monthly_rent: Number(monthly_rent) || 0,
        landlord_name,
        deposit_amount: deposit_amount ? Number(deposit_amount) : undefined,
      });
    } catch (aiErr) {
      console.error('Claude lease generation failed, using fallback:', aiErr);
      lease_content = body.lease_content ?? `ASSURED SHORTHOLD TENANCY AGREEMENT\n\nThis agreement is between ${landlord_name ?? 'the Landlord'} and ${prospect_name} for the property at ${unit_address} at a monthly rent of £${monthly_rent}.`;
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
