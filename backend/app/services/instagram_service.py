from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

IG_API_BASE = "https://graph.instagram.com/v21.0"


@dataclass
class InstagramPostResult:
    success: bool
    post_url: str | None = None
    media_id: str | None = None
    image_url: str | None = None
    caption: str | None = None
    error: str | None = None


def _build_caption(unit: dict[str, Any], attrs: dict[str, Any] | None, lease: dict[str, Any]) -> str:
    beds = attrs.get("bedrooms") if attrs else None
    baths = attrs.get("bathrooms") if attrs else None
    sqft = attrs.get("square_footage") if attrs else None
    furnished = attrs.get("furnished_status") if attrs else None
    has_garden = attrs.get("has_garden_access") if attrs else False
    has_parking = attrs.get("has_parking") if attrs else False

    address = unit.get("address", "")
    city = unit.get("city", "")
    monthly_rent = float(lease.get("monthly_rent", 0))

    lines = ["🏠 NOW AVAILABLE TO RENT", ""]

    if beds or address:
        prop_line = ""
        if beds:
            prop_line += f"{beds} bed"
        if baths:
            prop_line += f" | {baths} bath"
        if sqft:
            prop_line += f" | {int(sqft)} sq ft"
        if prop_line:
            lines.append(prop_line.strip(" |"))

    if address:
        lines.append(f"📍 {address}, {city}".rstrip(", "))

    if monthly_rent:
        lines.append(f"💷 £{monthly_rent:,.0f} pcm")

    features = []
    if furnished == "fully_furnished":
        features.append("Fully Furnished")
    elif furnished == "part_furnished":
        features.append("Part Furnished")
    if has_garden:
        features.append("Garden Access")
    if has_parking:
        features.append("Parking")
    if attrs and attrs.get("has_washing_machine"):
        features.append("Washing Machine")
    if attrs and attrs.get("has_dishwasher"):
        features.append("Dishwasher")

    if features:
        lines.append("")
        lines.append("✨ " + " · ".join(features))

    lines.extend([
        "",
        "Available immediately. Enquire now via DM or link in bio.",
        "",
        "#PropertyToRent #RentUK #LettingAgency #PropAI #UKProperty #RentingUK",
    ])

    if city:
        city_tag = city.replace(" ", "").lower()
        lines.append(f"#{city_tag} #propertyfor{city_tag.lower()}")

    return "\n".join(lines)


async def _get_ig_user_id(token: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://graph.instagram.com/me",
                params={"fields": "user_id", "access_token": token},
            )
            data = resp.json()
            if "user_id" in data:
                return data["user_id"]
            if "id" in data:
                return data["id"]
            print(f"[Instagram] Could not get user ID: {data}")
    except Exception as exc:
        print(f"[Instagram] Error getting user ID: {exc}")
    return None


async def _create_media_container(
    ig_user_id: str,
    image_url: str,
    caption: str,
    token: str,
) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{IG_API_BASE}/{ig_user_id}/media",
                data={
                    "image_url": image_url,
                    "caption": caption,
                    "access_token": token,
                },
            )
            data = resp.json()
            if "id" in data:
                return data["id"]
            print(f"[Instagram] Create container error: {data}")
    except Exception as exc:
        print(f"[Instagram] Create container exception: {exc}")
    return None


async def _publish_container(
    ig_user_id: str,
    container_id: str,
    token: str,
) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{IG_API_BASE}/{ig_user_id}/media_publish",
                data={
                    "creation_id": container_id,
                    "access_token": token,
                },
            )
            data = resp.json()
            if "id" in data:
                return data["id"]
            print(f"[Instagram] Publish error: {data}")
    except Exception as exc:
        print(f"[Instagram] Publish exception: {exc}")
    return None


async def post_property_listing(
    unit: dict[str, Any],
    attrs: dict[str, Any] | None,
    lease: dict[str, Any],
    image_url: str,
) -> InstagramPostResult:
    """
    Post a property listing to Instagram.
    Returns an InstagramPostResult with success/failure details.
    Falls back gracefully if token is not configured or API fails.
    """
    caption = _build_caption(unit, attrs, lease)

    if not settings.INSTAGRAM_ACCESS_TOKEN:
        print("[Instagram] INSTAGRAM_ACCESS_TOKEN not configured — skipping live post")
        print(f"[Instagram] Would post caption:\n{caption[:200]}...")
        return InstagramPostResult(
            success=False,
            image_url=image_url,
            caption=caption,
            error="INSTAGRAM_ACCESS_TOKEN not configured",
        )

    token = settings.INSTAGRAM_ACCESS_TOKEN
    print("[Instagram] Getting Instagram User ID...")
    ig_user_id = await _get_ig_user_id(token)

    if not ig_user_id:
        return InstagramPostResult(
            success=False,
            image_url=image_url,
            caption=caption,
            error="Could not resolve Instagram User ID from access token",
        )

    print(f"[Instagram] Creating media container for user {ig_user_id}...")
    container_id = await _create_media_container(ig_user_id, image_url, caption, token)

    if not container_id:
        return InstagramPostResult(
            success=False,
            image_url=image_url,
            caption=caption,
            error="Failed to create Instagram media container",
        )

    # Brief wait before publishing (Instagram recommendation)
    await asyncio.sleep(2)

    print(f"[Instagram] Publishing container {container_id}...")
    media_id = await _publish_container(ig_user_id, container_id, token)

    if not media_id:
        return InstagramPostResult(
            success=False,
            image_url=image_url,
            caption=caption,
            error="Failed to publish Instagram media container",
        )

    post_url = f"https://www.instagram.com/p/{media_id}/"
    print(f"[Instagram] Posted successfully: {post_url}")

    return InstagramPostResult(
        success=True,
        post_url=post_url,
        media_id=media_id,
        image_url=image_url,
        caption=caption,
    )
