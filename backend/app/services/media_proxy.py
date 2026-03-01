from __future__ import annotations

import mimetypes
import uuid

import httpx
from supabase import create_client

from app.config import settings

BUCKET = "maintenance-photos"


def _get_supabase():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def proxy_twilio_media(twilio_url: str) -> str | None:
    """
    Download a Twilio media URL (requires Basic Auth) and re-upload it to
    Supabase Storage, returning the public URL. Returns None on any error.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print("[media_proxy] Twilio credentials not set — cannot proxy media")
        return None

    try:
        resp = httpx.get(
            twilio_url,
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            follow_redirects=True,
            timeout=15,
        )
        resp.raise_for_status()
    except Exception as exc:
        print(f"[media_proxy] Failed to download Twilio media {twilio_url}: {exc!r}")
        return None

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"

    file_name = f"{uuid.uuid4()}{ext}"
    file_path = f"whatsapp/{file_name}"

    try:
        sb = _get_supabase()
        sb.storage.from_(BUCKET).upload(
            path=file_path,
            file=resp.content,
            file_options={"content-type": content_type, "upsert": "false"},
        )
        public_url = sb.storage.from_(BUCKET).get_public_url(file_path)
        print(f"[media_proxy] Uploaded {twilio_url} → {public_url}")
        return public_url
    except Exception as exc:
        print(f"[media_proxy] Failed to upload to Supabase Storage: {exc!r}")
        return None


def proxy_twilio_media_list(twilio_urls: list[str]) -> list[str]:
    """Proxy a list of Twilio URLs, returning only the ones that succeeded."""
    public_urls = []
    for url in twilio_urls:
        result = proxy_twilio_media(url)
        if result:
            public_urls.append(result)
        else:
            public_urls.append(url)  # fall back to original if proxy fails
    return public_urls
