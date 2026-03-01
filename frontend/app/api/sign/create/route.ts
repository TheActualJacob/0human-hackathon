import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function buildFallbackLease(p: { prospect_name: string; unit_address: string; monthly_rent: number; landlord_name?: string; deposit_amount?: number }): string {
  const today = new Date();
  const start = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const deposit = p.deposit_amount ?? p.monthly_rent * 2;
  const landlord = p.landlord_name ?? 'Robert Ryan';
  return `ASSURED SHORTHOLD TENANCY AGREEMENT

1. PARTIES
Landlord: ${landlord}
Tenant: ${p.prospect_name}

2. PROPERTY
The Landlord agrees to let the property at ${p.unit_address} to the Tenant for residential use only.

3. TERM
The tenancy shall commence on ${fmt(start)} and continue for a fixed term of 12 months, ending on ${fmt(end)}, unless terminated earlier in accordance with this Agreement.

4. RENT
The Tenant shall pay £${p.monthly_rent.toFixed(0)} per calendar month, payable in advance on the 1st day of each month by bank transfer.

5. DEPOSIT
A tenancy deposit of £${deposit.toFixed(0)} is payable on or before the commencement date. The Landlord shall protect this deposit in a government-approved Tenancy Deposit Scheme (TDS) within 30 days of receipt and provide the Tenant with the prescribed information.

6. TENANT OBLIGATIONS
The Tenant agrees to:
- Pay rent on time each month without demand
- Keep the property clean, tidy and in good condition
- Not cause nuisance or annoyance to neighbours
- Not sublet or assign the tenancy without the Landlord's written consent
- Allow the Landlord or authorised agents access to the property upon giving at least 24 hours' written notice (except in emergency)
- Report any disrepair or maintenance issues promptly
- Not make alterations to the property without prior written consent

7. LANDLORD OBLIGATIONS
The Landlord agrees to:
- Keep the structure and exterior of the property in repair (Landlord and Tenant Act 1985, s.11)
- Maintain installations for heating, hot water, gas, electricity and sanitation
- Respond to urgent repairs within 24 hours and routine repairs within 28 days
- Protect the Tenant's deposit and provide prescribed information within 30 days

8. PERMITTED USE
The property shall be used as a private residential dwelling only. No business activities shall be conducted from the property without prior written consent from the Landlord.

9. TERMINATION
After the fixed term, either party may end this tenancy by giving not less than 1 month's written notice (Tenant) or 2 months' written notice (Landlord) pursuant to Section 21 of the Housing Act 1988.

10. GOVERNING LAW
This Agreement is governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`;
}

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

    // Generate official lease via Claude (with 20s timeout)
    let lease_content: string;
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not set — using fallback lease template');
      lease_content = buildFallbackLease({ prospect_name, unit_address, monthly_rent: Number(monthly_rent) || 0, landlord_name, deposit_amount: deposit_amount ? Number(deposit_amount) : undefined });
    } else {
      try {
        const aiPromise = generateOfficialLease({
          prospect_name,
          unit_address,
          monthly_rent: Number(monthly_rent) || 0,
          landlord_name,
          deposit_amount: deposit_amount ? Number(deposit_amount) : undefined,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Claude timeout after 20s')), 20000)
        );
        lease_content = await Promise.race([aiPromise, timeoutPromise]);
      } catch (aiErr) {
        console.error('Claude lease generation failed, using fallback:', aiErr);
        lease_content = buildFallbackLease({ prospect_name, unit_address, monthly_rent: Number(monthly_rent) || 0, landlord_name, deposit_amount: deposit_amount ? Number(deposit_amount) : undefined });
      }
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
