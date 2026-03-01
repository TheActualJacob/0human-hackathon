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
    Return a publicly accessible image URL for the property.

    Priority:
      1. First photo from the unit's existing ``images`` array (re-hosted on Supabase
         so Instagram's crawler gets a stable, directly accessible URL).
      2. Placeholder stock photo uploaded to Supabase as a fallback.
    """
    existing_images: list[str] = unit.get("images") or []
    if existing_images:
        first_url = existing_images[0]
        print(f"[ImageGen] Using existing property photo: {first_url}")
        uploaded = await _fetch_and_upload(first_url, unit.get("id", "unknown"), label="property")
        if uploaded:
            return uploaded
        # If re-hosting failed just return the raw URL and let Instagram try it
        print("[ImageGen] Re-hosting failed, returning original property photo URL")
        return first_url

    return await _placeholder_supabase_url(unit)



async def _upload_to_supabase(image_bytes: bytes, path: str) -> str | None:
    try:
        _ensure_bucket()
        sb = _sb()
        filename = f"{path}/{uuid.uuid4()}.jpg"

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


async def _fetch_and_upload(source_url: str, unit_id: str, label: str = "image") -> str | None:
    """Download *source_url* and re-host it on Supabase Storage.  Returns the public URL or None."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(source_url)
            resp.raise_for_status()
            image_bytes = resp.content

        public_url = await _upload_to_supabase(image_bytes, f"{unit_id}-{label}")
        if public_url:
            print(f"[ImageGen] {label} uploaded to Supabase: {public_url}")
            return public_url
    except Exception as exc:
        print(f"[ImageGen] Could not fetch/upload {label} from {source_url}: {exc}")

    return None


def _placeholder_url(unit: dict[str, Any]) -> str:
    unit_id = unit.get("id", "default")
    return f"https://picsum.photos/seed/{unit_id}/1080/1080"


async def _placeholder_supabase_url(unit: dict[str, Any]) -> str:
    """
    Download a placeholder stock photo and upload it to Supabase so Instagram
    gets a stable, directly crawlable URL.  Falls back to the raw URL if upload fails.
    """
    source_url = _placeholder_url(unit)
    unit_id = unit.get("id", "unknown")

    uploaded = await _fetch_and_upload(source_url, f"{unit_id}-placeholder", label="placeholder")
    if uploaded:
        return uploaded

    return source_url
