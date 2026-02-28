from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from supabase import create_client

from app.config import settings
from app.services.prospect_context_loader import ProspectContext, update_prospect


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@dataclass
class ProspectToolResult:
    success: bool
    data: Any = None
    error: str | None = None


PROSPECT_AGENT_TOOLS = [
    {
        "name": "get_property_listings",
        "description": (
            "Returns up-to-date details about properties that are currently available to rent. "
            "Use this when the prospect asks for property details, prices, bedrooms, location, "
            "or any specific information about available rentals."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filter_city": {"type": "string", "description": "Optional city name to filter results."},
                "max_rent": {"type": "number", "description": "Optional maximum monthly rent in GBP."},
            },
            "required": [],
        },
    },
    {
        "name": "send_application_link",
        "description": (
            "Sends the prospect a link to the online rental application form. "
            "Call this when the prospect expresses clear interest in applying for a specific property."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "unit_id": {"type": "string", "description": "The ID of the unit the prospect wants to apply for."},
                "unit_description": {"type": "string", "description": "Short description of the unit for the confirmation message."},
            },
            "required": ["unit_id", "unit_description"],
        },
    },
]


async def execute_prospect_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    ctx: ProspectContext,
) -> ProspectToolResult:
    if tool_name == "get_property_listings":
        return await _get_property_listings(tool_input, ctx)
    elif tool_name == "send_application_link":
        return await _send_application_link(tool_input, ctx)
    else:
        return ProspectToolResult(success=False, error=f"Unknown tool: {tool_name}")


async def _get_property_listings(inp: dict[str, Any], ctx: ProspectContext) -> ProspectToolResult:
    sb = _sb()
    units_res = sb.table("units").select("*, leases(status, monthly_rent)").execute()
    all_units = units_res.data or []

    filter_city = (inp.get("filter_city") or "").lower()
    max_rent = inp.get("max_rent")

    listings = []
    for u in all_units:
        leases = u.get("leases") or []
        if any(l.get("status") == "active" for l in leases):
            continue
        rent: float | None = None
        for l in leases:
            if l.get("monthly_rent"):
                rent = float(l["monthly_rent"])
                break
        if filter_city and filter_city not in (u.get("city") or "").lower():
            continue
        if max_rent and rent and rent > max_rent:
            continue
        listings.append({
            "id": u["id"],
            "unit_identifier": u.get("unit_identifier"),
            "address": u.get("address"),
            "city": u.get("city"),
            "postcode": u.get("postcode"),
            "monthly_rent": rent,
            "jurisdiction": u.get("jurisdiction"),
        })

    return ProspectToolResult(success=True, data={"listings": listings, "count": len(listings)})


async def _send_application_link(inp: dict[str, Any], ctx: ProspectContext) -> ProspectToolResult:
    unit_id = inp.get("unit_id", "")
    unit_description = inp.get("unit_description", "the property")

    app_url = settings.FRONTEND_URL or "http://localhost:3000"
    application_link = f"{app_url}/apply/{ctx.prospect_id}"

    await update_prospect(ctx.prospect_id, {"interested_unit_id": unit_id})

    return ProspectToolResult(
        success=True,
        data={
            "application_link": application_link,
            "unit_id": unit_id,
            "message": f"Application link sent for {unit_description}. The prospect should visit: {application_link}",
        },
    )
