"""
Tenant Response Analysis & Autonomous Negotiation Service (Part 7 + 8 + 9)

When a tenant replies to a renewal offer via WhatsApp:
1. AI analyses sentiment and classifies intent
2. Autonomous decision based on landlord's pre-set terms:
   - accepting  → confirm deal, send confirmation to tenant, notify landlord with conclusion
   - negotiating within terms  → auto-counter, send new offer to tenant
   - negotiating below floor   → escalate to landlord
   - resistant  → politely close, trigger re-listing, notify landlord
3. Every exchange is logged to renewal_negotiation_logs
4. Landlord ONLY hears about it when the deal is done or escalation is needed
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from anthropic import Anthropic, APIError

from app.config import settings
from app.services.renewal_config import RENEWAL_CONFIG

log = logging.getLogger(__name__)


def _sb():
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _claude():
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Analysis Prompt ───────────────────────────────────────────────────────────

def _build_negotiation_prompt(
    tenant_message: str,
    tenant_name: str,
    current_proposed_rent: float,
    original_rent: float,
    lease_end: str,
    min_acceptable_rent: float,
    concessions: str | None,
    preferred_duration: int,
) -> str:
    concession_text = f"Landlord is willing to offer: {concessions}." if concessions else "No special concessions available."
    return f"""You are an autonomous property management negotiation agent. You negotiate lease renewals on behalf of the landlord.

LANDLORD'S NON-NEGOTIABLE TERMS:
- Minimum acceptable rent: €{min_acceptable_rent:.0f}/month (NEVER agree below this)
- Preferred lease duration: {preferred_duration} months
- {concession_text}

CURRENT SITUATION:
- Tenant: {tenant_name}
- Current rent: €{original_rent:.0f}/month
- Proposed renewal rent: €{current_proposed_rent:.0f}/month (+{((current_proposed_rent - original_rent) / original_rent * 100) if original_rent else 0:.1f}%)
- Lease expires: {lease_end}

TENANT'S LATEST MESSAGE:
"{tenant_message}"

Your task: analyse the tenant's message and decide the best autonomous action. Return ONLY valid JSON:
{{
  "sentiment_score": float between -1.0 and 1.0,
  "sentiment_label": "positive" | "neutral" | "negative",
  "classification": "accepting" | "negotiating" | "resistant" | "unclear",
  "classification_reasoning": "brief explanation",
  "new_renewal_probability": float 0.0–1.0,
  "suggested_counter_rent": float or null (the rent to counter with, must be >= {min_acceptable_rent:.0f} if negotiating),
  "response_to_tenant": "The exact message to send to the tenant. Be warm, professional, 2-3 sentences max.",
  "conclude_deal": boolean (true if tenant is accepting at or above floor rent),
  "trigger_relisting": boolean (true only if tenant is firmly refusing and there is no path to agreement),
  "escalate_to_landlord": boolean (true ONLY if situation is ambiguous and you cannot resolve autonomously),
  "escalation_reason": "string or null",
  "urgency": "low" | "medium" | "high"
}}"""


# ── AI Analysis ───────────────────────────────────────────────────────────────

async def _analyse_with_claude(prompt: str) -> dict[str, Any]:
    cfg = RENEWAL_CONFIG
    try:
        client = _claude()
        response = await asyncio.to_thread(
            client.messages.create,
            model=cfg.claude_model,
            max_tokens=cfg.claude_max_tokens_negotiation,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except (APIError, json.JSONDecodeError) as exc:
        log.warning("[RenewalNegotiation] Claude failed: %s", exc)
        return {}
    except Exception as exc:
        log.error("[RenewalNegotiation] Unexpected error: %s", exc)
        return {}


def _fallback_analysis(tenant_message: str, min_rent: float, proposed_rent: float) -> dict[str, Any]:
    msg = tenant_message.lower()
    if any(w in msg for w in ["yes", "accept", "agree", "happy", "sounds good", "fine", "ok", "okay"]):
        return {
            "classification": "accepting", "sentiment_score": 0.7, "sentiment_label": "positive",
            "new_renewal_probability": 0.88, "suggested_counter_rent": None,
            "response_to_tenant": "Wonderful! I'm so glad we've reached an agreement. I'll prepare your renewal documents and send them over shortly. Thank you for your continued tenancy!",
            "conclude_deal": True, "trigger_relisting": False, "escalate_to_landlord": False,
            "escalation_reason": None, "urgency": "low",
        }
    elif any(w in msg for w in ["no", "too high", "can't afford", "move", "leave", "reject", "not renewing"]):
        return {
            "classification": "resistant", "sentiment_score": -0.6, "sentiment_label": "negative",
            "new_renewal_probability": 0.10, "suggested_counter_rent": None,
            "response_to_tenant": "Thank you for letting us know. We're sorry to see you go. We'll begin the move-out process and someone will be in touch regarding the handover. We hope we can welcome you back in the future!",
            "conclude_deal": False, "trigger_relisting": True, "escalate_to_landlord": False,
            "escalation_reason": None, "urgency": "high",
        }
    elif any(w in msg for w in ["lower", "less", "negotiate", "offer", "counter", "€", "euro"]):
        counter = max(min_rent, proposed_rent * 0.97)
        return {
            "classification": "negotiating", "sentiment_score": 0.0, "sentiment_label": "neutral",
            "new_renewal_probability": 0.55, "suggested_counter_rent": counter,
            "response_to_tenant": f"Thank you for your feedback. We've reviewed our position and can offer a revised rent of €{counter:.0f}/month — this is the best we can do given current market conditions. Would you like to proceed on this basis?",
            "conclude_deal": False, "trigger_relisting": False, "escalate_to_landlord": False,
            "escalation_reason": None, "urgency": "medium",
        }
    else:
        return {
            "classification": "unclear", "sentiment_score": 0.0, "sentiment_label": "neutral",
            "new_renewal_probability": 0.50, "suggested_counter_rent": None,
            "response_to_tenant": "Thank you for your message. Could you please clarify whether you'd like to renew your lease? A simple 'yes' to renew or 'no' if you're planning to move out would help us proceed.",
            "conclude_deal": False, "trigger_relisting": False, "escalate_to_landlord": False,
            "escalation_reason": None, "urgency": "medium",
            "_fallback": True,
        }


# ── Autonomous Send ───────────────────────────────────────────────────────────

async def _send_to_tenant(whatsapp_number: str, message: str, lease_id: str, sb) -> None:
    """Send WhatsApp message to tenant and log it to conversations."""
    try:
        from app.services.twilio_service import send_whatsapp_message
        await send_whatsapp_message(whatsapp_number, message)
        log.info("[RenewalNegotiation] Sent autonomous reply to %s", whatsapp_number)
    except Exception as exc:
        log.warning("[RenewalNegotiation] WhatsApp send failed: %s", exc)

    try:
        sb.table("conversations").insert({
            "lease_id": lease_id,
            "direction": "outbound",
            "message_body": message,
            "intent_classification": "renewal_negotiation",
        }).execute()
    except Exception as exc:
        log.warning("[RenewalNegotiation] Failed to log outbound conversation: %s", exc)


def _notify_landlord(landlord_id: str, lease_id: str, message: str, notif_type: str, sb) -> None:
    try:
        sb.table("landlord_notifications").insert({
            "landlord_id": landlord_id,
            "lease_id": lease_id,
            "notification_type": notif_type,
            "message": message,
        }).execute()
    except Exception as exc:
        log.warning("[RenewalNegotiation] Landlord notification failed: %s", exc)


# ── Main Entry Point ──────────────────────────────────────────────────────────

async def analyse_tenant_response(
    offer_id: str,
    tenant_message: str,
) -> dict[str, Any]:
    """
    Process a tenant WhatsApp reply. The agent acts autonomously:
    - Sends response directly to the tenant
    - Only notifies landlord when deal is concluded or genuine escalation needed
    """
    sb = _sb()
    log.info("[RenewalNegotiation] Processing autonomous response for offer %s", offer_id)

    # ── Fetch offer + context ─────────────────────────────────────────────────
    offer_res = (
        sb.table("renewal_offers")
        .select("*, leases(*, tenants(*), units(landlord_id, address, city))")
        .eq("id", offer_id)
        .single()
        .execute()
    )
    if not offer_res.data:
        raise ValueError(f"Offer {offer_id} not found")

    offer = offer_res.data
    lease = offer.get("leases") or {}
    tenant_raw = lease.get("tenants")
    unit_raw = lease.get("units")
    tenant = (tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw) or {}
    unit = (unit_raw[0] if isinstance(unit_raw, list) else unit_raw) or {}

    tenant_name = tenant.get("full_name", "Tenant")
    tenant_phone = tenant.get("whatsapp_number")
    proposed_rent = float(offer.get("proposed_rent") or 0)
    original_rent = float(lease.get("monthly_rent") or 0)
    lease_end = lease.get("end_date", "")
    lease_id = offer.get("lease_id")
    landlord_id = unit.get("landlord_id")

    # ── Extract landlord terms stored in the offer ────────────────────────────
    ai_content = offer.get("ai_generated_content") or {}
    landlord_terms = ai_content.get("_landlord_terms") or {}
    min_rent = float(landlord_terms.get("min_acceptable_rent") or proposed_rent * 0.95)
    preferred_duration = int(landlord_terms.get("preferred_duration_months") or 12)
    concessions = landlord_terms.get("concessions")
    auto_negotiate = bool(landlord_terms.get("auto_negotiate", True))

    # ── AI Analysis ───────────────────────────────────────────────────────────
    prompt = _build_negotiation_prompt(
        tenant_message=tenant_message,
        tenant_name=tenant_name,
        current_proposed_rent=proposed_rent,
        original_rent=original_rent,
        lease_end=lease_end,
        min_acceptable_rent=min_rent,
        concessions=concessions,
        preferred_duration=preferred_duration,
    )
    analysis = await _analyse_with_claude(prompt)
    if not analysis:
        analysis = _fallback_analysis(tenant_message, min_rent, proposed_rent)

    # Ensure required fields
    analysis.setdefault("sentiment_score", 0.0)
    analysis.setdefault("sentiment_label", "neutral")
    analysis.setdefault("classification", "unclear")
    analysis.setdefault("new_renewal_probability", 0.50)
    analysis.setdefault("suggested_counter_rent", None)
    analysis.setdefault("response_to_tenant", "")
    analysis.setdefault("conclude_deal", False)
    analysis.setdefault("trigger_relisting", False)
    analysis.setdefault("escalate_to_landlord", False)

    classification = analysis["classification"]
    conclude_deal = analysis["conclude_deal"]
    trigger_relisting = analysis["trigger_relisting"]
    escalate = analysis["escalate_to_landlord"]

    # ── Safety check: validate counter doesn't breach floor ──────────────────
    counter_rent = analysis.get("suggested_counter_rent")
    if counter_rent and counter_rent < min_rent:
        # Counter is below floor — cannot auto-agree, escalate
        analysis["escalate_to_landlord"] = True
        escalate = True
        counter_rent = None
        analysis["suggested_counter_rent"] = None
        analysis["response_to_tenant"] = (
            "Thank you for your proposal. Let me check with the property manager on this and "
            "get back to you shortly."
        )

    # ── Determine new offer status ────────────────────────────────────────────
    if conclude_deal:
        new_status = "accepted"
    elif trigger_relisting:
        new_status = "rejected"
    elif classification == "negotiating" and not escalate:
        new_status = "countered"
    else:
        new_status = "pending"

    # ── Persist negotiation log ───────────────────────────────────────────────
    log_row = {
        "renewal_offer_id":             offer_id,
        "lease_id":                     lease_id,
        "tenant_message":               tenant_message,
        "sentiment_score":              analysis["sentiment_score"],
        "sentiment_label":              analysis["sentiment_label"],
        "classification":               classification,
        "ai_suggested_response":        analysis.get("response_to_tenant", ""),
        "ai_suggested_counter_rent":    counter_rent,
        "ai_new_renewal_probability":   analysis["new_renewal_probability"],
        "raw_ai_output":                analysis,
    }
    sb.table("renewal_negotiation_logs").insert(log_row).execute()

    # ── Update offer ──────────────────────────────────────────────────────────
    offer_update: dict[str, Any] = {"status": new_status, "responded_at": _now()}
    if new_status == "countered" and counter_rent:
        offer_update["proposed_rent"] = round(counter_rent, 2)
    sb.table("renewal_offers").update(offer_update).eq("id", offer_id).execute()

    # ── Outcome feedback ──────────────────────────────────────────────────────
    if conclude_deal or trigger_relisting:
        outcome = "renewed" if conclude_deal else "churned"
        increase_pct = ((proposed_rent - original_rent) / original_rent * 100) if original_rent else 0
        sb.table("renewal_outcome_feedback").insert({
            "lease_id":               lease_id,
            "renewal_offer_id":       offer_id,
            "increase_pct_offered":   round(increase_pct, 2),
            "increase_pct_accepted":  round(increase_pct, 2) if outcome == "renewed" else None,
            "outcome":                outcome,
        }).execute()

    # ── Autonomous reply to tenant ────────────────────────────────────────────
    response_text = analysis.get("response_to_tenant", "")
    if auto_negotiate and tenant_phone and response_text:
        await _send_to_tenant(tenant_phone, response_text, lease_id, sb)

    # ── Notify landlord ONLY for conclusions or genuine escalations ───────────
    if landlord_id:
        if conclude_deal:
            final_rent = counter_rent if (new_status == "countered" and counter_rent) else proposed_rent
            notif = (
                f"✅ Lease renewal AGREED with {tenant_name}. "
                f"Final rent: €{final_rent:.0f}/mo for {preferred_duration} months. "
                f"No action needed — renewal documents should now be generated."
            )
            _notify_landlord(landlord_id, lease_id, notif, "renewal_concluded_success", sb)

        elif trigger_relisting:
            notif = (
                f"❌ {tenant_name} has declined to renew their lease. "
                f"The property will need to be re-listed. "
                f"Re-listing workflow has been triggered."
            )
            _notify_landlord(landlord_id, lease_id, notif, "renewal_concluded_failed", sb)
            # Trigger re-listing
            try:
                from app.services.lease_expiry_service import trigger_listing_for_lease
                await trigger_listing_for_lease(lease_id)
            except Exception as exc:
                log.warning("[RenewalNegotiation] Listing trigger failed: %s", exc)

        elif escalate:
            reason = analysis.get("escalation_reason") or "Tenant made a request outside the agent's authority."
            notif = (
                f"⚠️ Renewal negotiation with {tenant_name} needs your attention. "
                f"Reason: {reason}. "
                f"Please review the conversation and respond manually."
            )
            _notify_landlord(landlord_id, lease_id, notif, "renewal_escalation", sb)

    log.info(
        "[RenewalNegotiation] Offer %s → %s (class=%s, conclude=%s, relist=%s, escalate=%s)",
        offer_id, new_status, classification, conclude_deal, trigger_relisting, escalate,
    )

    return {
        "offer_id":           offer_id,
        "lease_id":           lease_id,
        "classification":     classification,
        "new_offer_status":   new_status,
        "conclude_deal":      conclude_deal,
        "trigger_relisting":  trigger_relisting,
        "escalate":           escalate,
        "analysis":           analysis,
        "suggested_counter_rent": counter_rent,
        "response_sent_to_tenant": bool(auto_negotiate and tenant_phone and response_text),
    }
