# WhatsApp Messaging — Architecture & Flow

## Overview

All WhatsApp messaging runs through **Twilio** and is handled entirely in the **Next.js frontend** as API routes. The Python FastAPI backend (`/backend`) has no messaging code — it is currently a stub with only a health route.

---

## Environment Variables

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (also used for webhook signature validation) |
| `TWILIO_WHATSAPP_NUMBER` | Sending number in Twilio format, e.g. `whatsapp:+14155238886` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app — used to build the webhook URL for signature validation |

---

## End-to-End Message Flow

```
Tenant sends WhatsApp
        │
        ▼
  Twilio receives it
        │
  POST /api/webhook/whatsapp
        │
        ├─ Parse form body
        ├─ (Production) Validate Twilio signature
        ├─ Look up tenant by phone number
        ├─ Log inbound message to DB
        ├─ Return 200 immediately (prevents Twilio retry)
        │
        └─ [async] processAndReply()
                │
                ├─ Handle media: send acknowledgement, return
                │
                └─ runAgentLoop() (Claude claude-sonnet-4-5)
                        │
                        ├─ Build system prompt from tenant context
                        ├─ Inject last 10 conversation messages as history
                        ├─ Tool-calling loop (max 8 iterations)
                        │     ├─ get_rent_status
                        │     ├─ schedule_maintenance
                        │     ├─ issue_legal_notice
                        │     └─ update_escalation_level
                        │
                        └─ Return final message
                                │
                                ├─ Log outbound message + intent classification
                                ├─ Notify landlord if high-severity action occurred
                                ├─ Update rolling conversation context summary
                                └─ sendWhatsAppMessage() → Twilio REST API → Tenant
```

---

## Files

### `frontend/app/api/webhook/whatsapp/route.ts`
The inbound webhook endpoint. Twilio sends a `POST` with a form-encoded body.

**Key behaviours:**
- Parses form body manually (Twilio sends `application/x-www-form-urlencoded`).
- Strips the `whatsapp:` prefix from the `From` field before DB lookup.
- In production, validates the `x-twilio-signature` header — rejects spoofed webhooks with `403`.
- Returns `200` to Twilio **immediately** after logging the inbound message. Agent processing runs as a fire-and-forget promise to avoid Twilio's 15-second timeout.
- If the tenant phone number is not found in the DB, sends a fallback reply and exits.
- For media messages (`NumMedia > 0`), sends an acknowledgement asking the tenant to describe the issue in text.
- If any tool call is flagged `isHighSeverity`, `notifyLandlord()` is called — this sends a WhatsApp message to the landlord if `landlords.whatsapp_number` is set and `notification_preferences.whatsapp !== false`.

---

### `frontend/lib/twilio/sendMessage.ts`

| Export | Purpose |
|---|---|
| `sendWhatsAppMessage(toNumber, body)` | Sends a WhatsApp message via the Twilio REST API. Automatically prepends `whatsapp:` if not already present. Returns the Twilio `MessageSid`. |
| `validateTwilioSignature(signature, url, params)` | Validates the `x-twilio-signature` header using `twilio.validateRequest`. |

---

### `frontend/lib/agent/contextLoader.ts`

Loads and persists all tenant data needed for the agent.

| Export | Purpose |
|---|---|
| `loadTenantContext(whatsappNumber)` | Looks up tenant → lease → unit → landlord, then fetches the last 10 messages, rolling summary, 6 months of payments, active payment plan, open maintenance requests, open legal actions, open disputes, and escalation level. Returns a `TenantContext` object or `null` if the tenant is unknown. |
| `logConversation(leaseId, direction, messageBody, whatsappMessageId?, intentClassification?)` | Inserts a row into the `conversations` table. Called for both inbound and outbound messages. |
| `logAgentAction(params)` | Inserts a row into the `agent_actions` table. Each tool handler calls this for an audit trail. |
| `updateConversationContext(leaseId, summary, openThreads)` | Upserts the rolling conversation summary and open threads (including escalation level) into `conversation_context`. The summary is capped at ~1000 characters to prevent unbounded growth. |

---

### `frontend/lib/agent/agentLoop.ts`

Runs the Claude tool-calling loop.

- Model: `claude-sonnet-4-5`, max 1024 output tokens, up to **8 iterations**.
- Seeds `messages` with the last 10 DB conversations (as Claude `user`/`assistant` turns) plus the new incoming message.
- On each iteration:
  - If `stop_reason === 'end_turn'` → extract final text and break.
  - If `stop_reason === 'tool_use'` → execute all tool calls in parallel, feed results back, continue.
- After the loop, classifies intent from the message text and tools used (finance / maintenance / legal_response / escalation / lease_query / general).
- Returns `AgentResult`: `finalMessage`, `toolsUsed`, `highSeverityActions`, `intentClassification`, `confidenceScore`.

---

### `frontend/lib/agent/tools.ts`

Defines the four tools exposed to Claude:

| Tool | Trigger conditions | High severity? |
|---|---|---|
| `get_rent_status` | Tenant asks about payments, arrears, rent | No |
| `schedule_maintenance` | Tenant reports a fault or repair need | Yes — if `urgency === 'emergency'` |
| `issue_legal_notice` | Persistent arrears or lease violation warranting escalation | Always |
| `update_escalation_level` | Compliance change (up or down) | Yes — if new level ≥ 3 |

**Escalation levels:**
- 1 = Conversational
- 2 = Formal Written
- 3 = Legal Process
- 4 = Pre-Tribunal

**Legal notice types:** `formal_notice`, `section_8`, `section_21`, `payment_demand`, `lease_violation_notice`, `payment_plan_agreement`

**Maintenance categories:** `plumbing`, `electrical`, `structural`, `appliance`, `heating`, `pest`, `damp`, `access`, `other`

---

### `frontend/lib/agent/toolHandlers.ts`

Implements the tool logic:

- **`get_rent_status`** — queries `payments` (last 6) and `payment_plans` (active). Computes total arrears. Returns structured payment history.
- **`schedule_maintenance`** — queries `contractors` filtered by `landlord_id` and `trades` array. Prefers `emergency_available` contractors for emergencies. Inserts into `maintenance_requests` with status `assigned` or `open`.
- **`issue_legal_notice`** — calls `generateLegalNotice()` (PDF), uploads to Supabase Storage bucket `legal-documents`, inserts into `legal_actions`, inserts into `landlord_notifications`. Computes response deadline from notice type and jurisdiction.
- **`update_escalation_level`** — upserts `conversation_context.open_threads` with the new level, inserts `landlord_notifications` if level ≥ 3.

**Deadline logic (days until response required):**

| Notice type | England/Wales | Scotland | Wales |
|---|---|---|---|
| `section_8` | 14 | 28 | 14 |
| `section_21` | 56 | — | 182 |
| `payment_demand` | 7 | 7 | 7 |
| All others | 14 | 14 | 14 |

---

## Database Tables Used

| Table | Used for |
|---|---|
| `tenants` | Phone number → tenant lookup |
| `leases` | Tenant → lease → unit chain |
| `units` | Address, jurisdiction, landlord |
| `landlords` | WhatsApp number, notification preferences |
| `conversations` | Inbound/outbound message log |
| `conversation_context` | Rolling summary + escalation level |
| `payments` | Rent history and arrears |
| `payment_plans` | Active repayment plans |
| `maintenance_requests` | Fault tracking |
| `contractors` | Contractor assignment |
| `legal_actions` | Issued notices |
| `disputes` | Open disputes |
| `agent_actions` | Full audit log of every tool call |
| `landlord_notifications` | Alerts surfaced to the landlord dashboard |

---

## Landlord Notifications

Two channels:
1. **Database** — a row in `landlord_notifications` is always inserted for legal notices (with `requires_signature` flag for Section 8 / 21) and for escalation level ≥ 3.
2. **WhatsApp** — if `landlords.whatsapp_number` is set and `notification_preferences.whatsapp !== false`, a WhatsApp message is sent directly to the landlord for any high-severity event.
