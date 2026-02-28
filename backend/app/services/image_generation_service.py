from __future__ import annotations

import uuid
from typing import Any

from supabase import create_client

from app.config import settings


BUCKET_NAME = "property-listings"


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _ensure_bucket() -> None:
    sb = _sb()
    try:
        sb.storage.create_bucket(BUCKET_NAME, options={"public": True})
    except Exception:
        pass  # Bucket already exists



async def generate_property_image(
    unit: dict[str, Any],
    attrs: dict[str, Any] | None,
) -> str | None:
    """
    Upload a unique stock photo (seeded by unit ID) to Supabase and return the public URL.
    """
    return await _placeholder_supabase_url(unit)



async def _upload_to_supabase(image_bytes: bytes, unit_id: str) -> str | None:
    try:
        _ensure_bucket()
        sb = _sb()
        filename = f"{unit_id}/{uuid.uuid4()}.jpg"

        sb.storage.from_(BUCKET_NAME).upload(
            filename,
            image_bytes,
            {"content-type": "image/jpeg", "upsert": "true"},
        )

        public_url = sb.storage.from_(BUCKET_NAME).get_public_url(filename)
        return public_url

    except Exception as exc:
        print(f"[ImageGen] Supabase upload error: {exc}")
        return None


def _placeholder_url(unit: dict[str, Any]) -> str:
    # picsum.photos/seed/{seed}/1080/1080 returns a consistent but unique image per seed
    unit_id = unit.get("id", "default")
    return f"https://picsum.photos/seed/{unit_id}/1080/1080"


async def _placeholder_supabase_url(unit: dict[str, Any]) -> str:
    """
    Download a placeholder image and upload it to Supabase so Instagram
    gets a stable, directly crawlable URL (Unsplash CDN URLs are blocked).
    Falls back to the raw Unsplash URL if upload fails.
    """
    import httpx

    source_url = _placeholder_url(unit)
    unit_id = unit.get("id", "unknown")

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(source_url)
            resp.raise_for_status()
            image_bytes = resp.content

        public_url = await _upload_to_supabase(image_bytes, f"{unit_id}-placeholder")
        if public_url:
            print(f"[ImageGen] Placeholder uploaded to Supabase: {public_url}")
            return public_url
    except Exception as exc:
        print(f"[ImageGen] Could not upload placeholder to Supabase: {exc}")

    return source_url
