from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def send_maintenance_email(
    to_email: str,
    property_address: str,
    unit_identifier: str,
    tenant_name: str,
    category: str,
    urgency: str,
    description: str,
    request_id: str,
    contractor_name: str | None = None,
) -> bool:
    """
    Send a maintenance job notification email via Gmail SMTP.
    Returns True if sent successfully, False otherwise.
    If GMAIL_ADDRESS or GMAIL_APP_PASSWORD are not configured, logs a warning and skips.
    """
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        print("[email_service] Gmail credentials not configured — skipping maintenance email.")
        return False

    urgency_label = {"emergency": "🚨 EMERGENCY", "high": "⚠️ HIGH PRIORITY", "routine": "📋 Routine"}.get(
        urgency, urgency.upper()
    )
    subject = f"[{urgency_label}] New Maintenance Job — {unit_identifier}, {property_address}"

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #fff; margin: 0;">PropAI Maintenance Request</h2>
    <p style="color: #aaa; margin: 4px 0 0;">Automated job notification</p>
  </div>
  <div style="border: 1px solid #ddd; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 160px; color: #555;">Request ID</td>
        <td style="padding: 8px 0; font-family: monospace;">{request_id}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; font-weight: bold; color: #555;">Urgency</td>
        <td style="padding: 8px; font-weight: bold; color: {'#d32f2f' if urgency == 'emergency' else '#f57c00' if urgency == 'high' else '#388e3c'};">
          {urgency_label}
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #555;">Property</td>
        <td style="padding: 8px 0;">{unit_identifier} — {property_address}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; font-weight: bold; color: #555;">Tenant</td>
        <td style="padding: 8px;">{tenant_name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #555;">Category</td>
        <td style="padding: 8px 0; text-transform: capitalize;">{category}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; font-weight: bold; color: #555; vertical-align: top;">Issue Description</td>
        <td style="padding: 8px;">{description}</td>
      </tr>
      {'<tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Assigned To</td><td style="padding: 8px 0;">' + contractor_name + '</td></tr>' if contractor_name else ''}
    </table>

    <div style="margin-top: 20px; padding: 12px; background: #fff8e1; border-left: 4px solid #ffc107; border-radius: 4px;">
      <strong>Action Required:</strong> Please confirm receipt and provide an estimated arrival time to the tenant.
    </div>
  </div>
  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 12px;">
    Sent automatically by PropAI Property Management
  </p>
</body>
</html>
"""

    text_body = (
        f"MAINTENANCE REQUEST — {urgency.upper()}\n"
        f"{'=' * 40}\n"
        f"Request ID:  {request_id}\n"
        f"Property:    {unit_identifier}, {property_address}\n"
        f"Tenant:      {tenant_name}\n"
        f"Category:    {category}\n"
        f"Urgency:     {urgency}\n"
        f"Description: {description}\n"
        + (f"Assigned To: {contractor_name}\n" if contractor_name else "")
        + "\nPlease confirm receipt and provide an ETA to the tenant.\n"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.GMAIL_ADDRESS
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_ADDRESS, to_email, msg.as_string())
        print(f"[email_service] Maintenance email sent to {to_email} for request {request_id}")
        return True
    except Exception as exc:
        print(f"[email_service] ERROR sending maintenance email to {to_email}: {exc!r}")
        return False
