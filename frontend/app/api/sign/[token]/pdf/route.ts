import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function buildPDF(
  data: { prospect_name: string | null; unit_address: string | null; monthly_rent: number | null; lease_content: string },
  signatureDataUrl: string | null,
  signedAt: Date,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842;
  const margin = 55;
  const contentW = W - margin * 2;
  const gray = rgb(0.45, 0.45, 0.45);
  const black = rgb(0.08, 0.08, 0.08);
  const lightGray = rgb(0.88, 0.88, 0.88);
  const green = rgb(0.09, 0.72, 0.38);

  let page = pdfDoc.addPage([W, H]);
  let y = H - margin;

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

  // Header
  page.drawText('PROPAI', { x: margin, y, font: bold, size: 18, color: green });
  page.drawText('Property Management', { x: margin + 72, y: y + 1, font, size: 11, color: gray });
  y -= 28;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.75, color: lightGray });
  y -= 21;

  // Summary box
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

  // Lease content
  for (const para of data.lease_content.split('\n\n')) {
    const trimmed = para.trim();
    if (!trimmed) { y -= 7; continue; }
    for (const line of trimmed.split('\n')) {
      const t = line.trim();
      if (!t) { y -= 7; continue; }
      const isSection = /^\d+\.\s+[A-Z]/.test(t);
      const isBullet = t.startsWith('- ') || t.startsWith('• ');
      if (isSection) { y -= 7; drawText(t, { bold: true, size: 11 }); y -= 3; }
      else if (isBullet) { drawText(t.slice(2), { size: 10, color: rgb(0.2, 0.2, 0.2), indent: 14 }); }
      else { drawText(t, { size: 10, color: rgb(0.2, 0.2, 0.2) }); }
    }
    y -= 6;
  }

  // Signature page
  page = pdfDoc.addPage([W, H]);
  y = H - margin;
  page.drawText('SIGNATURE PAGE', { x: margin, y, font: bold, size: 14, color: black });
  y -= 25;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.75, color: lightGray });
  y -= 30;
  page.drawText(`Signed by: ${data.prospect_name ?? 'Tenant'}`, { x: margin, y, font, size: 10, color: black }); y -= 18;
  page.drawText(`Date:      ${signedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, { x: margin, y, font, size: 10, color: black }); y -= 18;
  page.drawText(`Time:      ${signedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`, { x: margin, y, font, size: 10, color: black }); y -= 30;

  if (signatureDataUrl) {
    try {
      const sigBase64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const sigBytes = Buffer.from(sigBase64, 'base64');
      const sigImage = signatureDataUrl.includes('png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
      const scale = Math.min(260 / sigImage.width, 120 / sigImage.height, 1);
      const sw = sigImage.width * scale, sh = sigImage.height * scale;
      page.drawRectangle({ x: margin, y: y - sh - 10, width: sw + 20, height: sh + 20, borderColor: lightGray, borderWidth: 1 });
      page.drawImage(sigImage, { x: margin + 10, y: y - sh, width: sw, height: sh });
      y -= sh + 35;
    } catch { /* skip */ }
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: lightGray }); y -= 14;
  page.drawText('Digitally signed · legally binding under the Electronic Communications Act 2000 · PropAI Property Management', { x: margin, y, font, size: 8, color: gray, maxWidth: contentW });

  return pdfDoc.save();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('signing_tokens')
      .select('*')
      .eq('id', token)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (!data.signed_at) return NextResponse.json({ detail: 'Not yet signed' }, { status: 400 });

    // If we already have a stored PDF, redirect to it
    if (data.pdf_url) {
      return NextResponse.redirect(data.pdf_url);
    }

    // Regenerate PDF on the fly
    const pdfBytes = await buildPDF(
      {
        prospect_name: data.prospect_name,
        unit_address: data.unit_address,
        monthly_rent: data.monthly_rent,
        lease_content: data.lease_content ?? '',
      },
      data.signature_data_url ?? null,
      new Date(data.signed_at),
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="signed-lease-${data.prospect_name?.replace(/\s+/g, '-') ?? token}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF download error:', err);
    return NextResponse.json({ detail: 'Failed to generate PDF' }, { status: 500 });
  }
}
