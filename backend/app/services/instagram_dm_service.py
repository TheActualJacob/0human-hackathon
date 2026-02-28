from __future__ import annotations

import httpx

from app.config import settings

IG_API_BASE = "https://graph.instagram.com/v21.0"


async def _get_ig_user_id(token: str) -> str | None:
    """Fetch the Instagram Business/Creator account user ID from the access token."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://graph.instagram.com/me",
                params={"fields": "user_id", "access_token": token},
            )
            data = resp.json()
            return data.get("user_id") or data.get("id")
    except Exception as exc:
        print(f"[InstagramDM] Error fetching user ID: {exc}")
    return None


async def send_instagram_dm(recipient_igsid: str, message: str) -> bool:
    """
    Send a direct message to an Instagram user via the Messenger API for Instagram.

    recipient_igsid: The Instagram-Scoped User ID (IGSID) of the recipient.
    Returns True on success, False otherwise.

    Requires INSTAGRAM_ACCESS_TOKEN to have the instagram_manage_messages permission
    and the app to be subscribed to the 'messages' webhook field.
    """
    token = settings.INSTAGRAM_ACCESS_TOKEN
    if not token:
        print("[InstagramDM] INSTAGRAM_ACCESS_TOKEN not configured — skipping DM send")
        return False

    ig_user_id = await _get_ig_user_id(token)
    if not ig_user_id:
        print("[InstagramDM] Could not resolve IG user ID — cannot send DM")
        return False

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{IG_API_BASE}/{ig_user_id}/messages",
                params={"access_token": token},
                json={
                    "recipient": {"id": recipient_igsid},
                    "message": {"text": message},
                },
            )
            data = resp.json()
            if "message_id" in data or "recipient_id" in data:
                return True
            print(f"[InstagramDM] Send failed: {data}")
    except Exception as exc:
        print(f"[InstagramDM] Exception sending DM: {exc}")

    return False
