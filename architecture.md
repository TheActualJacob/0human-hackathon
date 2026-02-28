# AI Property Manager – Database Architecture

## Overview

This document describes the Supabase schema for the AI Property Manager system. The database is the central source of truth for the WhatsApp AI agent — every action it takes, every message it sends, and every legal notice it issues is grounded in and recorded here.

---

## Schema Hierarchy

```
landlords
    │
    ├── landlord_notifications
    ├── contractors
    │
    └── units
            │
            ├── unit_attributes
            ├── unit_appliances
            ├── unit_status
            ├── unit_documents
            ├── maintenance_issues
            │
            └── leases
                    │
            ┌───────┼────────────────┬──────────────────┐
            │       │                │                  │
       tenants  payments       conversations        disputes
                    │                │                  │
             payment_plans  conversation_context   legal_actions
                                                       │
                                               document_templates


          maintenance_requests ──► maintenance_issues
          (links to lease)            (links to unit)


     (agent_actions references lease_id globally — immutable audit log)
```

---

## Key Design Decisions

### Why `lease` is the hub
A tenant can have multiple leases over time (renewals, unit changes). A unit has multiple leases sequentially. The *lease* is the active legal relationship — all operational data hangs off it.

### Why `conversation_context` is separate from `conversations`
Loading hundreds of raw messages into the agent's context window on every request is slow and expensive. The agent maintains a rolling plain-English summary in `conversation_context` and only loads raw messages when a full audit is needed.

### Why `maintenance_issues` is separate from `maintenance_requests`
A `maintenance_request` is a one-off job: *"the boiler broke, fix it."* A `maintenance_issue` is a systemic problem: *"this boiler has broken 4 times in 18 months."* When the agent detects a recurring request, it promotes it to a chronic issue and adjusts its response — investigating root cause rather than just raising another job.

### Why `agent_actions` is immutable
Legal defensibility. Every tool call the agent makes, every notice it issues, every decision it takes is permanently logged with a timestamp and reasoning. This is the paper trail for any tenant challenge or tribunal.

### Why `document_templates` lives in the database
Legal templates need to be updated when laws change — without a code deployment. Storing them in Supabase means they can be edited directly, versioned per jurisdiction, and swapped at runtime by the agent.

### `jurisdiction` on units
A landlord may own properties in different cities or countries with different tenant law. The agent reads this field to select the correct legal playbook and document templates.

### `whatsapp_number` on tenants
This is the primary lookup key the agent uses to identify a tenant from an inbound webhook. It must be stored in the exact format delivered by the WhatsApp API.

---

## Table Reference

### `landlords`
Root of the schema. Stores contact info and notification preferences.

| Key Fields | Notes |
|---|---|
| `whatsapp_number` | For landlord notifications sent via WhatsApp |
| `notification_preferences` | JSON — controls how/when the landlord is informed |

---

### `landlord_notifications`
The landlord's read-only feed. They are informed, never required to act — except when `requires_signature = true`, which is the only moment human intervention is needed.

| Key Fields | Notes |
|---|---|
| `notification_type` | emergency_maintenance, legal_notice_issued, signature_required, etc. |
| `requires_signature` | TRUE only for court/tribunal submissions |
| `read_at` | NULL = unread |

---

### `units`
Replaces the property/unit split. Each unit is a directly managed dwelling with its own address and legal jurisdiction.

| Key Fields | Notes |
|---|---|
| `jurisdiction` | Drives all legal logic — e.g. `england_wales`, `scotland` |
| `unit_identifier` | Human-readable label e.g. "Flat 3" |

---

### `unit_attributes`
Physical and logistical facts about the unit. Rarely changes. Includes heating, furnishing, access codes, utilities, and insurance.

---

### `unit_appliances`
Individual appliance records — each trackable for warranty, service history, and fault patterns. When the same appliance fails repeatedly, the agent flags replacement over repair.

---

### `unit_status`
Live snapshot of the unit. Updated by the agent after every relevant event.

| Key Fields | Notes |
|---|---|
| `occupancy_status` | occupied / vacant / notice_given / between_tenancies / under_refurb |
| `condition_rating` | 1–5 scale |
| `has_chronic_issue` | Set TRUE when maintenance_issues exist |
| `meter_reading_*` | Captured at move-in/out |

---

### `unit_documents`
Compliance certificates and legal documents at unit level. The agent monitors `expiry_date` across all records and proactively arranges renewals.

| Key Fields | Notes |
|---|---|
| `document_type` | gas_safety, epc, electrical_cert, hmo_licence, inventory, etc. |
| `expiry_date` | Watched continuously by agent |
| `status` | valid / expiring_soon / expired |

---

### `maintenance_issues`
Persistent, recurring, or chronic problems — distinct from one-off repair jobs.

| Key Fields | Notes |
|---|---|
| `is_chronic` | Set TRUE when report_count exceeds threshold |
| `times_addressed` | How many jobs were done but the problem came back |
| `resolution_attempts` | JSON array of what was tried and when |
| `potential_liability` | Agent flags if issue creates legal exposure (e.g. damp affecting health) |

---

### `leases`
The active legal relationship between a tenant and a unit. Central FK for almost all operational tables.

| Key Fields | Notes |
|---|---|
| `status` | active / expired / terminated / notice_given / pending |
| `notice_period_days` | Used by agent for legal deadline calculations |
| `deposit_scheme` | TDS, DPS, MyDeposits etc. |

---

### `tenants`
Linked to leases, not units directly — preserving history across multiple tenancies.

| Key Fields | Notes |
|---|---|
| `whatsapp_number` | Primary agent lookup key — must match webhook format exactly |
| `is_primary_tenant` | For multi-tenant leases |

---

### `payments`
One row per rent cycle. Agent generates these on lease creation and tracks status continuously.

| Key Fields | Notes |
|---|---|
| `status` | pending / paid / late / partial / missed |
| `amount_paid` | Tracked separately to amount_due for partial payments |

---

### `payment_plans`
Formally agreed arrears repayment schedules. Created by agent, document sent to tenant.

| Key Fields | Notes |
|---|---|
| `status` | active / completed / breached — breached triggers legal escalation |

---

### `conversations`
Every WhatsApp message in and out — the raw log.

| Key Fields | Notes |
|---|---|
| `direction` | inbound (tenant) / outbound (agent) |
| `intent_classification` | What the agent determined the message was about |
| `whatsapp_message_id` | For deduplication |

---

### `conversation_context`
One row per lease. A rolling summary the agent updates after each exchange, plus any open threads (outstanding questions, pending confirmations).

---

### `maintenance_requests`
One-off repair jobs. Linked to lease (tenant reported it) and optionally to a `maintenance_issue` if it has been promoted to chronic.

| Key Fields | Notes |
|---|---|
| `urgency` | emergency triggers immediate contractor assignment |
| `maintenance_issue_id` | Set when agent detects recurrence |

---

### `contractors`
The landlord's approved contractor list. Agent selects based on `trades` array and `emergency_available` flag.

---

### `disputes`
Formal dispute records opened by the agent when a tenant raises a grievance.

| Key Fields | Notes |
|---|---|
| `ruling` | Agent's formal decision text |
| `evidence_urls` | Photos/documents submitted by tenant via WhatsApp |

---

### `legal_actions`
Every formal legal step the agent takes. One row per action, fully auditable.

| Key Fields | Notes |
|---|---|
| `action_type` | section_8, section_21, eviction_notice, payment_demand, etc. |
| `response_deadline` | Agent tracks this and auto-escalates on expiry |
| `agent_reasoning` | Why the agent decided to take this action |

---

### `document_templates`
Pre-built legal letter templates per jurisdiction, with `{{placeholders}}` filled dynamically at send time.

| Key Fields | Notes |
|---|---|
| `jurisdiction` | Matched to unit.jurisdiction |
| `legal_basis` | The statute the document references |
| `version` | Templates are versioned so law changes are tracked |

---

### `agent_actions`
The complete, immutable audit log of everything the agent does. Never delete rows from this table.

| Key Fields | Notes |
|---|---|
| `tools_called` | JSON array of every tool invocation in this action |
| `confidence_score` | 0–1, agent's self-assessed certainty |
| `action_category` | maintenance / payment / legal / communication / dispute / etc. |

---

## Agent Lookup Flow

When a WhatsApp message arrives:

```
1. whatsapp_number from webhook
        ↓
2. tenants table → get lease_id
        ↓
3. leases → get unit_id, rent, status, notice period
        ↓
4. units → get jurisdiction (selects legal playbook)
        ↓
5. conversation_context → load rolling summary
        ↓
6. conversations → load last N raw messages
        ↓
7. payments → check current status
        ↓
8. maintenance_requests / disputes / legal_actions → any open items
        ↓
Agent has full context. Responds. Logs to agent_actions.
```

---

## Legal Escalation Ladder

The agent never escalates to the landlord for action. It escalates its own response level internally:

```
Level 1 – Conversational
Friendly WhatsApp message, resolve informally

        ↓

Level 2 – Formal Written
Official notice generated from document_templates, logged to legal_actions

        ↓

Level 3 – Legal Process
Statutory notices issued, deadlines tracked in legal_actions.response_deadline

        ↓

Level 4 – Pre-Tribunal
Full case file compiled, landlord_notification created with requires_signature = TRUE
Agent has done everything — landlord may only need to sign
```

---

*Last updated: February 2026*
