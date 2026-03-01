"""
Automated Renewal Workflow Service (Part 6 + Part 8 Escalation)

Orchestrates the full lifecycle:
  90 days before expiry → score → price → generate offer → send via channel
  +7 days no response  → follow-up
  +14 days no response → trigger listing workflow
  Rejected            → trigger listing workflow
  Counter-offer       → log for negotiation service
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.renewal_config import RENEWAL_CONFIG
from app.services.renewal_pricing_engine import run_pricing_simulation
from app.services.renewal_content_generator import generate_renewal_offer
from app.services.twilio_service import send_whatsapp_message

log = logging.getLogger(__name__)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Channel Dispatch ─────────────────────────────────────────────────────────

async def _send_offer(
    channel: str,
    tenant_name: str,
    whatsapp_number: str | None,
    email: str | None,
    ai_content: dict[str, Any],
) -> bool:
    """Dispatch renewal offer via tenant's preferred channel. Returns success bool."""
    cfg = RENEWAL_CONFIG

    if channel == "whatsapp" and whatsapp_number:
        opts = ai_content.get("options", [])
        option_lines = "\n".join(
            f"  • {o['label']}: €{o['monthly_rent']}/mo (+{o['increase_pct']}%)"
            for o in opts
        )
        msg = (
            f"{ai_content.get('greeting', f'Hi {tenant_name},')} "
            f"{ai_content.get('market_justification', '')} "
            f"\n\nRenewal options:\n{option_lines}"
            f"\n\n{ai_content.get('call_to_action', 'Please reply to confirm your option.')}"
        )
        try:
            await send_whatsapp_message(whatsapp_number, msg)
            log.info("[RenewalWorkflow] WhatsApp sent to %s", whatsapp_number)
            return True
        except Exception as exc:
            log.warning("[RenewalWorkflow] WhatsApp failed: %s", exc)
            return False

    if channel == "email" and email:
        try:
            from app.services.email_service import send_email
            await send_email(
                to=email,
                subject=ai_content.get("subject", "Your Lease Renewal"),
                body=ai_content.get("body", ""),
            )
            log.info("[RenewalWorkflow] Email sent to %s", email)
            return True
        except Exception as exc:
            log.warning("[RenewalWorkflow] Email failed: %s", exc)
            return False

    log.warning("[RenewalWorkflow] No valid channel/contact for tenant %s", tenant_name)
    return False


# ── Core Workflow Steps ───────────────────────────────────────────────────────

async def initiate_renewal(lease_id: str, market_rent: float | None = None, landlord_terms: dict | None = None) -> dict[str, Any]:
    """
    Full renewal initiation for one lease:
    1. Run pricing simulation (scores + scenarios)
    2. Generate AI offer content
    3. Persist renewal_offer row
    4. Send via channel
    5. Notify landlord
    """
    sb = _sb()
    log.info("[RenewalWorkflow] Initiating renewal for lease %s", lease_id)

    # ── Fetch lease + tenant + unit ───────────────────────────────────────────
    lease_res = (
        sb.table("leases")
        .select("*, tenants!inner(*), units!inner(*)")
        .eq("id", lease_id)
        .single()
        .execute()
    )
    if not lease_res.data:
        raise ValueError(f"Lease {lease_id} not found")

    lease = lease_res.data
    tenant_raw = lease.get("tenants")
    unit_raw = lease.get("units")
    tenant = (tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw) or {}
    unit = (unit_raw[0] if isinstance(unit_raw, list) else unit_raw) or {}

    tenant_name = tenant.get("full_name", "Tenant")
    whatsapp = tenant.get("whatsapp_number")
    email = tenant.get("email")
    property_address = f"{unit.get('address', '')}, {unit.get('city', '')}".strip(", ")
    current_rent = float(lease.get("rent_amount") or 0)

    # ── Pricing simulation ────────────────────────────────────────────────────
    sim = await run_pricing_simulation(lease_id, market_rent=market_rent)
    recommended = sim["recommended_scenario"]
    score = sim["score"]

    # ── AI content generation ─────────────────────────────────────────────────
    payments_res = sb.table("payments").select("*").eq("lease_id", lease_id).execute()
    payments = payments_res.data or []
    on_time_pct = (
        sum(1 for p in payments if p.get("status") == "paid") / len(payments) * 100
        if payments else 50.0
    )
    open_maint = (
        sb.table("maintenance_requests")
        .select("id", count="exact")
        .eq("lease_id", lease_id)
        .in_("status", ["open", "in_progress"])
        .execute()
    )
    open_maint_count = open_maint.count or 0

    ai_content = await generate_renewal_offer(
        lease_id=lease_id,
        recommended_increase_pct=recommended["increase_pct"],
        tenant_name=tenant_name,
        property_address=property_address,
        lease_start=lease.get("start_date", ""),
        lease_months=score["lease_months"],
        current_rent=current_rent,
        market_rent=score["market_rent"],
        payment_reliability_pct=on_time_pct,
        open_maintenance_count=open_maint_count,
    )

    # ── Determine channel ─────────────────────────────────────────────────────
    channel = "whatsapp" if whatsapp else ("email" if email else "in_app")
    cfg = RENEWAL_CONFIG

    # ── Skip if confidence too low — require landlord approval first ──────────
    requires_approval = score["confidence_score"] < cfg.min_confidence_to_auto_send
    sent_at = None
    send_success = False

    if not requires_approval:
        send_success = await _send_offer(channel, tenant_name, whatsapp, email, ai_content)
        sent_at = _now() if send_success else None

    # ── Persist renewal_offer ─────────────────────────────────────────────────
    proposed_rent = current_rent * (1 + recommended["increase_pct"] / 100.0)
    # Embed landlord terms inside ai_generated_content so negotiation service can read them
    ai_content_stored = {**ai_content, "_landlord_terms": landlord_terms or {}}
    preferred_duration = (landlord_terms or {}).get("preferred_duration_months", 12)
    offer_row = {
        "lease_id":              lease_id,
        "proposed_rent":         round(proposed_rent, 2),
        "lease_duration_months": preferred_duration,
        "status":                "pending",
        "channel":               channel,
        "sent_at":               sent_at,
        "ai_generated_content":  ai_content_stored,
    }
    offer_res = sb.table("renewal_offers").insert(offer_row).execute()
    offer_id = offer_res.data[0]["id"] if offer_res.data else None

    # If terms include a min_rent floor and proposed rent is below it, raise to floor
    if landlord_terms and landlord_terms.get("min_acceptable_rent"):
        floor = float(landlord_terms["min_acceptable_rent"])
        if proposed_rent < floor:
            proposed_rent = floor
            if offer_id:
                sb.table("renewal_offers").update({"proposed_rent": round(floor, 2)}).eq("id", offer_id).execute()

    # ── Landlord notification ─────────────────────────────────────────────────
    landlord_id = unit.get("landlord_id")
    if landlord_id:
        msg = (
            f"Renewal initiated for {tenant_name} at {property_address}. "
            f"Recommended increase: {recommended['increase_pct']}% → €{proposed_rent:.0f}/mo. "
            f"Renewal probability: {score['renewal_probability']*100:.0f}%."
        )
        if requires_approval:
            msg += " ⚠️ Low confidence — awaiting your approval before sending."
        sb.table("landlord_notifications").insert({
            "landlord_id":       landlord_id,
            "lease_id":          lease_id,
            "notification_type": "renewal_initiated",
            "message":           msg,
        }).execute()

    log.info(
        "[RenewalWorkflow] Lease %s offer_id=%s sent=%s requires_approval=%s",
        lease_id, offer_id, send_success, requires_approval,
    )

    return {
        "lease_id":           lease_id,
        "offer_id":           offer_id,
        "simulation":         sim,
        "ai_content":         ai_content,
        "channel":            channel,
        "sent":               send_success,
        "requires_approval":  requires_approval,
        "proposed_rent":      round(proposed_rent, 2),
        "recommended_increase_pct": recommended["increase_pct"],
    }


async def send_follow_up(offer_id: str) -> bool:
    """Send a follow-up message for an unanswered offer."""
    sb = _sb()
    offer_res = sb.table("renewal_offers").select("*, leases(*, tenants(*), units(*))").eq("id", offer_id).single().execute()
    if not offer_res.data:
        return False

    offer = offer_res.data
    lease = offer.get("leases", {}) or {}
    tenant_raw = lease.get("tenants")
    unit_raw = lease.get("units")
    tenant = (tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw) or {}
    unit = (unit_raw[0] if isinstance(unit_raw, list) else unit_raw) or {}

    tenant_name = tenant.get("full_name", "there")
    whatsapp = tenant.get("whatsapp_number")
    address = unit.get("address", "your property")

    msg = (
        f"Hi {tenant_name}, just a gentle reminder — we sent you a lease renewal proposal "
        f"for {address} a week ago and haven't heard back. "
        f"Please let us know whether you'd like to renew, as we need to plan accordingly. "
        f"Reply YES to renew or NO if you're planning to move out."
    )

    success = False
    if whatsapp:
        try:
            await send_whatsapp_message(whatsapp, msg)
            success = True
        except Exception as exc:
            log.warning("[RenewalWorkflow] Follow-up WhatsApp failed: %s", exc)

    sb.table("renewal_offers").update({
        "follow_up_sent_at": _now(),
        "follow_up_count":   (offer.get("follow_up_count") or 0) + 1,
    }).eq("id", offer_id).execute()

    return success


async def run_scheduled_workflow() -> dict[str, Any]:
    """
    Cron-callable. Processes all leases needing renewal action:
    - 90 days from expiry → initiate
    - Pending + no response 7 days → follow-up
    - Pending + no response 14 days → auto-list
    Returns summary of actions taken.
    """
    sb = _sb()
    cfg = RENEWAL_CONFIG
    today = date.today()
    summary: dict[str, list] = {"initiated": [], "followed_up": [], "auto_listed": [], "errors": []}

    # ── 1. Initiate for leases hitting the 90-day window ─────────────────────
    window_start = (today + timedelta(days=cfg.first_contact_days_before_expiry - 5)).isoformat()
    window_end = (today + timedelta(days=cfg.first_contact_days_before_expiry + 5)).isoformat()

    candidates_res = (
        sb.table("leases")
        .select("id")
        .eq("status", "active")
        .gte("end_date", window_start)
        .lte("end_date", window_end)
        .execute()
    )
    for row in candidates_res.data or []:
        # Skip if offer already exists for this lease
        existing = sb.table("renewal_offers").select("id").eq("lease_id", row["id"]).execute()
        if existing.data:
            continue
        try:
            await initiate_renewal(row["id"])
            summary["initiated"].append(row["id"])
        except Exception as exc:
            log.error("[RenewalWorkflow] Error initiating lease %s: %s", row["id"], exc)
            summary["errors"].append({"lease_id": row["id"], "error": str(exc)})

    # ── 2. Follow-ups for unanswered offers ───────────────────────────────────
    followup_cutoff = (datetime.now(timezone.utc) - timedelta(days=cfg.followup_days_no_response)).isoformat()
    auto_list_cutoff = (datetime.now(timezone.utc) - timedelta(days=cfg.auto_list_days_no_response)).isoformat()

    pending_offers_res = (
        sb.table("renewal_offers")
        .select("id, lease_id, sent_at, follow_up_count, follow_up_sent_at")
        .eq("status", "pending")
        .not_.is_("sent_at", "null")
        .execute()
    )
    for offer in pending_offers_res.data or []:
        sent_at = offer.get("sent_at") or ""
        follow_up_sent = offer.get("follow_up_sent_at")
        follow_up_count = offer.get("follow_up_count") or 0

        # Auto-list if silent for 14 days
        if sent_at <= auto_list_cutoff and follow_up_count >= 1:
            try:
                from app.services.lease_expiry_service import trigger_listing_for_lease
                await trigger_listing_for_lease(offer["lease_id"])
                sb.table("renewal_offers").update({"status": "expired"}).eq("id", offer["id"]).execute()
                summary["auto_listed"].append(offer["lease_id"])
            except Exception as exc:
                log.error("[RenewalWorkflow] Auto-list error lease %s: %s", offer["lease_id"], exc)
                summary["errors"].append({"lease_id": offer["lease_id"], "error": str(exc)})

        # Follow-up if silent for 7 days and not yet followed up
        elif sent_at <= followup_cutoff and follow_up_count == 0:
            try:
                await send_follow_up(offer["id"])
                summary["followed_up"].append(offer["id"])
            except Exception as exc:
                log.error("[RenewalWorkflow] Follow-up error offer %s: %s", offer["id"], exc)

    log.info("[RenewalWorkflow] Scheduled run complete: %s", {k: len(v) for k, v in summary.items()})
    return summary
