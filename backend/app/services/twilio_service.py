from twilio.rest import Client
from twilio.request_validator import RequestValidator

from app.config import settings


def _get_client() -> Client:
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def _normalize_to(number: str) -> str:
    return number if number.startswith("whatsapp:") else f"whatsapp:{number}"


async def send_whatsapp_message(to_number: str, body: str) -> str:
    """Send a WhatsApp message via Twilio. Returns the message SID."""
    client = _get_client()
    message = client.messages.create(
        from_=settings.TWILIO_WHATSAPP_NUMBER,
        to=_normalize_to(to_number),
        body=body,
    )
    return message.sid


def validate_twilio_signature(
    signature: str,
    url: str,
    params: dict[str, str],
) -> bool:
    """Validate the X-Twilio-Signature header to reject spoofed webhooks."""
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    return validator.validate(url, params, signature)
