from __future__ import annotations

from datetime import date

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.config import settings
from app.services.instagram_dm_service import send_instagram_dm
from app.services.prospect_agent_loop import run_prospect_agent_loop
from app.services.prospect_context_loader import (
    load_or_create_instagram_prospect,
    log_prospect_conversation,
    update_prospect,
)

router = APIRouter(tags=["instagram"])


# ---------------------------------------------------------------------------
# Hub verification — Meta sends a GET when you configure the webhook
# ---------------------------------------------------------------------------

@router.get("/api/webhook/instagram")
async def instagram_webhook_verify(request: Request) -> Response:
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.INSTAGRAM_VERIFY_TOKEN:
        print("[Instagram] Webhook verified successfully")
        return Response(content=challenge or "", media_type="text/plain")

    print(f"[Instagram] Webhook verification failed — mode={mode!r}, token={token!r}")
    return Response(content="Forbidden", status_code=403)


# ---------------------------------------------------------------------------
# Inbound DM webhook — Meta POSTs here for every new message
# ---------------------------------------------------------------------------

@router.post("/api/webhook/instagram")
async def instagram_webhook(request: Request, background_tasks: BackgroundTasks) -> Response:
    """
    Receives Instagram DM events from the Meta Messenger webhook.

    Payload shape (Messenger API for Instagram):
    {
      "object": "instagram",
      "entry": [{
        "id": "<ig-page-id>",
        "messaging": [{
          "sender":    {"id": "<IGSID>"},
          "recipient": {"id": "<ig-page-id>"},
          "timestamp": 1234567890,
          "message":   {"mid": "...", "text": "..."}
        }]
      }]
    }
    """
    try:
        body = await request.json()
    except Exception:
        return Response(content="Bad Request", status_code=400)

    if body.get("object") != "instagram":
        return Response(status_code=200)

    for entry in body.get("entry", []):
        for event in entry.get("messaging", []):
            msg_obj = event.get("message", {})

            # Ignore echo events (messages sent by the page itself)
            if msg_obj.get("is_echo"):
                continue

            sender_igsid: str = event.get("sender", {}).get("id", "")
            message_text: str = msg_obj.get("text", "")
            message_id: str = msg_obj.get("mid", "")

            if not sender_igsid or not message_text:
                continue

            prospect_ctx = await load_or_create_instagram_prospect(sender_igsid)

            await log_prospect_conversation(
                prospect_id=prospect_ctx.prospect_id,
                direction="inbound",
                message_body=message_text,
                whatsapp_message_id=message_id or None,
                source_channel="instagram_dm",
            )

            background_tasks.add_task(
                _process_and_reply_instagram,
                prospect_ctx,
                sender_igsid,
                message_text,
            )

    return Response(status_code=200)


# ---------------------------------------------------------------------------
# Agent processing + reply
# ---------------------------------------------------------------------------

async def _process_and_reply_instagram(
    prospect_ctx,
    igsid: str,
    user_message: str,
) -> None:
    reply_message = ""
    try:
        result = await run_prospect_agent_loop(user_message, prospect_ctx)
        reply_message = result.final_message

        if result.application_link_sent and result.application_link:
            reply_message = f"{reply_message}\n\nApplication link: {result.application_link}"

        prev = prospect_ctx.conversation_summary or ""
        new_entry = (
            f"[{date.today().isoformat()}] "
            f'Prospect: "{user_message[:100]}". '
            f'Agent: "{reply_message[:100]}".'
        )
        updated = (prev + "\n" + new_entry).strip()[-1000:]
        await update_prospect(prospect_ctx.prospect_id, {"conversation_summary": updated})

    except Exception as exc:
        print(f"[Instagram] Prospect agent error: {exc}")
        reply_message = (
            "Thanks for your message! One of our team will be in touch shortly."
        )

    await log_prospect_conversation(
        prospect_id=prospect_ctx.prospect_id,
        direction="outbound",
        message_body=reply_message,
        source_channel="instagram_dm",
    )
    await send_instagram_dm(igsid, reply_message)
