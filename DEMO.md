# PropAI — Live Demo Script
## "Tenant Declines Renewal → AI Auto-Lists on Instagram"

**Story:** Jacob Ryan's lease is expiring. The system sends him a WhatsApp asking if he wants to renew. He says no. PropAI automatically generates a property image with Gemini and posts the listing to Instagram — zero landlord involvement.

---

## Prerequisites

- Backend running locally: `uvicorn app.main:app --reload` (from `backend/`)
- Backend URL below — swap for ngrok if demoing remotely

```bash
BACKEND=http://localhost:8000
# or for remote demo:
# BACKEND=https://gianna-overbold-chasity.ngrok-free.dev
```

---

## Step 0 — Reset (run this before every demo)

Clears renewal state, conversations, and Instagram fields so the flow runs clean.

```bash
curl -s -X POST "$BACKEND/api/test/reset-lease/1ea50000-0000-0000-0000-000000000001" | jq
```

Expected:
```json
{ "success": true, "note": "Lease reset. Conversations and context cleared." }
```

---

## Step 1 — Send WhatsApp Renewal Inquiry to Jacob

This fires the actual WhatsApp message to **+13369971342** asking if he wants to renew.

```bash
curl -s -X POST "$BACKEND/api/test/renewal-inquiry/1ea50000-0000-0000-0000-000000000001" | jq
```

Expected:
```json
{
  "success": true,
  "tenant": "Jacob Ryan",
  "whatsapp_number": "+13369971342",
  "message_sent": true,
  "renewal_status": "pending",
  "note": "Tenant will be asked about renewal via WhatsApp..."
}
```

**Jacob's phone receives:**
> "Hi Jacob Ryan, this is a message from your property management system. Your tenancy at [address] is due to expire on [date]. Please reply YES to renew or NO if you're planning to move out..."

---

## Step 2 — Jacob Replies "NO" (via WhatsApp or simulated)

### Option A — Real WhatsApp reply
Have someone physically text "No" from **+13369971342**. The Twilio webhook handles it automatically.

### Option B — Simulate without a phone (dev only)
Injects the message directly into the agent loop — identical outcome, no WhatsApp needed.

```bash
curl -s -X POST "$BACKEND/api/test/simulate-reply/1ea50000-0000-0000-0000-000000000001?message=No%2C+I+won%27t+be+renewing+my+lease" | jq
```

Expected (agent recognises the decline, calls `record_renewal_decision`, triggers listing):
```json
{
  "success": true,
  "agent_reply": "Understood Jacob — I'll let the landlord know and begin re-listing the property...",
  "tools_used": ["get_lease_info", "record_renewal_decision"],
  "listing_debug": {
    "instagram_token_set": true,
    "gemini_key_set": true,
    "listing_result": {
      "instagram_success": true,
      "instagram_post_url": "https://www.instagram.com/p/...",
      "caption": "🏠 Now Available — ..."
    }
  }
}
```

---

## Step 2 (Fast Track) — Skip WhatsApp, directly trigger the listing

If you want to jump straight to the Instagram post generation without any WhatsApp steps:

```bash
curl -s -X POST "$BACKEND/api/test/instagram-listing/1ea50000-0000-0000-0000-000000000001" | jq
```

Expected:
```json
{
  "success": true,
  "image_url": "https://...",
  "instagram_success": true,
  "instagram_post_url": "https://www.instagram.com/p/...",
  "caption": "🏠 Now Available — ...",
  "note": "Listing flow completed. Instagram post live!"
}
```

---

## Step 3 — Show the result in the landlord dashboard

The landlord dashboard at `/landlord/dashboard` will now show:
- A notification: *"Property at [address] has been listed for re-letting. Instagram post: [url]"*
- Unit status updated to `notice_given`

Open the Instagram post URL from the response to show the live post.

---

## Step 4 — Show the Tom Phillips profile applying for the newly listed property

The demo property now has an available listing. Tom Phillips's application
(`perfecttouchphotoshopping@gmail.com`) is already pre-loaded in the
applications tab at `/landlord/applications`.

1. Go to `/landlord/applications`
2. Expand Tom Phillips's card (AI score: **91/100**)
3. Click **Accept** → email fires to `perfecttouchphotoshopping@gmail.com`

---

## Key credentials

| Account | Email | Password |
|---------|-------|----------|
| Landlord (Robert Ryan) | `robert.ryan@propai.demo` | `PropAI2026!` |
| Tenant (Jacob Ryan) | `jacobrryan1@gmail.com` | `PropAI2026!` |

---

## Troubleshooting

**`message_sent: false` in Step 1**
Twilio credentials may be rate-limited. Use Option B (simulate) for Step 2 — the Instagram post will still generate.

**`instagram_success: false` in the listing result**
Instagram Graph API token may need refreshing. The `image_url` in the response is the Gemini-generated property image — show that instead.

**Agent doesn't call `record_renewal_decision`**
Make sure Step 0 (reset) was run so the conversation context is clean. The agent needs the outbound renewal inquiry message in context to understand that a "No" reply means declining renewal.

**Backend not running**
```bash
cd backend
source venv/bin/activate   # or: source venv/Scripts/activate on Windows
uvicorn app.main:app --reload
```
