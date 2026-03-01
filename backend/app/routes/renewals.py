"""
Renewal Engine API Routes

All endpoints require authentication via the Supabase JWT bearer token.
The token is validated against the SUPABASE_SERVICE_ROLE_KEY.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header, status
from supabase import create_client

from app.config import settings
from app.schemas.renewals import (
    InitiateRenewalRequest,
    LandlordDecisionRequest,
    RunSimulationRequest,
    TenantResponseRequest,
    LandlordTerms,
)
from app.services.renewal_negotiation_service import analyse_tenant_response
from app.services.renewal_pricing_engine import run_pricing_simulation
from app.services.renewal_workflow_service import (
    initiate_renewal,
    run_scheduled_workflow,
    send_follow_up,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/renewals", tags=["renewals"])


# ── Auth ──────────────────────────────────────────────────────────────────────

async def _get_verified_user(authorization: str = Header(...)) -> dict[str, Any]:
    """Validate Supabase JWT and return user payload."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        user_res = sb.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"id": user_res.user.id, "email": user_res.user.email}
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("[RenewalRoutes] Auth error: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth failed")


# ── Part 4 — Financial Simulation Dashboard ───────────────────────────────────

@router.get("/leases/{lease_id}/simulation")
async def get_renewal_simulation(
    lease_id: str,
    market_rent: float | None = None,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """
    Run (or re-run) the full pricing simulation for a lease.
    Returns all scenario data ready for frontend charts.
    """
    try:
        return await run_pricing_simulation(lease_id, market_rent=market_rent)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.error("[RenewalRoutes] Simulation error lease %s: %s", lease_id, exc)
        raise HTTPException(status_code=500, detail="Simulation failed")


# ── Part 6 — Initiate Renewal Workflow ───────────────────────────────────────

@router.post("/leases/{lease_id}/initiate")
async def initiate_lease_renewal(
    lease_id: str,
    body: InitiateRenewalRequest,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """
    Trigger the full renewal workflow for a specific lease:
    score → price → generate AI offer → send to tenant.
    """
    try:
        terms_dict = body.terms.model_dump() if body.terms else None
        return await initiate_renewal(lease_id, market_rent=body.market_rent, landlord_terms=terms_dict)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.error("[RenewalRoutes] Initiate error lease %s: %s", lease_id, exc)
        raise HTTPException(status_code=500, detail="Failed to initiate renewal")


# ── Part 7 — Tenant Response Analysis ────────────────────────────────────────

@router.post("/offers/{offer_id}/respond")
async def record_tenant_response(
    offer_id: str,
    body: TenantResponseRequest,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """
    Submit a tenant's response message for AI sentiment analysis.
    Returns classification, suggested counter, and AI-drafted reply.
    """
    try:
        return await analyse_tenant_response(offer_id, body.tenant_message)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.error("[RenewalRoutes] Response analysis error offer %s: %s", offer_id, exc)
        raise HTTPException(status_code=500, detail="Response analysis failed")


# ── Part 8 — Landlord Decision ────────────────────────────────────────────────

@router.post("/offers/{offer_id}/decision")
async def record_landlord_decision(
    offer_id: str,
    body: LandlordDecisionRequest,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """
    Record landlord's decision on a negotiation log entry.
    accept → close as renewed | counter → update proposed rent | reject → trigger listing
    """
    from supabase import create_client as _create
    sb = _create(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    offer_res = sb.table("renewal_offers").select("*, leases(unit_id)").eq("id", offer_id).single().execute()
    if not offer_res.data:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer = offer_res.data
    update: dict[str, Any] = {}

    if body.decision == "accept":
        update["status"] = "accepted"
    elif body.decision == "reject":
        update["status"] = "rejected"
        # Trigger re-listing
        try:
            from app.services.lease_expiry_service import trigger_listing_for_lease
            await trigger_listing_for_lease(offer["lease_id"])
        except Exception as exc:
            log.warning("[RenewalRoutes] Listing trigger failed: %s", exc)
    elif body.decision == "counter":
        if not body.counter_rent:
            raise HTTPException(status_code=400, detail="counter_rent required for counter decision")
        update["proposed_rent"] = body.counter_rent
        update["status"] = "pending"
    elif body.decision == "escalate":
        update["status"] = "pending"

    if update:
        sb.table("renewal_offers").update(update).eq("id", offer_id).execute()

    # Log landlord decision in negotiation log
    sb.table("renewal_negotiation_logs").update({
        "landlord_decision":    body.decision,
        "landlord_decision_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }).eq("renewal_offer_id", offer_id).order("created_at", desc=True).limit(1).execute()

    return {"offer_id": offer_id, "decision": body.decision, "updated": update}


# ── Part 8 — Send Follow-up ───────────────────────────────────────────────────

@router.post("/offers/{offer_id}/follow-up")
async def trigger_follow_up(
    offer_id: str,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """Manually trigger a follow-up message for an unanswered offer."""
    sent = await send_follow_up(offer_id)
    return {"offer_id": offer_id, "sent": sent}


# ── Part 10 — Dashboard ───────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_renewal_dashboard(
    landlord_id: str,
    _user: dict = Depends(_get_verified_user),
) -> dict[str, Any]:
    """
    Returns full renewal dashboard data for a landlord:
    - All active leases with their latest renewal score
    - Pending offers + negotiation history
    - Revenue at risk / revenue opportunity summary
    """
    from supabase import create_client as _create
    sb = _create(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Fetch leases for this landlord
    leases_res = (
        sb.table("leases")
        .select("id, start_date, end_date, rent_amount, status, renewal_status, units!inner(landlord_id, address, unit_identifier), tenants(full_name, whatsapp_number, email)")
        .eq("units.landlord_id", landlord_id)
        .eq("status", "active")
        .execute()
    )
    leases = leases_res.data or []

    dashboard_items: list[dict] = []
    total_renewal_opportunity = 0.0
    total_at_risk_revenue = 0.0

    for lease in leases:
        lease_id = lease["id"]

        # Latest score
        score_res = (
            sb.table("renewal_scores")
            .select("*")
            .eq("lease_id", lease_id)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        score = score_res.data

        # Latest offer
        offer_res = (
            sb.table("renewal_offers")
            .select("id, status, proposed_rent, lease_duration_months, sent_at, responded_at, channel, ai_generated_content")
            .eq("lease_id", lease_id)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        offer = offer_res.data

        # Negotiation transcript (all rounds)
        neg_res = (
            sb.table("renewal_negotiation_logs")
            .select("id, tenant_message, ai_suggested_response, classification, sentiment_label, ai_suggested_counter_rent, ai_new_renewal_probability, created_at")
            .eq("lease_id", lease_id)
            .order("created_at", ascending=True)
            .execute()
        )
        negotiation_history = neg_res.data or []

        current_rent = float(lease.get("rent_amount") or 0)
        unit_raw = lease.get("units")
        unit = (unit_raw[0] if isinstance(unit_raw, list) else unit_raw) or {}
        tenant_raw = lease.get("tenants")
        tenant = (tenant_raw[0] if isinstance(tenant_raw, list) else tenant_raw) or {}

        # Revenue risk calc
        churn_prob = score["churn_probability"] if score else 0.3
        at_risk = current_rent * 12 * churn_prob
        total_at_risk_revenue += at_risk

        # Revenue opportunity
        if score:
            opportunity = score.get("projected_revenue_12m", 0) - current_rent * 12
            total_renewal_opportunity += max(0, opportunity)

        # Risk colour coding
        renewal_prob = score["renewal_probability"] if score else 0.5
        if renewal_prob >= 0.70:
            risk_color = "green"
        elif renewal_prob >= 0.40:
            risk_color = "amber"
        else:
            risk_color = "red"

        # Determine negotiation phase for the landlord dashboard
        offer_status = offer["status"] if offer else None
        if not offer:
            phase = "not_started"
        elif offer_status == "accepted":
            phase = "concluded_renewed"
        elif offer_status == "rejected":
            phase = "concluded_failed"
        elif offer_status in ("pending", "countered"):
            phase = "negotiating"
        else:
            phase = "not_started"

        # Strip internal landlord terms from the content shown to the UI
        offer_content = None
        if offer and offer.get("ai_generated_content"):
            offer_content = {k: v for k, v in offer["ai_generated_content"].items() if k != "_landlord_terms"}

        # Days since last contact
        last_contact_at = offer.get("responded_at") or offer.get("sent_at") if offer else None

        dashboard_items.append({
            "lease_id":                 lease_id,
            "tenant_name":              tenant.get("full_name", "Unknown"),
            "tenant_email":             tenant.get("email"),
            "tenant_whatsapp":          tenant.get("whatsapp_number"),
            "property":                 unit.get("unit_identifier") or unit.get("address", ""),
            "current_rent":             current_rent,
            "end_date":                 lease.get("end_date"),
            "renewal_probability":      renewal_prob,
            "recommended_increase_pct": score["recommended_increase_pct"] if score else None,
            "projected_revenue_12m":    score["projected_revenue_12m"] if score else current_rent * 12,
            "revenue_at_risk":          round(at_risk, 2),
            "risk_color":               risk_color,
            "confidence_score":         score["confidence_score"] if score else None,
            "phase":                    phase,
            "latest_offer":             {
                "id": offer.get("id") if offer else None,
                "status": offer_status,
                "proposed_rent": offer.get("proposed_rent") if offer else None,
                "lease_duration_months": offer.get("lease_duration_months") if offer else None,
                "sent_at": offer.get("sent_at") if offer else None,
                "responded_at": offer.get("responded_at") if offer else None,
                "channel": offer.get("channel") if offer else None,
            } if offer else None,
            "negotiation_rounds":       len(negotiation_history),
            "last_contact_at":          last_contact_at,
            "transcript":               negotiation_history,
        })

    # Sort: highest at-risk first
    dashboard_items.sort(key=lambda x: x["revenue_at_risk"], reverse=True)

    return {
        "landlord_id":              landlord_id,
        "total_active_leases":      len(leases),
        "total_at_risk_revenue":    round(total_at_risk_revenue, 2),
        "total_renewal_opportunity": round(total_renewal_opportunity, 2),
        "leases":                   dashboard_items,
    }


# ── Cron / Scheduler Endpoint ─────────────────────────────────────────────────

@router.post("/run-scheduled-workflow")
async def run_workflow(
    authorization: str = Header(...),
) -> dict[str, Any]:
    """
    Called by a cron job / Railway scheduled task.
    Processes all leases needing renewal action today.
    Secured by service-role bearer token.
    """
    if authorization != f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Forbidden")
    try:
        result = await run_scheduled_workflow()
        return {"status": "ok", "summary": result}
    except Exception as exc:
        log.error("[RenewalRoutes] Scheduled workflow error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
