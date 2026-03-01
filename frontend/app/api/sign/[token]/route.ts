import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function getSupabase(useServiceRole = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = useServiceRole
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error(`Missing Supabase env vars: url=${!!url} key=${!!key}`);
  return createClient(url, key);
}

async function buildPDF(
  data: { prospect_name: string | null; unit_address: string | null; monthly_rent: number | null; lease_content: string },
  signatureDataUrl: string,
  signedAt: Date,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842; // A4
  const margin = 55;
  const contentW = W - margin * 2;
  const gray = rgb(0.45, 0.45, 0.45);
  const black = rgb(0.08, 0.08, 0.08);
  const lightGray = rgb(0.88, 0.88, 0.88);
  const green = rgb(0.09, 0.72, 0.38);

  let page = pdfDoc.addPage([W, H]);
  let y = H - margin;

  const nl = (n = 1) => { y -= n * 14; };
  const ensureSpace = (need: number) => {
    if (y - need < margin + 30) {
      page = pdfDoc.addPage([W, H]);
      y = H - margin;
    }
  };

  const drawText = (text: string, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
    const f = opts.bold ? bold : font;
    const sz = opts.size ?? 10;
    const col = opts.color ?? black;
    const x = margin + (opts.indent ?? 0);
    const maxW = contentW - (opts.indent ?? 0);

    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, sz) > maxW && line) {
        ensureSpace(sz + 4);
        page.drawText(line, { x, y, font: f, size: sz, color: col });
        y -= sz + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ensureSpace(sz + 4);
      page.drawText(line, { x, y, font: f, size: sz, color: col });
      y -= sz + 4;
    }
  };

  // ── Header ─────────────────────────────────────────────────────
  page.drawText('PROPAI', { x: margin, y, font: bold, size: 18, color: green });
  page.drawText('Property Management', { x: margin + 72, y: y + 1, font, size: 11, color: gray });
  nl(2);
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.75, color: lightGray });
  nl(1.5);

  // ── Summary box ────────────────────────────────────────────────
  const boxH = 64;
  page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: rgb(0.97, 0.97, 0.97), borderColor: lightGray, borderWidth: 0.5 });
  const by = y - 16;
  page.drawText('Tenant', { x: margin + 12, y: by, font, size: 8, color: gray });
  page.drawText(data.prospect_name ?? '—', { x: margin + 12, y: by - 13, font: bold, size: 10, color: black });
  if (data.unit_address) {
    page.drawText('Property', { x: margin + 140, y: by, font, size: 8, color: gray });
    page.drawText(data.unit_address, { x: margin + 140, y: by - 13, font: bold, size: 10, color: black });
  }
  if (data.monthly_rent) {
    page.drawText('Monthly Rent', { x: margin + 360, y: by, font, size: 8, color: gray });
    page.drawText(`£${data.monthly_rent.toFixed(0)}`, { x: margin + 360, y: by - 13, font: bold, size: 12, color: green });
  }
  y -= boxH + 20;

  // ── Lease content ──────────────────────────────────────────────
  for (const para of data.lease_content.split('\n\n')) {
    const trimmed = para.trim();
    if (!trimmed) { nl(0.5); continue; }

    const lines = trimmed.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t) { nl(0.5); continue; }
      const isSection = /^\d+\.\s+[A-Z]/.test(t);
      const isBullet = t.startsWith('- ') || t.startsWith('• ');

      if (isSection) {
        nl(0.5);
        drawText(t, { bold: true, size: 11, color: black });
        nl(0.2);
      } else if (isBullet) {
        drawText(t.slice(2), { size: 10, color: rgb(0.2, 0.2, 0.2), indent: 14 });
      } else {
        drawText(t, { size: 10, color: rgb(0.2, 0.2, 0.2) });
      }
    }
    nl(0.4);
  }

  // ── Signature page ─────────────────────────────────────────────
  page = pdfDoc.addPage([W, H]);
  y = H - margin;

  page.drawText('SIGNATURE PAGE', { x: margin, y, font: bold, size: 14, color: black });
  nl(1.2);
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.75, color: lightGray });
  nl(2);

  page.drawText('Digitally Signed By', { x: margin, y, font: bold, size: 11, color: black });
  nl(1.4);
  page.drawText(`Name:  ${data.prospect_name ?? 'Tenant'}`, { x: margin, y, font, size: 10, color: black });
  nl(1.3);
  page.drawText(`Date:  ${signedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, { x: margin, y, font, size: 10, color: black });
  nl(1.3);
  page.drawText(`Time:  ${signedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`, { x: margin, y, font, size: 10, color: black });
  nl(2.5);

  // Embed signature image
  try {
    const sigBase64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const sigBytes = Buffer.from(sigBase64, 'base64');
    const sigImage = signatureDataUrl.includes('png')
      ? await pdfDoc.embedPng(sigBytes)
      : await pdfDoc.embedJpg(sigBytes);
    const maxSigW = 260, maxSigH = 120;
    const scale = Math.min(maxSigW / sigImage.width, maxSigH / sigImage.height, 1);
    const sw = sigImage.width * scale, sh = sigImage.height * scale;

    page.drawRectangle({ x: margin, y: y - sh - 10, width: sw + 20, height: sh + 20, borderColor: lightGray, borderWidth: 1 });
    page.drawImage(sigImage, { x: margin + 10, y: y - sh, width: sw, height: sh });
    y -= sh + 35;
  } catch {
    page.drawText('[Signature captured digitally]', { x: margin, y, font, size: 10, color: gray });
    y -= 20;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: lightGray });
  y -= 14;
  page.drawText(
    'This document was digitally signed and is legally binding under the Electronic Communications Act 2000.',
    { x: margin, y, font, size: 8, color: gray, maxWidth: contentW },
  );
  y -= 12;
  page.drawText('Signed via PropAI Property Management Platform · propai.app', { x: margin, y, font, size: 8, color: gray });

  return pdfDoc.save();
}

// ── Post-signing: provision tenant account ────────────────────────────────────
async function activateNewTenant(
  supabase: ReturnType<typeof createClient>,
  token: Record<string, unknown>,
  signedAt: Date,
  pdfUrl: string | null,
) {
  const email = token.prospect_email as string | null;
  const name = token.prospect_name as string | null;
  const unitId = token.unit_id as string | null;
  const monthlyRent = token.monthly_rent as number | null;

  // 1. Create tenant record — must match actual schema columns
  const { data: tenantRow, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      full_name: name ?? 'New Tenant',
      email: email ?? null,
      whatsapp_number: (token.prospect_phone as string | null) ?? `+000${Date.now()}`,
      is_primary_tenant: true,
      lease_id: unitId ? null : null, // will be updated after lease lookup
    })
    .select('id')
    .single();

  if (tenantErr) {
    console.error('Failed to create tenant record:', tenantErr);
    return;
  }
  const tenantId = tenantRow.id as string;

  // 2. Activate the lease — find most recent pending lease for this unit
  if (unitId) {
    const { data: pendingLease } = await supabase
      .from('leases')
      .select('id')
      .eq('unit_id', unitId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingLease) {
      // Update lease to active
      await supabase
        .from('leases')
        .update({ status: 'active' })
        .eq('id', pendingLease.id);

      // Link tenant to lease
      await supabase
        .from('tenants')
        .update({ lease_id: pendingLease.id })
        .eq('id', tenantId);
    }
  }

  // 3. Create Supabase auth account if we have an email
  let tempPassword: string | null = null;
  if (email) {
    // Generate a readable temp password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    tempPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (!authErr && authUser?.user) {
      // Update tenant with auth link
      await supabase.from('tenants').update({ auth_user_id: authUser.user.id }).eq('id', tenantId);

      // Insert into auth_users bridge
      await supabase.from('auth_users').insert({
        id: authUser.user.id,
        role: 'tenant',
        entity_id: tenantId,
      }).onConflict('id').merge();
    } else if (authErr) {
      console.warn('Auth user creation failed:', authErr.message);
    }
  }

  // 4. Send welcome email
  if (email) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://energetic-transformation-production-c907.up.railway.app'}/auth/login`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PropAI <onboarding@resend.dev>',
          to: [email],
          subject: 'Your tenancy is confirmed — welcome! 🏠',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e5e5e5;padding:32px;border-radius:12px">
              <div style="border-bottom:1px solid #27272a;padding-bottom:24px;margin-bottom:24px">
                <h1 style="color:#22c55e;font-size:22px;margin:0">Welcome to your new home</h1>
              </div>
              <p style="font-size:16px">Hi <strong>${name ?? 'there'}</strong>,</p>
              <p style="color:#a1a1aa">Your lease for <strong style="color:#e5e5e5">${token.unit_address ?? 'the property'}</strong> has been signed and is now active.</p>
              ${pdfUrl ? `
              <div style="margin:20px 0">
                <a href="${pdfUrl}" style="display:inline-block;background:#27272a;color:#e5e5e5;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">📄 Download Signed Lease (PDF)</a>
              </div>` : ''}
              ${tempPassword ? `
              <div style="background:#18181b;border:1px solid #22c55e;border-radius:8px;padding:20px;margin:24px 0">
                <p style="margin:0 0 12px;color:#a1a1aa;font-size:14px">Your tenant portal account has been created. Log in to view payments, maintenance requests, and your lease:</p>
                <p style="margin:4px 0;font-size:14px"><strong>Email:</strong> ${email}</p>
                <p style="margin:4px 0;font-size:14px"><strong>Password:</strong> <code style="background:#27272a;padding:2px 6px;border-radius:4px">${tempPassword}</code></p>
                <div style="margin-top:16px">
                  <a href="${loginUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:bold;padding:10px 20px;border-radius:6px;text-decoration:none">Log In to Tenant Portal →</a>
                </div>
              </div>` : ''}
              <p style="color:#71717a;font-size:13px;margin-top:32px">This message was sent via PropAI Property Management.</p>
            </div>
          `,
        }),
      });
    }
  }
}

// ── GET — fetch token ──────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = getSupabase(true);

    const { data, error } = await supabase
      .from('signing_tokens')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (error) {
      console.error('signing_tokens select error:', error);
      return NextResponse.json({ detail: `DB error: ${error.message}` }, { status: 500 });
    }
    if (!data) return NextResponse.json({ detail: 'Signing link not found.' }, { status: 404 });
    if (data.signed_at) return NextResponse.json({ detail: 'This lease has already been signed.' }, { status: 410 });
    if (data.expires_at && new Date(data.expires_at) < new Date())
      return NextResponse.json({ detail: 'This signing link has expired.' }, { status: 410 });

    return NextResponse.json({
      token: data.id,
      prospect_name: data.prospect_name ?? null,
      unit_address: data.unit_address ?? null,
      monthly_rent: data.monthly_rent ?? null,
      lease_content: data.lease_content ?? 'No lease content available.',
    });
  } catch (err) {
    console.error('GET /api/sign/[token] error:', err);
    return NextResponse.json({ detail: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

// ── POST — submit signature ────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = getSupabase(true);

    const { data: existing, error: fetchErr } = await supabase
      .from('signing_tokens')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ detail: `DB error: ${fetchErr.message}` }, { status: 500 });
    if (!existing) return NextResponse.json({ detail: 'Signing link not found.' }, { status: 404 });
    if (existing.signed_at) return NextResponse.json({ detail: 'This lease has already been signed.' }, { status: 410 });
    if (existing.expires_at && new Date(existing.expires_at) < new Date())
      return NextResponse.json({ detail: 'This signing link has expired.' }, { status: 410 });

    const body = await req.json().catch(() => ({}));
    const signatureDataUrl: string = body.signature_data_url ?? '';
    const signedAt = new Date();

    // Generate PDF
    let pdfUrl: string | null = null;
    try {
      const pdfBytes = await buildPDF(
        {
          prospect_name: existing.prospect_name,
          unit_address: existing.unit_address,
          monthly_rent: existing.monthly_rent,
          lease_content: existing.lease_content ?? '',
        },
        signatureDataUrl,
        signedAt,
      );

      // Ensure bucket exists then upload
      const fileName = `signed-leases/${token}.pdf`;
      const BUCKET = 'documents';

      // Create bucket if it doesn't exist
      const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (bucketErr && !bucketErr.message.includes('already exists') && !bucketErr.message.includes('duplicate')) {
        console.warn('Bucket create warning (may already exist):', bucketErr.message);
      }

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
        console.log('PDF uploaded to storage:', pdfUrl);
      } else {
        console.error('Storage upload failed:', uploadErr.message);
      }
    } catch (pdfErr) {
      console.warn('PDF generation failed (non-fatal):', pdfErr);
    }

    // Mark as signed
    const { error: updateErr } = await supabase
      .from('signing_tokens')
      .update({
        signed_at: signedAt.toISOString(),
        signature_data_url: signatureDataUrl || null,
        pdf_url: pdfUrl,
      })
      .eq('id', token);

    if (updateErr) return NextResponse.json({ detail: `Failed to record signature: ${updateErr.message}` }, { status: 500 });

    // Activate lease and generate payments
    const prospectPhone = existing.prospect_phone as string | null;
    if (prospectPhone) {
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('lease_id')
          .eq('whatsapp_number', prospectPhone)
          .maybeSingle();

        if (tenant?.lease_id) {
          await supabase
            .from('leases')
            .update({ status: 'active', lease_document_url: pdfUrl })
            .eq('id', tenant.lease_id);

          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/payments/generate-for-lease/${tenant.lease_id}`,
            { method: 'POST' },
          ).catch(() => { /* non-fatal */ });
        }
      } catch {
        // Non-fatal — signing succeeded
      }
    }

    return NextResponse.json({ success: true, pdf_url: pdfUrl });
  } catch (err) {
    console.error('POST /api/sign/[token] error:', err);
    return NextResponse.json({ detail: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
