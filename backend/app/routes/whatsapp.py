from __future__ import annotations

import os
from urllib.parse import unquote_plus

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.config import settings
from app.services.agent_loop import run_agent_loop
from app.services.context_loader import (
    TenantContext,
    load_tenant_context,
    log_agent_action,
    log_conversation,
    update_conversation_context,
)
from app.services.prospect_context_loader import (
    load_or_create_prospect,
    log_prospect_conversation,
    update_prospect,
)
from app.services.prospect_agent_loop import run_prospect_agent_loop
from app.services.twilio_service import send_whatsapp_message, validate_twilio_signature

router = APIRouter(tags=["whatsapp"])


def _parse_form_body(raw: bytes) -> dict[str, str]:
    """Parse application/x-www-form-urlencoded body into a plain dict."""
    params: dict[str, str] = {}
    for pair in raw.decode("utf-8").split("&"):
        if "=" in pair:
            key, _, value = pair.partition("=")
            params[unquote_plus(key)] = unquote_plus(value)
    return params


@router.post("/api/webhook/whatsapp")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks) -> Response:
    body_bytes = await request.body()
    body = _parse_form_body(body_bytes)

    message_sid = body.get("MessageSid", "")
    from_number = body.get("From", "")  # e.g. "whatsapp:+447911123456"
    message_body = body.get("Body", "")
    num_media = int(body.get("NumMedia", "0"))

    # Extract any media URLs Twilio attached (images, documents, etc.)
    media_urls: list[str] = [
        body[f"MediaUrl{i}"]
        for i in range(num_media)
        if body.get(f"MediaUrl{i}")
    ]

    if not from_number or (not message_body and not media_urls):
        return Response(content="Bad Request", status_code=400)

    # Signature validation in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        signature = request.headers.get("x-twilio-signature", "")
        url = f"{settings.APP_URL}/webhook/whatsapp"
        if signature and not validate_twilio_signature(signature, url, body):
            return Response(content="Forbidden", status_code=403)

    # Strip whatsapp: prefix for DB lookup
    phone_number = from_number.removeprefix("whatsapp:")

    print(f"[webhook] Inbound message from {phone_number!r}: {message_body!r} media={media_urls}")
    ctx = await load_tenant_context(phone_number)
    print(f"[webhook] load_tenant_context result: {'FOUND tenant ' + ctx.tenant.full_name if ctx else 'NOT FOUND — routing to prospect'}")

    if ctx is None:
        # Unknown number — route through the prospect agent
        prospect_ctx = await load_or_create_prospect(phone_number)
        await log_prospect_conversation(
            prospect_id=prospect_ctx.prospect_id,
            direction="inbound",
            message_body=message_body or f"[{len(media_urls)} image(s) attached]",
            whatsapp_message_id=message_sid or None,
        )
        background_tasks.add_task(
            _process_and_reply_prospect, prospect_ctx, from_number, message_body, num_media
        )
        return Response(status_code=200)

    # Attach any media URLs to context so the maintenance tool can store them
    ctx.pending_media_urls = media_urls

    # Log inbound message before any processing
    log_body = message_body or f"[{len(media_urls)} image(s) attached]"
    await log_conversation(
        lease_id=ctx.lease.id,
        direction="inbound",
        message_body=log_body,
        whatsapp_message_id=message_sid or None,
    )

    # Schedule async processing — return 200 immediately to prevent Twilio retry
    background_tasks.add_task(_process_and_reply, ctx, from_number, message_body, media_urls)

    return Response(status_code=200)


async def _process_and_reply(
    ctx: TenantContext,
    to: str,
    user_message: str,
    media_urls: list[str],
) -> None:
    # Image-only messages (no text): ask tenant to describe the issue.
    # Photos are already on ctx.pending_media_urls so when they reply with
    # text and the agent calls schedule_maintenance, the URLs will be stored.
    if not user_message and media_urls:
        ack = (
            f"Thanks, I can see you've sent {len(media_urls)} photo(s). "
            "Please describe the issue in a message so I can log the repair correctly."
        )
        await log_conversation(ctx.lease.id, "outbound", ack)
        await send_whatsapp_message(to, ack)
        return

    reply_message = ""
    tools_used: list[str] = []
    intent = "general"

    try:
        result = await run_agent_loop(user_message, ctx)
        reply_message = result.final_message
        tools_used = result.tools_used
        intent = result.intent_classification

        if result.high_severity_actions:
            await _notify_landlord(ctx, result.high_severity_actions)

        await _refresh_conversation_context(ctx, user_message, reply_message, tools_used)

    except Exception as exc:
        print(f"Agent loop error: {exc}")
        reply_message = (
            "I encountered an issue processing your request. "
            "Please try again or contact your property manager directly."
        )
        await log_agent_action(
            lease_id=ctx.lease.id,
            action_category="other",
            action_description=f"Agent error: {exc}",
            tools_called=[],
            confidence_score=0,
        )

    await log_conversation(
        lease_id=ctx.lease.id,
        direction="outbound",
        message_body=reply_message,
        intent_classification=intent,
    )
    await send_whatsapp_message(to, reply_message)


async def _process_and_reply_prospect(
    prospect_ctx,
    to: str,
    user_message: str,
    num_media: int,
) -> None:
    if num_media > 0:
        ack = "Thanks for sending that! Could you describe what you're looking for in a message so I can help you better?"
        await log_prospect_conversation(prospect_ctx.prospect_id, "outbound", ack)
        await send_whatsapp_message(to, ack)
        return

    reply_message = ""
    try:
        result = await run_prospect_agent_loop(user_message, prospect_ctx)
        reply_message = result.final_message

        if result.application_link_sent and result.application_link:
            reply_message = f"{reply_message}\n\nApplication link: {result.application_link}"

        from datetime import date
        prev = prospect_ctx.conversation_summary or ""
        new_entry = (
            f"[{date.today().isoformat()}] "
            f'Prospect: "{user_message[:100]}". '
            f'Agent: "{reply_message[:100]}".'
        )
        updated = (prev + "\n" + new_entry).strip()[-1000:]
        await update_prospect(prospect_ctx.prospect_id, {"conversation_summary": updated})

    except Exception as exc:
        print(f"Prospect agent loop error: {exc}")
        reply_message = (
            "Thanks for your message! One of our team will be in touch shortly. "
            "You can also reach us by calling the office directly."
        )

    await log_prospect_conversation(prospect_ctx.prospect_id, "outbound", reply_message)
    await send_whatsapp_message(to, reply_message)


async def _notify_landlord(ctx: TenantContext, actions: list[str]) -> None:
    from supabase import create_client
    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    landlord_res = (
        sb.table("landlords").select("*").eq("id", ctx.landlord_id).maybe_single().execute()
    )
    landlord = (landlord_res.data if landlord_res else None)

    if landlord and landlord.get("whatsapp_number"):
        prefs = landlord.get("notification_preferences") or {}
        if prefs.get("whatsapp") is not False:
            summary = (
                f"[Property Alert] {ctx.unit.unit_identifier}, {ctx.unit.city}: {actions[0]}"
            )
            try:
                await send_whatsapp_message(landlord["whatsapp_number"], summary)
            except Exception as exc:
                print(f"Failed to notify landlord via WhatsApp: {exc}")


async def _refresh_conversation_context(
    ctx: TenantContext,
    user_message: str,
    agent_reply: str,
    tools_used: list[str],
) -> None:
    from datetime import date

    current_threads: dict = {}
    if ctx.conversation_context and isinstance(ctx.conversation_context.open_threads, dict):
        current_threads = dict(ctx.conversation_context.open_threads)

    prev_summary = (
        ctx.conversation_context.summary if ctx.conversation_context and ctx.conversation_context.summary else ""
    )
    tools_str = f" Tools used: {', '.join(tools_used)}." if tools_used else ""
    new_entry = (
        f"[{date.today().isoformat()}] Tenant: \"{user_message[:100]}\". "
        f"Agent: \"{agent_reply[:100]}\".{tools_str}"
    )
    updated_summary = (prev_summary + "\n" + new_entry).strip()[-1000:]

    await update_conversation_context(ctx.lease.id, updated_summary, current_threads)
