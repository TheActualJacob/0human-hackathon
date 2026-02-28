from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from supabase import create_client, Client

from app.config import settings


def _get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@dataclass
class AvailableUnit:
    id: str
    unit_identifier: str
    address: str
    city: str
    postcode: str | None
    bedrooms: int | None
    monthly_rent: float | None
    jurisdiction: str | None
    raw: dict[str, Any]


@dataclass
class ProspectConversation:
    id: str
    direction: str
    message_body: str
    created_at: str | None
    raw: dict[str, Any]


@dataclass
class ProspectContext:
    prospect_id: str
    phone_number: str
    name: str | None
    status: str
    conversation_summary: str | None
    available_units: list[AvailableUnit] = field(default_factory=list)
    recent_conversations: list[ProspectConversation] = field(default_factory=list)
    interested_unit: AvailableUnit | None = None


async def load_or_create_prospect(phone_number: str) -> ProspectContext:
    sb = _get_supabase()
    phone = phone_number.removeprefix("whatsapp:")

    prospect_res = (
        sb.table("prospects")
        .select("*")
        .eq("phone_number", phone)
        .maybe_single()
        .execute()
    )

    if prospect_res and prospect_res.data:
        prospect = prospect_res.data
    else:
        insert_res = (
            sb.table("prospects")
            .insert({"phone_number": phone, "status": "inquiring"})
            .execute()
        )
        prospect = insert_res.data[0] if insert_res.data else {"id": "", "phone_number": phone, "status": "inquiring"}

    prospect_id = prospect["id"]

    convs_res = (
        sb.table("prospect_conversations")
        .select("*")
        .eq("prospect_id", prospect_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    raw_convs = convs_res.data or []
    recent_conversations = [
        ProspectConversation(
            id=r["id"],
            direction=r["direction"],
            message_body=r["message_body"],
            created_at=r.get("created_at"),
            raw=r,
        )
        for r in reversed(raw_convs)
    ]

    units_res = sb.table("units").select("*, leases(status)").execute()
    all_units = units_res.data or []

    def _is_available(u: dict) -> bool:
        leases = u.get("leases") or []
        return len([l for l in leases if l.get("status") == "active"]) == 0

    available_units = [_build_unit(u) for u in all_units if _is_available(u)]

    interested_unit: AvailableUnit | None = None
    if prospect.get("interested_unit_id"):
        for u in available_units:
            if u.id == prospect["interested_unit_id"]:
                interested_unit = u
                break
        if interested_unit is None:
            unit_res = (
                sb.table("units")
                .select("*")
                .eq("id", prospect["interested_unit_id"])
                .maybe_single()
                .execute()
            )
            if unit_res and unit_res.data:
                interested_unit = _build_unit(unit_res.data)

    return ProspectContext(
        prospect_id=prospect_id,
        phone_number=phone,
        name=prospect.get("name"),
        status=prospect.get("status", "inquiring"),
        conversation_summary=prospect.get("conversation_summary"),
        available_units=available_units,
        recent_conversations=recent_conversations,
        interested_unit=interested_unit,
    )


def _build_unit(u: dict) -> AvailableUnit:
    attrs = u.get("unit_attributes") or {}
    if isinstance(attrs, list) and attrs:
        attrs = attrs[0]
    monthly_rent: float | None = None
    for l in (u.get("leases") or []):
        if l.get("monthly_rent"):
            monthly_rent = float(l["monthly_rent"])
            break
    return AvailableUnit(
        id=u["id"],
        unit_identifier=u.get("unit_identifier", ""),
        address=u.get("address", ""),
        city=u.get("city", ""),
        postcode=u.get("postcode"),
        bedrooms=attrs.get("bedrooms") if isinstance(attrs, dict) else None,
        monthly_rent=monthly_rent,
        jurisdiction=u.get("jurisdiction"),
        raw=u,
    )


async def log_prospect_conversation(
    prospect_id: str,
    direction: str,
    message_body: str,
    whatsapp_message_id: str | None = None,
) -> None:
    sb = _get_supabase()
    sb.table("prospect_conversations").insert({
        "prospect_id": prospect_id,
        "direction": direction,
        "message_body": message_body,
        "whatsapp_message_id": whatsapp_message_id,
    }).execute()


async def update_prospect(prospect_id: str, updates: dict[str, Any]) -> None:
    sb = _get_supabase()
    from datetime import datetime, timezone
    sb.table("prospects").update({
        **updates,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", prospect_id).execute()
