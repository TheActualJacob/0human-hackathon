from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.context_loader import log_conversation
from app.services.twilio_service import send_whatsapp_message


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _fmt_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso[:10])
        return d.strftime("%d %B %Y")
    except Exception:
        return iso


async def check_expiring_leases() -> list[str]:
    """
    Daily job: Find active leases expiring in 28-35 days with no renewal inquiry sent.
    Sends WhatsApp to each tenant asking if they will renew.
    Returns list of lease IDs that were processed.
    """
    sb = _sb()
    today = date.today()
    window_start = (today + timedelta(days=28)).isoformat()
    window_end = (today + timedelta(days=35)).isoformat()

    print(f"[LeaseExpiry] Checking leases expiring between {window_start} and {window_end}")

    leases_res = (
        sb.table("leases")
        .select("*, tenants!inner(*), units!inner(*)")
        .eq("status", "active")
        .gte("end_date", window_start)
        .lte("end_date", window_end)
        .is_("renewal_inquiry_sent_at", "null")
        .execute()
    )

    leases = leases_res.data or []
    print(f"[LeaseExpiry] Found {len(leases)} leases needing renewal inquiry")

    processed = []
    for lease in leases:
        lease_id = lease["id"]
        tenant_raw = lease.get("tenants")
        unit_raw = lease.get("units")
        tenant = tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw
        unit = unit_raw[0] if isinstance(unit_raw, list) else unit_raw

        if not tenant or not unit:
            print(f"[LeaseExpiry] Skipping lease {lease_id}: missing tenant/unit data")
            continue

        tenant_name = tenant.get("full_name", "there")
        end_date_str = _fmt_date(lease["end_date"])
        unit_address = unit.get("address", "your property")
        whatsapp_number = tenant.get("whatsapp_number")

        if not whatsapp_number:
            print(f"[LeaseExpiry] Skipping lease {lease_id}: tenant has no WhatsApp number")
            continue

        message = (
            f"Hi {tenant_name}, this is a message from your property management system. "
            f"Your tenancy at {unit_address} is due to expire on {end_date_str}. "
            f"We'd like to know if you're planning to renew your lease. "
            f"Please reply YES to renew or NO if you're planning to move out. "
            f"If we don't hear from you within 7 days, we may begin re-listing the property."
        )

        try:
            await send_whatsapp_message(whatsapp_number, message)
            print(f"[LeaseExpiry] Sent renewal inquiry to {tenant_name} ({whatsapp_number}) for lease {lease_id}")
        except Exception as exc:
            print(f"[LeaseExpiry] Failed to send WhatsApp to {whatsapp_number}: {exc}")
            continue

        # Log the outbound inquiry so Claude has conversation context when tenant replies
        await log_conversation(lease_id=lease_id, direction="outbound", message_body=message)

        sb.table("leases").update({
            "renewal_inquiry_sent_at": datetime.now(timezone.utc).isoformat(),
            "renewal_status": "pending",
        }).eq("id", lease_id).execute()

        processed.append(lease_id)

    return processed


async def check_unanswered_inquiries() -> list[str]:
    """
    Daily job: Find leases where renewal inquiry was sent >7 days ago with no response.
    Auto-triggers the listing flow for these properties.
    Returns list of lease IDs that were auto-listed.
    """
    sb = _sb()
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    today = date.today()
    cutoff_date = (today + timedelta(days=28)).isoformat()

    print(f"[LeaseExpiry] Checking unanswered inquiries older than 7 days")

    leases_res = (
        sb.table("leases")
        .select("*, tenants!inner(*), units!inner(*)")
        .eq("renewal_status", "pending")
        .lte("renewal_inquiry_sent_at", seven_days_ago)
        .lte("end_date", cutoff_date)
        .execute()
    )

    leases = leases_res.data or []
    print(f"[LeaseExpiry] Found {len(leases)} unanswered inquiries — auto-listing")

    processed = []
    for lease in leases:
        lease_id = lease["id"]
        unit_raw = lease.get("units")
        tenant_raw = lease.get("tenants")
        unit = unit_raw[0] if isinstance(unit_raw, list) else unit_raw
        tenant = tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw

        if not unit:
            continue

        try:
            await _trigger_listing_flow(sb, lease, unit, tenant)
            processed.append(lease_id)
        except Exception as exc:
            print(f"[LeaseExpiry] Error auto-listing lease {lease_id}: {exc}")

    return processed


async def trigger_listing_for_lease(lease_id: str) -> dict[str, Any]:
    """
    Manually trigger the full listing flow for a given lease.
    Used by both the record_renewal_decision tool and the test endpoint.
    """
    from app.services.image_generation_service import generate_property_image
    from app.services.instagram_service import post_property_listing

    sb = _sb()

    lease_res = (
        sb.table("leases")
        .select("*, units!inner(*)")
        .eq("id", lease_id)
        .single()
        .execute()
    )

    if not lease_res.data:
        return {"success": False, "error": f"Lease {lease_id} not found"}

    lease = lease_res.data
    unit_raw = lease.get("units", {})
    unit = unit_raw[0] if isinstance(unit_raw, list) else unit_raw
    unit_id = unit.get("id") if unit else lease.get("unit_id")

    attrs_res = (
        sb.table("unit_attributes")
        .select("*")
        .eq("unit_id", unit_id)
        .maybe_single()
        .execute()
    )
    attrs = attrs_res.data if attrs_res else None

    landlord_id = unit.get("landlord_id")

    print(f"[LeaseExpiry] Generating property image for unit {unit_id}...")
    image_url = await generate_property_image(unit, attrs)

    print(f"[LeaseExpiry] Posting to Instagram...")
    ig_result = await post_property_listing(unit, attrs, lease, image_url)

    print(f"[LeaseExpiry] Updating lease {lease_id}: image_url={image_url}, post_url={ig_result.post_url}")
    update_res = sb.table("leases").update({
        "renewal_status": "not_renewing",
        "instagram_image_url": image_url,
        "instagram_post_url": ig_result.post_url,
    }).eq("id", lease_id).execute()
    print(f"[LeaseExpiry] Lease update result rows: {len(update_res.data) if update_res.data else 0}")

    sb.table("unit_status").upsert({
        "unit_id": unit_id,
        "occupancy_status": "notice_given",
    }, on_conflict="unit_id").execute()

    notification_message = (
        f"Property at {unit.get('unit_identifier', '')}, {unit.get('address', '')} "
        f"has been listed for re-letting. "
    )
    if ig_result.success and ig_result.post_url:
        notification_message += f"Instagram post: {ig_result.post_url}"
    elif ig_result.image_url:
        notification_message += (
            f"Instagram posting failed ({ig_result.error}). "
            f"Generated image ready: {ig_result.image_url}"
        )

    if landlord_id:
        sb.table("landlord_notifications").insert({
            "landlord_id": landlord_id,
            "lease_id": lease_id,
            "notification_type": "property_listed",
            "message": notification_message,
            "related_record_type": "leases",
            "related_record_id": lease_id,
        }).execute()

    return {
        "success": True,
        "lease_id": lease_id,
        "unit_id": unit_id,
        "image_url": image_url,
        "instagram_success": ig_result.success,
        "instagram_post_url": ig_result.post_url,
        "instagram_error": ig_result.error,
        "caption": ig_result.caption,
    }


async def _trigger_listing_flow(
    sb: Any,
    lease: dict[str, Any],
    unit: dict[str, Any],
    tenant: dict[str, Any] | None,
) -> None:
    lease_id = lease["id"]
    tenant_name = tenant.get("full_name", "the tenant") if tenant else "the tenant"
    whatsapp_number = tenant.get("whatsapp_number") if tenant else None

    if whatsapp_number:
        try:
            await send_whatsapp_message(
                whatsapp_number,
                f"Hi {tenant_name}, as we haven't received a response regarding your lease renewal, "
                f"we are proceeding to re-list the property. "
                f"If you do wish to renew, please contact us as soon as possible."
            )
        except Exception as exc:
            print(f"[LeaseExpiry] Could not notify tenant: {exc}")

    await trigger_listing_for_lease(lease_id)
