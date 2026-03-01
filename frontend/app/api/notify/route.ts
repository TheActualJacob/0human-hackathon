import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, to, applicantName, propertyAddress, landlordName, rejectionReason, signingUrl } = await request.json();

    if (!to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    let subject: string;
    let html: string;

    if (type === 'accepted') {
      subject = `Your application for ${propertyAddress} has been accepted 🎉`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #e5e5e5; padding: 32px; border-radius: 12px;">
          <div style="border-bottom: 1px solid #27272a; padding-bottom: 24px; margin-bottom: 24px;">
            <h1 style="color: #22c55e; font-size: 22px; margin: 0;">Application Accepted</h1>
          </div>
          <p style="font-size: 16px;">Hi <strong>${applicantName}</strong>,</p>
          <p style="color: #a1a1aa;">Great news — your rental application for <strong style="color: #e5e5e5;">${propertyAddress}</strong> has been accepted by <strong style="color: #e5e5e5;">${landlordName}</strong>.</p>
          ${signingUrl ? `
          <div style="background: #18181b; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 16px; color: #a1a1aa; font-size: 14px;">Your tenancy agreement is ready to sign. Please review and sign it digitally using the link below:</p>
            <a href="${signingUrl}" style="display: inline-block; background: #22c55e; color: #000; font-weight: bold; font-size: 15px; padding: 12px 28px; border-radius: 6px; text-decoration: none;">Sign Your Lease Agreement →</a>
            <p style="margin: 12px 0 0; color: #52525b; font-size: 12px;">This link expires in 7 days.</p>
          </div>
          ` : `
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Your landlord will be in touch shortly with lease details and next steps.</p>
          </div>
          `}
          <p style="color: #71717a; font-size: 13px; margin-top: 32px;">This message was sent via PropAI Property Management.</p>
        </div>
      `;
    } else {
      subject = `Update on your application for ${propertyAddress}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #e5e5e5; padding: 32px; border-radius: 12px;">
          <div style="border-bottom: 1px solid #27272a; padding-bottom: 24px; margin-bottom: 24px;">
            <h1 style="color: #e5e5e5; font-size: 22px; margin: 0;">Application Update</h1>
          </div>
          <p style="font-size: 16px;">Hi <strong>${applicantName}</strong>,</p>
          <p style="color: #a1a1aa;">Thank you for your interest in <strong style="color: #e5e5e5;">${propertyAddress}</strong>. After careful consideration, <strong style="color: #e5e5e5;">${landlordName}</strong> has decided not to proceed with your application at this time.</p>
          ${rejectionReason ? `
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #a1a1aa; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Reason provided</p>
            <p style="margin: 0; color: #e5e5e5;">${rejectionReason}</p>
          </div>` : ''}
          <p style="color: #a1a1aa;">We encourage you to continue your search — there are many great properties available.</p>
          <p style="color: #71717a; font-size: 13px; margin-top: 32px;">This message was sent via PropAI Property Management.</p>
        </div>
      `;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PropAI <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Resend API error:', err);
      return NextResponse.json(
        { error: 'Failed to send email', details: JSON.stringify(err) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
