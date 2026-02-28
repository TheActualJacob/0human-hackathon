import asyncio
import logging

from twilio.rest import Client

from app.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self) -> None:
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.warning("Twilio credentials not configured; WhatsApp running in DRY RUN mode")
            self._client = None
        else:
            self._client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        self._from_number = settings.TWILIO_WHATSAPP_FROM

    async def send_message(self, to_number: str, body: str) -> str | None:
        if not self._client:
            logger.info(f"[DRY RUN] WhatsApp to {to_number}: {body[:120]}...")
            return None

        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"

        def _send() -> str:
            message = self._client.messages.create(
                body=body,
                from_=self._from_number,
                to=to_number,
            )
            return message.sid

        try:
            sid = await asyncio.to_thread(_send)
            logger.info(f"WhatsApp sent to {to_number}: SID={sid}")
            return sid
        except Exception as e:
            logger.error(f"WhatsApp send failed to {to_number}: {e}")
            return None

    # ── Message templates ──

    def format_receipt(self, tenant_name: str, amount: float, unit: str, paid_date: str) -> str:
        return (
            f"Hi {tenant_name},\n\n"
            f"Your payment of £{amount:.2f} for {unit} has been received and recorded on {paid_date}.\n\n"
            f"Thank you for your prompt payment.\n\n"
            f"- PropAI Property Management"
        )

    def format_reminder_green(self, tenant_name: str, amount: float, unit: str, days_overdue: int) -> str:
        return (
            f"Hi {tenant_name},\n\n"
            f"This is a friendly reminder that your rent payment of £{amount:.2f} for {unit} "
            f"was due {days_overdue} days ago.\n\n"
            f"If you have already paid, please disregard this message. "
            f"Otherwise, please arrange payment at your earliest convenience.\n\n"
            f"- PropAI Property Management"
        )

    def format_reminder_yellow(self, tenant_name: str, amount: float, unit: str, days_overdue: int) -> str:
        return (
            f"Hi {tenant_name},\n\n"
            f"Your rent payment of £{amount:.2f} for {unit} is now {days_overdue} days overdue.\n\n"
            f"Please arrange payment as soon as possible to avoid further action. "
            f"If you are experiencing financial difficulties, please contact us to discuss a payment plan.\n\n"
            f"- PropAI Property Management"
        )

    def format_reminder_red(self, tenant_name: str, amount: float, unit: str, days_overdue: int) -> str:
        return (
            f"Hi {tenant_name},\n\n"
            f"FINAL NOTICE: Your rent payment of £{amount:.2f} for {unit} is now {days_overdue} days overdue.\n\n"
            f"This is a formal notice that your landlord has been alerted. "
            f"Please make payment immediately or contact us to arrange a payment plan "
            f"to avoid potential legal proceedings.\n\n"
            f"- PropAI Property Management"
        )

    def format_landlord_alert(
        self, landlord_name: str, tenant_name: str, unit: str, amount: float, days_overdue: int
    ) -> str:
        return (
            f"Hi {landlord_name},\n\n"
            f"ALERT: Tenant {tenant_name} at {unit} has an overdue payment of £{amount:.2f} "
            f"({days_overdue} days late).\n\n"
            f"Automated reminders have been sent. Please review and decide on next steps "
            f"(payment plan, formal notice, or other action).\n\n"
            f"- PropAI Property Management"
        )

    def format_landlord_day20(
        self, landlord_name: str, tenant_name: str, unit: str, amount: float, days_overdue: int
    ) -> str:
        return (
            f"Hi {landlord_name},\n\n"
            f"REQUIRES YOUR DECISION: Tenant {tenant_name} at {unit} has an overdue payment "
            f"of £{amount:.2f} ({days_overdue} days late).\n\n"
            f"Suggested options:\n"
            f"1. Offer a payment plan\n"
            f"2. Issue a formal payment demand letter\n"
            f"3. Begin Section 8 notice process\n"
            f"4. Arrange a direct conversation\n\n"
            f"Please respond with your preferred course of action.\n\n"
            f"- PropAI Property Management"
        )

    def format_monthly_report_notification(
        self, landlord_name: str, period: str, collected: float, expected: float, rate: float
    ) -> str:
        return (
            f"Hi {landlord_name},\n\n"
            f"Your monthly property report for {period} is ready:\n\n"
            f"- Total Collected: £{collected:.2f}\n"
            f"- Total Expected: £{expected:.2f}\n"
            f"- Collection Rate: {rate:.1f}%\n\n"
            f"View the full report in your PropAI dashboard.\n\n"
            f"- PropAI Property Management"
        )


whatsapp_service = WhatsAppService()
