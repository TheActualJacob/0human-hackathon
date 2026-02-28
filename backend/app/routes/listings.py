from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from supabase import create_client

from app.config import settings
from app.services.context_loader import log_conversation
from app.services.lease_expiry_service import (
    check_expiring_leases,
    check_unanswered_inquiries,
    trigger_listing_for_lease,
)
from app.services.twilio_service import send_whatsapp_message

router = APIRouter(prefix="/api/test", tags=["test"])


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _fmt_date(iso: str) -> str:
    from datetime import date
    try:
        d = date.fromisoformat(iso[:10])
        return d.strftime("%d %B %Y")
    except Exception:
        return iso


@router.post("/renewal-inquiry/{lease_id}")
async def test_send_renewal_inquiry(lease_id: str):
    """
    Manually trigger the renewal inquiry WhatsApp message for a specific lease.
    Sets renewal_status='pending' and renewal_inquiry_sent_at=now().
    """
    sb = _sb()

    lease_res = (
        sb.table("leases")
        .select("*, tenants!inner(*), units!inner(*)")
        .eq("id", lease_id)
        .single()
        .execute()
    )

    if not lease_res.data:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id} not found")

    lease = lease_res.data
    tenant_raw = lease.get("tenants")
    unit_raw = lease.get("units")
    tenant = tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw
    unit = unit_raw[0] if isinstance(unit_raw, list) else unit_raw

    if not tenant:
        raise HTTPException(status_code=400, detail="Lease has no associated tenant")

    whatsapp_number = tenant.get("whatsapp_number")
    if not whatsapp_number:
        raise HTTPException(status_code=400, detail="Tenant has no WhatsApp number")

    tenant_name = tenant.get("full_name", "there")
    end_date_str = _fmt_date(lease["end_date"]) if lease.get("end_date") else "soon"
    unit_address = unit.get("address", "your property") if unit else "your property"

    message = (
        f"Hi {tenant_name}, this is a message from your property management system. "
        f"Your tenancy at {unit_address} is due to expire on {end_date_str}. "
        f"We'd like to know if you're planning to renew your lease. "
        f"Please reply YES to renew or NO if you're planning to move out. "
        f"If we don't hear from you within 7 days, we may begin re-listing the property."
    )

    try:
        await send_whatsapp_message(whatsapp_number, message)
        whatsapp_sent = True
        whatsapp_error = None
    except Exception as exc:
        whatsapp_sent = False
        whatsapp_error = str(exc)
        print(f"[TestRoute] WhatsApp send failed: {exc}")

    # Log the outbound inquiry so Claude has conversation context when tenant replies
    await log_conversation(lease_id=lease_id, direction="outbound", message_body=message)

    sb.table("leases").update({
        "renewal_inquiry_sent_at": datetime.now(timezone.utc).isoformat(),
        "renewal_status": "pending",
    }).eq("id", lease_id).execute()

    return {
        "success": True,
        "lease_id": lease_id,
        "tenant": tenant_name,
        "whatsapp_number": whatsapp_number,
        "message_sent": whatsapp_sent,
        "whatsapp_error": whatsapp_error,
        "renewal_status": "pending",
        "note": "Tenant will be asked about renewal via WhatsApp. AI agent will call record_renewal_decision when they reply.",
    }


@router.post("/simulate-reply/{lease_id}")
async def simulate_tenant_reply(lease_id: str, message: str = "no"):
    """
    Directly runs the agent loop with a simulated tenant message (bypasses WhatsApp).
    Useful for debugging without needing real WhatsApp.
    """
    from app.services.agent_loop import run_agent_loop
    from app.services.context_loader import load_tenant_context

    sb = _sb()
    lease_res = (
        sb.table("leases")
        .select("*, tenants!inner(*)")
        .eq("id", lease_id)
        .single()
        .execute()
    )
    if not lease_res.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Lease not found")

    tenant_raw = lease_res.data.get("tenants")
    tenant = tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw
    phone = tenant.get("whatsapp_number") if tenant else None
    if not phone:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No tenant WhatsApp")

    ctx = await load_tenant_context(phone)
    if not ctx:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Could not load tenant context")

    result = await run_agent_loop(message, ctx)

    # If agent called record_renewal_decision, also directly probe the listing flow
    listing_debug = None
    if "record_renewal_decision" in result.tools_used:
        from app.services.lease_expiry_service import trigger_listing_for_lease
        from app.config import settings as cfg
        listing_debug = {
            "instagram_token_set": bool(cfg.INSTAGRAM_ACCESS_TOKEN),
            "gemini_key_set": bool(cfg.GEMINI_API_KEY),
        }
        try:
            listing_result = await trigger_listing_for_lease(lease_id)
            listing_debug["listing_result"] = listing_result
        except Exception as exc:
            listing_debug["listing_error"] = str(exc)

    return {
        "success": True,
        "message_sent": message,
        "agent_reply": result.final_message,
        "tools_used": result.tools_used,
        "renewal_status_before": ctx.lease.raw.get("renewal_status"),
        "listing_debug": listing_debug,
    }


@router.post("/reset-lease/{lease_id}")
async def reset_lease_for_testing(lease_id: str):
    """
    Resets a lease back to a clean state for re-testing the renewal flow.
    Clears renewal_status, renewal_inquiry_sent_at, instagram fields, conversations, and agent_actions.
    """
    sb = _sb()

    sb.table("leases").update({
        "renewal_status": None,
        "renewal_inquiry_sent_at": None,
        "instagram_post_url": None,
        "instagram_image_url": None,
    }).eq("id", lease_id).execute()

    sb.table("conversations").delete().eq("lease_id", lease_id).execute()
    sb.table("conversation_context").delete().eq("lease_id", lease_id).execute()

    return {"success": True, "lease_id": lease_id, "note": "Lease reset. Conversations and context cleared."}


@router.post("/instagram-listing/{lease_id}")
async def test_instagram_listing(lease_id: str):
    """
    Directly trigger the full listing flow for a lease — generates image, posts to Instagram,
    updates unit_status and dashboard. Skips the WhatsApp inquiry step.
    """
    sb = _sb()

    lease_res = sb.table("leases").select("id").eq("id", lease_id).maybe_single().execute()
    if not lease_res.data:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id} not found")

    result = await trigger_listing_for_lease(lease_id)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Listing flow failed"))

    return {
        "success": True,
        **result,
        "note": (
            "Listing flow completed. Check the dashboard notifications for the result. "
            + ("Instagram post live!" if result.get("instagram_success") else
               f"Instagram posting failed: {result.get('instagram_error', 'unknown error')} — image is ready at the image_url above.")
        ),
    }


@router.post("/expiry-check")
async def test_expiry_check():
    """
    Manually run the full daily cron logic right now.
    Checks for expiring leases and sends renewal inquiries,
    then checks for unanswered inquiries and auto-lists those properties.
    """
    inquiry_results = await check_expiring_leases()
    auto_list_results = await check_unanswered_inquiries()

    return {
        "success": True,
        "renewal_inquiries_sent": len(inquiry_results),
        "inquiry_lease_ids": inquiry_results,
        "auto_listed_count": len(auto_list_results),
        "auto_listed_lease_ids": auto_list_results,
    }


@router.get("/leases")
async def list_leases_for_testing():
    """
    Returns all active leases with their IDs for use in the test endpoints above.
    """
    sb = _sb()
    res = (
        sb.table("leases")
        .select("id, status, end_date, renewal_status, renewal_inquiry_sent_at, units(unit_identifier, address), tenants(full_name, whatsapp_number)")
        .in_("status", ["active", "notice_given"])
        .order("end_date")
        .execute()
    )
    return {"leases": res.data or []}
