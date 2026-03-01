# PropAI — Demo Playbook
## For Human Presenters and AI Demo Runners

This document describes three end-to-end demo flows. Each section is self-contained. Every step includes the exact curl command, expected response, and what to show the audience.

---

## PREREQUISITES

Backend must be running locally with ngrok tunnelling port 8000:
```bash
cd backend
source ../0human/bin/activate
uvicorn app.main:app --reload --env-file ../.env.local
# In a separate terminal: ngrok http 8000
```

Twilio sandbox WhatsApp webhook set to:
```
https://gianna-overbold-chasity.ngrok-free.dev/api/webhook/whatsapp
```

Demo account credentials:
- Landlord: `robert.ryan@propai.demo` / `PropAI2026!`
- Tenant WhatsApp: `+13369971342`
- Lease ID: `1ea50000-0000-0000-0000-000000000001`

Set backend URL variable (swap for ngrok if needed):
```bash
export BACKEND=http://localhost:8000
export LEASE=1ea50000-0000-0000-0000-000000000001
```

---

---

# DEMO 1 — Lease Renewal Declined → AI Auto-Lists on Instagram

**Narrative:** Jacob Ryan's lease is expiring. The AI sends him a WhatsApp asking if he wants to renew. He says no. PropAI immediately generates a property image with Gemini AI and posts the listing to Instagram — zero landlord involvement.

---

## Step 1.0 — Reset (run before every demo)

Clears renewal state, conversation history, and any previous Instagram post data.

```bash
curl -s -X POST "$BACKEND/api/test/reset-lease/$LEASE" | jq
```

Expected:
```json
{ "success": true, "note": "Lease reset. Conversations and context cleared." }
```

---

## Step 1.1 — Send WhatsApp Renewal Inquiry

Fires the actual WhatsApp message to +13369971342.

```bash
curl -s -X POST "$BACKEND/api/test/renewal-inquiry/$LEASE" | jq
```

Expected:
```json
{
  "success": true,
  "tenant": "Jacob Ryan",
  "whatsapp_number": "+13369971342",
  "message_sent": true,
  "renewal_status": "pending"
}
```

Jacob's phone receives:
> "Hi Jacob Ryan, this is a message from your property management system. Your tenancy at [address] is due to expire on 31 August 2026. Please reply YES to renew or NO if you're planning to move out..."

**Show this on screen / on the phone.**

---

## Step 1.2 — Jacob Replies "No"

### Option A — Real phone reply (live demo)
Have someone text "No" from +13369971342. The agent picks it up automatically via the Twilio webhook.

Watch the backend logs for:
```
[webhook] Inbound message from '+13369971342': 'No'
[webhook] load_tenant_context result: FOUND tenant Jacob Ryan
```
Then within ~3 seconds you should see `record_renewal_decision` called and the listing flow start.

### Option B — Simulate without a phone
```bash
curl -s -X POST "$BACKEND/api/test/simulate-reply/$LEASE?message=No%2C+I+won%27t+be+renewing+my+lease" | jq
```

Expected response shows the agent called the right tool:
```json
{
  "success": true,
  "agent_reply": "Noted — we've recorded that you won't be renewing and will begin re-listing the property...",
  "tools_used": ["record_renewal_decision"],
  "listing_debug": {
    "instagram_success": true,
    "instagram_post_url": "https://www.instagram.com/p/...",
    "caption": "🏠 Now Available — ..."
  }
}
```

---

## Step 1.3 — Show Results

1. **Instagram post** — open the `instagram_post_url` from the response.
2. **Landlord dashboard** — log in as Robert Ryan at `/landlord/dashboard`. A notification appears: *"Property has been listed for re-letting. Instagram post: [url]"*
3. **Unit status** — in the database the unit is now `notice_given`.

### Fast-track (skip WhatsApp entirely)
If you want to jump straight to the Instagram post for a quicker demo:
```bash
curl -s -X POST "$BACKEND/api/test/instagram-listing/$LEASE" | jq
```

---

---

# DEMO 2 — Rent Arrears → Agent Issues Legal Notice

**Narrative:** Jacob messages saying he can't pay rent this month. The AI agent checks payment history, identifies arrears, and autonomously issues a formal legal notice — logging it to the landlord dashboard with a PDF.

---

## Step 2.0 — Reset Conversation Context

```bash
curl -s -X POST "$BACKEND/api/test/reset-lease/$LEASE" | jq
```

---

## Step 2.1 — Seed a Missed Payment (SQL — run in Supabase SQL Editor)

This makes the agent's rent check show real arrears:
```sql
INSERT INTO payments (lease_id, amount_due, amount_paid, due_date, status)
VALUES (
  '1ea50000-0000-0000-0000-000000000001',
  950.00, 0.00,
  CURRENT_DATE - INTERVAL '14 days',
  'overdue'
)
ON CONFLICT DO NOTHING;
```

---

## Step 2.2 — Simulate Jacob Texting About Arrears

### Option A — Real WhatsApp
Have someone text from +13369971342:
> "Hi, I'm really sorry but I won't be able to pay this month's rent. Things are very tight right now."

### Option B — Simulate
```bash
curl -s -X POST "$BACKEND/api/test/simulate-reply/$LEASE?message=Hi+I%27m+sorry+but+I+can%27t+pay+my+rent+this+month" | jq
```

The agent will:
1. Call `get_rent_status` — sees the overdue payment
2. Respond acknowledging the situation
3. If arrears are significant, call `issue_legal_notice` with `notice_type="payment_demand"`

Expected tools in response:
```json
{
  "tools_used": ["get_rent_status", "issue_legal_notice"]
}
```

If the agent only acknowledges without issuing a notice, escalate the message:
```bash
curl -s -X POST "$BACKEND/api/test/simulate-reply/$LEASE?message=I+haven%27t+paid+rent+in+two+months+and+I+don%27t+plan+to" | jq
```

---

## Step 2.3 — Show Results

1. **Landlord dashboard** → `/landlord/dashboard` — a notification appears: *"Legal notice issued to Jacob Ryan at [address]. Type: payment_demand. Deadline: [date]."*
2. **Legal actions** — check Supabase: `SELECT * FROM legal_actions WHERE lease_id = '1ea50000-0000-0000-0000-000000000001';`
3. **PDF** — the `document_url` in the legal_actions row is a generated PDF stored in Supabase Storage.
4. **WhatsApp** — Jacob's phone received the agent's formal notice message in real-time.

---

---

# DEMO 3 — New Tenant Application → AI Screening → Accept → Digital Lease Signing

**Narrative:** Tom Phillips applies for the property. The landlord opens the applications page, screens him with Claude AI (scores 91/100), accepts him, and an email is sent. Tom receives a WhatsApp with a digital signing link. He signs the lease online and both sides get a PDF.

---

## Step 3.0 — Ensure Tom Phillips Is in Under-Review State

Run in Supabase SQL Editor if needed:
```sql
UPDATE property_applications
SET status = 'under_review', updated_at = NOW()
WHERE applicant_data->>'email' = 'perfecttouchphotoshopping@gmail.com';
```

---

## Step 3.1 — Open Applications Page

Log in as Robert Ryan → go to `/landlord/applications`

Tom Phillips is listed with:
- Income: £3,500–4,000/month
- AI Score: **91/100** (pre-screened)
- Employer: Adobe Systems, 3 years

**Show the collapsed card, then expand it to reveal full details.**

---

## Step 3.2 — Screen with AI (Optional — shows live Claude screening)

If Tom's card shows no AI score yet, click **"Screen with AI"**. Claude evaluates:
- Income-to-rent ratio (3.8:1, above the 3:1 minimum)
- Employment stability (full-time, 3 years)
- Rental history (6 years, no issues)
- Risk assessment: Low across all categories

Takes ~3-5 seconds. Score appears on the card.

---

## Step 3.3 — Accept Tom Phillips

Click **Accept** on Tom's card.

What happens automatically:
1. Application status → `accepted`
2. A new lease record is created for the unit
3. An acceptance email is sent to `perfecttouchphotoshopping@gmail.com` via Resend
4. **If this is a prospect-flow applicant:** a signing token is generated and a WhatsApp message with a signing link is sent to Tom's phone

The notification banner shows: *"Application accepted — lease created and applicant notified."*

---

## Step 3.4 — Tenant Signs the Lease (Prospect Flow)

If the application came through the prospect/Instagram flow, Tom receives a WhatsApp:
> "Hi Tom, your tenancy agreement for [address] is ready to sign. Click here: https://[app]/sign/[token]"

He visits the link and sees:
- Full lease agreement text
- His name and rent amount pre-filled
- A signature pad

He signs with his finger/mouse → clicks **Sign** → a PDF is generated, uploaded to Supabase Storage, and sent back to him via WhatsApp.

**To simulate the signing flow without a real phone:**
```bash
# 1. Get the signing token from the database
TOKEN=$(curl -s "$BACKEND/api/applications" | jq -r '.[0].signing_token // empty')

# 2. Submit a mock signature
curl -s -X POST "$BACKEND/api/sign/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"signature_data_url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}' | jq
```

Expected:
```json
{ "signed": true, "pdf_url": "https://...supabase.co/.../signed_lease_....pdf" }
```

---

## Step 3.5 — Show Results

1. **Landlord dashboard** → notification: *"Tom Phillips has signed their tenancy agreement."*
2. **Signed PDF** → open the `pdf_url` — shows the full lease with signature, date, and PropAI branding.
3. **Email** → check `perfecttouchphotoshopping@gmail.com` inbox for the acceptance email from PropAI.
4. **Database** — `lease_applications` status is `accepted`, `signing_tokens` row has `signed_at` timestamp.

---

---

# RESET ALL DEMO STATE

Run these to restore everything to a clean demo-ready state:

```bash
# Reset lease renewal/Instagram state
curl -s -X POST "$BACKEND/api/test/reset-lease/$LEASE" | jq

# Reset Tom Phillips application (SQL — run in Supabase SQL Editor)
```

```sql
-- Reset Tom Phillips application
UPDATE property_applications
SET status = 'under_review', ai_screening_result = NULL, ai_screening_score = NULL, updated_at = NOW()
WHERE applicant_data->>'email' = 'perfecttouchphotoshopping@gmail.com';

-- Remove any overdue payments added for Demo 2
DELETE FROM payments
WHERE lease_id = '1ea50000-0000-0000-0000-000000000001'
  AND status = 'overdue'
  AND amount_paid = 0;

-- Clear legal actions from Demo 2
DELETE FROM legal_actions
WHERE lease_id = '1ea50000-0000-0000-0000-000000000001';
```

---

# TROUBLESHOOTING

**`message_sent: false` in renewal inquiry**
Twilio free tier has a 50 msg/day limit. Use `simulate-reply` instead — identical outcome.

**Agent doesn't call `record_renewal_decision`**
Make sure the reset was run so `renewal_status = null`. The agent needs clean context. If it still fails, use the fast-track direct listing endpoint.

**`instagram_success: false`**
Instagram token may have expired. The `image_url` (Gemini-generated image) is still in the response — show that instead as the AI-generated listing image.

**Email not received after accept**
Check Railway env vars: `RESEND_API_KEY` must be set. Check spam folder.

**Backend not running**
```bash
cd backend && source ../0human/bin/activate && uvicorn app.main:app --reload --env-file ../.env.local
```

**Signing link not working**
The signing link uses the `APP_URL` env var. For local testing, set `APP_URL=http://localhost:3000` in `backend/.env`.
