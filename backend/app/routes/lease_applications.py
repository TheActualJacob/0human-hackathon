from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.twilio_service import send_whatsapp_message

router = APIRouter(tags=["lease_applications"])


def _sb():
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class ApplicationCreate(BaseModel):
    prospect_id: str
    unit_id: str | None = None
    full_name: str
    email: str
    phone: str | None = None
    current_address: str | None = None
    employment_status: str | None = None
    employer_name: str | None = None
    monthly_income: float | None = None
    references_text: str | None = None
    additional_info: str | None = None


class ApplicationApprove(BaseModel):
    landlord_notes: str | None = None
    lease_content: str


class ApplicationReject(BaseModel):
    landlord_notes: str | None = None


@router.post("/api/applications")
async def create_application(body: ApplicationCreate, background_tasks: BackgroundTasks):
    sb = _sb()

    prospect_res = sb.table("prospects").select("*").eq("id", body.prospect_id).maybe_single().execute()
    if not prospect_res or not prospect_res.data:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect = prospect_res.data
    unit_id = body.unit_id or prospect.get("interested_unit_id")

    res = sb.table("lease_applications").insert({
        "prospect_id": body.prospect_id,
        "unit_id": unit_id,
        "full_name": body.full_name,
        "email": body.email,
        "phone": body.phone,
        "current_address": body.current_address,
        "employment_status": body.employment_status,
        "employer_name": body.employer_name,
        "monthly_income": body.monthly_income,
        "references_text": body.references_text,
        "additional_info": body.additional_info,
        "status": "pending",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create application")

    app_id = res.data[0]["id"]

    updates: dict = {"status": "applied", "updated_at": datetime.now(timezone.utc).isoformat()}
    if body.full_name and not prospect.get("name"):
        updates["name"] = body.full_name
    if body.email and not prospect.get("email"):
        updates["email"] = body.email
    if unit_id and not prospect.get("interested_unit_id"):
        updates["interested_unit_id"] = unit_id
    sb.table("prospects").update(updates).eq("id", body.prospect_id).execute()

    _notify_landlord_application(prospect, body.full_name, unit_id, app_id)

    from app.services.application_review_agent import run_application_review
    background_tasks.add_task(run_application_review, application_id=app_id)

    return {"id": app_id, "status": "pending"}


@router.get("/api/applications/{application_id}")
async def get_application(application_id: str):
    sb = _sb()
    res = sb.table("lease_applications").select("*, prospects(phone_number, name, email, status, conversation_summary)").eq("id", application_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Application not found")
    return res.data


@router.get("/api/applications")
async def list_applications(status: str | None = None):
    sb = _sb()
    query = sb.table("lease_applications").select("*, prospects(phone_number, name, email, status)").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return res.data or []


@router.post("/api/applications/{application_id}/approve")
async def approve_application(application_id: str, body: ApplicationApprove):
    sb = _sb()

    app_res = sb.table("lease_applications").select("*, prospects(*), units(*)").eq("id", application_id).maybe_single().execute()
    if not app_res or not app_res.data:
        raise HTTPException(status_code=404, detail="Application not found")

    application = app_res.data
    prospect = application.get("prospects") or {}
    unit = application.get("units") or {}

    sb.table("lease_applications").update({
        "status": "approved",
        "landlord_notes": body.landlord_notes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application_id).execute()

    sb.table("prospects").update({
        "status": "approved",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application.get("prospect_id", "")).execute()

    unit_address = (
        f"{unit.get('unit_identifier', '')}, {unit.get('address', '')}, {unit.get('city', '')}"
        if unit else ""
    )
    monthly_rent = None
    if unit:
        rent_res = sb.table("leases").select("monthly_rent").eq("unit_id", unit.get("id", "")).order("created_at", desc=True).limit(1).maybe_single().execute()
        if rent_res and rent_res.data:
            monthly_rent = float(rent_res.data["monthly_rent"])

    token_res = sb.table("signing_tokens").insert({
        "prospect_id": application.get("prospect_id", ""),
        "application_id": application_id,
        "lease_content": body.lease_content,
        "prospect_name": application.get("full_name", prospect.get("name", "Applicant")),
        "prospect_phone": prospect.get("phone_number", ""),
        "unit_address": unit_address,
        "monthly_rent": monthly_rent,
    }).execute()

    if not token_res.data:
        raise HTTPException(status_code=500, detail="Failed to create signing token")

    token_id = token_res.data[0]["id"]
    app_url = settings.FRONTEND_URL or "http://localhost:3000"
    signing_link = f"{app_url}/sign/{token_id}"

    prospect_phone = prospect.get("phone_number", "")
    if prospect_phone:
        prospect_name = application.get("full_name") or prospect.get("name") or "there"
        message = (
            f"Hi {prospect_name}, great news! Your application has been approved.\n\n"
            f"Please review and sign your tenancy agreement at the link below. "
            f"The link expires in 7 days.\n\n{signing_link}"
        )
        try:
            wa_number = f"whatsapp:{prospect_phone}" if not prospect_phone.startswith("whatsapp:") else prospect_phone
            await send_whatsapp_message(wa_number, message)
        except Exception as exc:
            print(f"Failed to send signing link via WhatsApp: {exc}")

    sb.table("prospects").update({
        "status": "lease_sent",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application.get("prospect_id", "")).execute()

    return {"signing_token": token_id, "signing_link": signing_link}


@router.post("/api/applications/{application_id}/reject")
async def reject_application(application_id: str, body: ApplicationReject):
    sb = _sb()

    app_res = sb.table("lease_applications").select("*, prospects(phone_number, name)").eq("id", application_id).maybe_single().execute()
    if not app_res or not app_res.data:
        raise HTTPException(status_code=404, detail="Application not found")

    application = app_res.data
    prospect = application.get("prospects") or {}

    sb.table("lease_applications").update({
        "status": "rejected",
        "landlord_notes": body.landlord_notes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application_id).execute()

    sb.table("prospects").update({
        "status": "rejected",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application.get("prospect_id", "")).execute()

    prospect_phone = prospect.get("phone_number", "")
    if prospect_phone:
        prospect_name = prospect.get("name") or "there"
        message = (
            f"Hi {prospect_name}, thank you for your application. "
            f"Unfortunately we are unable to proceed with your application at this time. "
            f"If you have any questions, please reply to this message."
        )
        try:
            wa_number = f"whatsapp:{prospect_phone}" if not prospect_phone.startswith("whatsapp:") else prospect_phone
            await send_whatsapp_message(wa_number, message)
        except Exception as exc:
            print(f"Failed to send rejection notice via WhatsApp: {exc}")

    return {"status": "rejected"}


def _notify_landlord_application(prospect: dict, applicant_name: str, unit_id: str | None, application_id: str) -> None:
    try:
        sb = _sb()
        unit_str = ""
        if unit_id:
            unit_res = sb.table("units").select("unit_identifier, address").eq("id", unit_id).maybe_single().execute()
            if unit_res and unit_res.data:
                u = unit_res.data
                unit_str = f" for {u.get('unit_identifier', '')}, {u.get('address', '')}"
        landlords_res = sb.table("landlords").select("*").limit(1).execute()
        if landlords_res and landlords_res.data:
            landlord = landlords_res.data[0]
            sb.table("landlord_notifications").insert({
                "landlord_id": landlord["id"],
                "notification_type": "general",
                "message": f"New rental application received from {applicant_name}{unit_str}. Review it in the Prospects dashboard.",
                "related_record_type": "lease_applications",
                "related_record_id": application_id,
                "requires_signature": False,
            }).execute()
    except Exception as exc:
        print(f"Landlord notification error: {exc}")
