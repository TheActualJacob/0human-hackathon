<div align="center">

<img src="https://img.shields.io/badge/PropAI-AI--Powered_Property_Management-00c950?style=for-the-badge&logoColor=white" alt="PropAI" height="40"/>

# PropAI

### The AI-Native Property Management Platform

**Autonomous lease renewals. Conversational tenant support. Predictive maintenance. Real-time market pricing.**  
Built for the modern landlord — powered by Claude, Twilio, Stripe, and Supabase.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Anthropic](https://img.shields.io/badge/Claude_AI-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://anthropic.com)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com)
[![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=flat-square&logo=twilio&logoColor=white)](https://twilio.com)
[![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)

<br/>

[Live Demo](https://energetic-transformation-production-c907.up.railway.app) · [Landlord Demo](https://energetic-transformation-production-c907.up.railway.app/demo/landlord) · [Tenant Demo](https://energetic-transformation-production-c907.up.railway.app/demo/tenant)

</div>

---

## The Problem

The global residential rental market is a **$2.4 trillion industry** managed almost entirely by spreadsheets, emails, and reactive phone calls.

**For landlords:**
- Lease renewal negotiations are manual, slow, and leave money on the table
- Maintenance requests fall through cracks across email, WhatsApp, and text
- Pricing decisions are made on gut feel — not real-time market data
- Prospect inquiries from Instagram and WhatsApp go unanswered for days

**For tenants:**
- Getting a question answered means waiting days for a callback
- Reporting a maintenance issue is a multi-step odyssey with no visibility
- Signing a lease still involves printing, scanning, and emailing PDFs

PropAI eliminates all of this. Every workflow that used to require a human handoff is now autonomous.

---

## What PropAI Does

PropAI is a **full-stack, AI-native property management platform** with two dashboards — one for landlords, one for tenants — underpinned by an autonomous AI agent system that handles the entire property lifecycle end-to-end.

```
Prospect DMs on Instagram
        ↓
  AI Prospect Agent (Claude)
        ↓
  Guided to application form
        ↓
  AI screens application (income, docs, credit signals)
        ↓
  Landlord approves in one click
        ↓
  Claude drafts bespoke lease agreement
        ↓
  Digital signing link sent via WhatsApp
        ↓
  Tenant signs → PDF generated → stored in Supabase
        ↓
  Stripe payment link issued for first month + deposit
        ↓
  ─── TENANCY BEGINS ───
        ↓
  WhatsApp AI agent handles rent queries, maintenance, disputes
        ↓
  Maintenance FSM: Submit → Classify → Owner Notify → Vendor → Complete
        ↓
  Predictive AI flags appliances at risk before they fail
        ↓
  Revenue AI models optimal rent price using live market comps
        ↓
  Lease expiry detected → Renewal offer sent via WhatsApp
        ↓
  Tenant declines → Gemini generates listing image
        ↓
  Auto-posted to Instagram → Prospect cycle restarts
```

---

## Core Feature Modules

### 1. Autonomous AI Agent System

Two Claude-powered agentic loops handle all inbound communication autonomously.

**Tenant Agent** (`backend/app/services/agent_loop.py`)

The tenant agent operates as a context-aware property assistant. Every inbound WhatsApp message is routed through a tool-augmented Claude loop that has access to:
- The tenant's full lease (loaded from DOCX/PDF)
- Payment history and arrears status
- Active maintenance request status
- Prior conversation history

Classified intents include: `rent_payment`, `maintenance_report`, `lease_query`, `rent_arrears_negotiation`, `dispute_escalation`, `general_inquiry`. The agent generates WhatsApp replies, creates payment plans, logs structured action records, and escalates to the landlord only when human judgment is genuinely required.

**Prospect Agent** (`backend/app/services/prospect_agent_loop.py`)

Handles cold inbound DMs from WhatsApp and Instagram. The prospect agent:
- Answers property questions from the listing context
- Collects contact details and qualifying information conversationally
- Sends the application form URL at the right moment
- Follows up if no action is taken
- Hands off to the tenant agent once a lease is signed

**AI Tenant Chat** (`/tenant/chat`)

A persistent in-app Claude chat for tenants — session history stored in Supabase, full lease and payment context injected into every message.

---

### 2. Maintenance Workflow Engine

A finite state machine that coordinates four parties — tenant, AI, landlord, and vendor — across a structured workflow.

```
SUBMITTED → OWNER_NOTIFIED → VENDOR_ASSIGNED → IN_PROGRESS → COMPLETED
                ↓ (denied)
            REJECTED
```

**At each state transition:**
- Claude classifies urgency, category, and required trade type
- WhatsApp messages are dispatched to relevant parties
- Vendor bids are recorded and compared
- A full audit trail is maintained in `workflow_communications`
- Landlord approves/denies via a simple WhatsApp reply — no dashboard login required

All workflow state is persisted to Supabase. The landlord dashboard shows real-time status for all active requests with full communication history.

---

### 3. Predictive Maintenance AI

Landlords register property assets — boilers, HVAC units, water heaters, appliances — with install year, usage intensity, and environmental context.

Claude analyzes:
- Historical maintenance events for that asset type
- Age and expected lifespan curves
- Usage intensity and environmental degradation factors
- Cost data from prior repairs

**Output per asset:**
- 6-month and 12-month failure probability (%)
- Estimated replacement vs. repair cost
- Recommended action: *Preventive Replacement*, *Schedule Inspection*, or *Monitor*
- Projected savings from proactive vs. reactive intervention

This turns maintenance from a cost center into a manageable, forecastable line item.

---

### 4. Revenue Intelligence Engine

A quantitative rent pricing system backed by live market data.

**Data Sources:**
| Market | Source |
|--------|--------|
| Greece (Athens, Thessaloniki) | xe.gr + Spitogatos (Playwright scrapers) |
| UK | Rightmove scraper |
| US | RentCast API |
| Fallback | Statistical city-level price index |

**Hedonic Pricing Model** (`/app/api/revenue-intelligence/analyze/route.ts`)

Every comparable listing is adjusted for the subject property's specific characteristics before being used in pricing:

1. **Bedroom adjustment** — comps are scaled to the subject's bedroom count using empirically-derived medians from the comp set, falling back to standard scaling factors (Studio: 60%, 1BR: 78%, 2BR: 100%, 3BR: 128%, 4BR: 155%)
2. **Size (sqm) adjustment** — per-comp scaling to subject's exact floor area, with size-similarity weighting (closer in size = higher weight)
3. **Distance weighting** — Gaussian decay function with 5km bandwidth; nearby comps count more
4. **Similarity score weighting** — from the market data provider

The model blends two signals:
- **60%** — size-adjusted price (€/sqm × subject sqm)
- **40%** — bedroom-adjusted weighted median

**Vacancy Risk Model**

Every price recommendation accounts for the cost of vacancy:

```
Net Revenue Delta = (newRent - currentRent) × 12
                  - (vacancyRisk% × 1.5 months × newRent)
```

Vacancy risk is computed from:
- Average Days On Market (ADOM) across comps — mapped to vacancy probability bands
- Price positioning percentile (>80th = penalty)
- Month-specific seasonality coefficients (December +14pts, April −10pts)

**Claude Integration**

The hedonic price is passed to Claude as the anchor. Claude's system prompt instructs it: *"The hedonic model price is your anchor. Do not deviate from it without quantified justification."* Claude returns a structured JSON recommendation with `optimal_listing_price`, `vacancy_risk_score`, `projected_days_on_market`, `market_trend`, and three `alternative_scenarios`.

---

### 5. Autonomous Lease Renewal Engine

The renewal engine detects leases approaching expiry and orchestrates the entire renewal process — including pricing negotiation and re-listing — without landlord intervention.

**Renewal Probability Scoring** (`renewal_prediction_service.py`)

Each lease is scored on:
- Payment history (on-time rate, arrears events)
- Lease length (longer = higher renewal probability)
- Maintenance request frequency and resolution satisfaction
- Time since last rent increase
- Market positioning (is the current rent above or below market?)

**Pricing Simulation** (`renewal_pricing_engine.py`)

For each increase scenario (0% → 15% in 1% steps), the engine computes:
- Renewal probability at that price (decreases as increase grows)
- Expected revenue = `newRent × 12 × renewalProbability`
- Vacancy cost if tenant churns = `marketVacancyDays × dailyRent + turnoverCost`
- **Net Expected Revenue** — the decision variable

The optimal increase is the scenario that maximises net expected revenue, not the one with the highest headline rent.

**The Full Renewal Flow:**
```
1. Lease expiry detected (configurable window, default 60 days)
2. WhatsApp renewal offer sent to tenant
3. Claude interprets tenant response (YES / NO / counter-offer)
4. If counter-offer: Claude analyses counter vs. optimal scenario
5. If accepted: new lease parameters locked, signing link generated
6. If declined: 
   a. Gemini Imagen 3 generates a professional property listing image
   b. Auto-posted to Instagram via Meta Graph API
   c. Prospect agent activated for new inbound inquiries
```

---

### 6. Prospect-to-Lease Pipeline

A zero-friction path from Instagram DM to signed lease.

```
WhatsApp / Instagram DM
        ↓
Prospect record created (name, contact, unit interest)
        ↓
AI-guided conversation collects qualifying info
        ↓
Application link sent: /apply/[prospectId]
        ↓
Tenant completes form (income, employment, docs)
        ↓
Claude AI screening: income-to-rent ratio, doc completeness, risk signals
        ↓
Landlord reviews AI recommendation + approves/declines (one click)
        ↓
Claude drafts jurisdiction-aware lease agreement
        ↓
Signing token created (7-day expiry, one-time use)
        ↓
/sign/[token] — tenant signs digitally (react-signature-canvas)
        ↓
Signed PDF generated (pdf-lib) → stored in Supabase Storage
        ↓
Stripe Checkout link issued for first month + deposit
```

Supports **17 jurisdictions** including England & Wales, Greece, Germany, France, Spain, Netherlands, UAE, and US.

---

### 7. Digital Lease Signing

No wet signatures. No PDFs emailed back and forth.

- One-time-use signed URL with 7-day expiry
- Full lease rendered in-browser at `/sign/[token]`
- Digital signature captured via `react-signature-canvas`
- Signed PDF generated server-side with `pdf-lib` and uploaded to Supabase Storage
- Signing completion triggers WhatsApp confirmation to both parties

---

### 8. Stripe Payment Infrastructure

- Public payment page at `/pay/[paymentId]` — no login required
- Stripe Checkout session created per payment with metadata
- Webhook at `/api/stripe` updates payment record on `checkout.session.completed`
- Payment plans for rent arrears (installment schedules tracked in `payment_plans`)
- Landlord dashboard shows full payment history, overdue flags, and collection status

---

### 9. Tax Reporting

Greek Rental Income Tax calculator compliant with **Article 40, Law 4172/2013** (current as of 2024):

| Band | Rate |
|------|------|
| Gross income up to €12,000 | 15% |
| €12,001 – €35,000 | 35% |
| Above €35,000 | 45% |

Tax is calculated on **gross rental income** — no deductions. ENFIA (property tax) noted as a separate obligation. Exportable PDF report via `pdf-lib`. Rates are defined in a single constant array — updatable in one line if Greek tax law changes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                             │
│  Browser (Next.js)    WhatsApp (Twilio)    Instagram (Meta) │
└──────────────┬──────────────┬──────────────┬───────────────┘
               │              │              │
               ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND — Next.js 16                  │
│                                                             │
│  App Router Pages          Next.js API Routes               │
│  ├── /landlord/*           ├── /api/revenue-intelligence    │
│  ├── /tenant/*             ├── /api/maintenance/*           │
│  ├── /properties/*         ├── /api/sign/*                  │
│  ├── /sign/[token]         ├── /api/chat-property           │
│  └── /pay/[paymentId]      ├── /api/tenant/chat             │
│                            ├── /api/screening               │
│  Zustand Store             └── /api/predictive-maintenance  │
│  Supabase Realtime                                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND — FastAPI                         │
│                                                             │
│  Webhook Handlers          Agentic Services                 │
│  ├── /api/webhook/whatsapp ├── agent_loop.py (tenants)      │
│  ├── /api/webhook/instagram├── prospect_agent_loop.py       │
│  ├── /api/stripe           └── renewal_workflow_service.py  │
│                                                             │
│  Workflow Engine           AI Services                      │
│  ├── maintenance_workflow  ├── claude_service.py            │
│  ├── renewal_workflow      ├── renewal_pricing_engine.py    │
│  └── signing.py            └── renewal_prediction_service   │
│                                                             │
│  Integrations                                               │
│  ├── twilio_service.py     stripe_service.py                │
│  ├── instagram_dm_service  email_service.py                 │
│  └── image_generation_service.py (Gemini Imagen 3)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
│                                                             │
│  Supabase (PostgreSQL)     Supabase Storage                 │
│  ├── Core tables           ├── property-images              │
│  ├── Workflow FSM tables   ├── signed-lease-pdfs            │
│  ├── Renewal engine tables └── tenant-documents             │
│  ├── Prospect pipeline                                      │
│  └── Market data tables    Supabase Auth                    │
│                            └── Role-based (landlord/tenant) │
└─────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
      Anthropic Claude    Google Gemini       RentCast API
      (AI agent loops,    (property image     (US market data)
       pricing, chat,      generation,
       screening)          Instagram posts)
```

---

## Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | TailwindCSS 4 + shadcn/ui (New York) |
| State | Zustand 5 |
| Charts | Recharts 3 |
| Maps | React Leaflet 5 |
| Animations | Framer Motion 12 |
| PDF | pdf-lib + pdfkit |
| Signatures | react-signature-canvas |
| Scraping | Playwright 1.58 |
| Auth | Supabase SSR |

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | FastAPI |
| Runtime | Python 3.11+ / Uvicorn |
| ORM | SQLAlchemy (async) + asyncpg |
| PDF Generation | ReportLab + Pillow |
| Document Parsing | pypdf + python-docx |
| HTTP Client | httpx (async) |

### AI / ML
| Capability | Model / Service |
|-----------|----------------|
| Tenant & prospect agents | Anthropic Claude (claude-haiku-4-5) |
| Revenue pricing recommendations | Anthropic Claude |
| Lease drafting | Anthropic Claude |
| Tenant screening | Anthropic Claude |
| Predictive maintenance | Anthropic Claude |
| Property image generation | Google Gemini Imagen 3 |
| Hedonic pricing model | Custom quantitative model (TypeScript) |
| Renewal probability model | Custom scoring model (Python) |

### Infrastructure & Integrations
| Service | Purpose |
|---------|---------|
| Supabase | PostgreSQL, Auth, Storage, Realtime |
| Stripe | Rent payments, Checkout, Webhooks |
| Twilio | WhatsApp Business API (inbound + outbound) |
| Meta Graph API | Instagram DMs (inbound) + Posts (outbound) |
| Gmail SMTP | Transactional email |
| Railway | Hosting (both frontend and backend) |
| RentCast | US rental market data API |

---

## Database Schema (Overview)

```sql
-- Core entities
landlords         → units → leases → tenants
                              ↓
                           payments
                           payment_plans
                           conversations

-- Workflow layer
maintenance_requests → maintenance_workflows → workflow_communications
                                            → vendor_bids

-- AI output tables
agent_actions          -- structured log of every AI decision
landlord_notifications -- escalations requiring human attention

-- Prospect pipeline
prospects → prospect_conversations
         → lease_applications → signing_tokens

-- Renewal engine
renewal_scores → renewal_scenarios
              → renewal_offers → renewal_negotiations

-- Market data
xe_gr_listings          -- xe.gr scraped rental comps (Greece)
revenue_recommendations -- AI pricing recommendation history
market_alerts           -- price deviation / vacancy risk alerts

-- Property features
unit_attributes         -- bedrooms, bathrooms, parking, pet policy, etc.
pm_assets               -- appliances / assets for predictive maintenance
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- A Supabase project
- Accounts for: Stripe, Twilio, Anthropic (and optionally: Meta, Gemini, RentCast)

---

### 1. Clone

```bash
git clone https://github.com/TheActualJacob/0human-hackathon.git
cd 0human-hackathon
```

### 2. Database Setup

Run the following SQL scripts **in order** in the Supabase SQL editor:

```
RUN_THIS_IN_SUPABASE.sql          # Core schema + RLS policies
migration_prospects.sql           # Prospect pipeline tables
backend/migrations/001_renewal_engine.sql  # Renewal engine tables
frontend/lib/supabase/add_revenue_intelligence.sql  # Revenue tables
frontend/lib/supabase/xe_gr_listings.sql   # Market data tables
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
ANTHROPIC_API_KEY=your_anthropic_api_key
RENTCAST_API_KEY=your_rentcast_api_key          # optional, US only
```

```bash
npm install
npm run dev   # http://localhost:3000
```

### 4. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ANTHROPIC_API_KEY=your_anthropic_api_key

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

GEMINI_API_KEY=your_gemini_api_key             # for listing image generation
INSTAGRAM_ACCESS_TOKEN=your_meta_access_token  # for Instagram DMs + posting
INSTAGRAM_VERIFY_TOKEN=your_verify_token

GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

APP_URL=https://your-backend.railway.app
FRONTEND_URL=http://localhost:3000
```

```bash
uvicorn app.main:app --reload   # http://localhost:8000
```

### 5. WhatsApp Webhook (Twilio)

Configure your Twilio WhatsApp sandbox/number to POST inbound messages to:

```
https://your-backend.railway.app/api/webhook/whatsapp
```

### 6. Instagram Webhook (Meta)

In the Meta Developer Console, configure:
- **Webhook URL:** `https://your-backend.railway.app/api/webhook/instagram`
- **Verify Token:** matches `INSTAGRAM_VERIFY_TOKEN`
- **Subscriptions:** `messages`, `messaging_postbacks`

---

## Development Scripts

```bash
# Frontend
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Start production server
npm run check-db      # Test Supabase connection
npm run scrape        # Scrape xe.gr for Greek market data
npm run scrape:all    # Scrape all configured sources

# Backend
uvicorn app.main:app --reload   # Dev server with hot reload
```

---

## Deployment

Both services deploy to **Railway** via `railway.toml` config files.

**Backend** (`Procfile`):
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Frontend**: Standard Next.js — Railway auto-detects and builds.

Set all environment variables in the Railway service settings. No additional configuration required.

---

## User Roles & Access

| Route Namespace | Role | Access |
|----------------|------|--------|
| `/landlord/*` | `landlord` | Full property management dashboard |
| `/tenant/*` | `tenant` | Lease, payments, maintenance, AI chat |
| `/properties/*` | Public | Browse + apply for listed properties |
| `/apply/[prospectId]` | Public | WhatsApp/Instagram prospect application form |
| `/sign/[token]` | Public (token-gated) | Digital lease signing |
| `/pay/[paymentId]` | Public (link-gated) | Stripe rent payment |
| `/demo/*` | Public | No-auth demo experience |

Role enforcement is implemented in Next.js middleware — Supabase session is read on every request and redirected to the correct dashboard or `/unauthorized` if the role doesn't match.

---

## Key API Reference

### Frontend API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/revenue-intelligence/analyze` | Run AI rent pricing analysis for a unit |
| `GET` | `/api/revenue-intelligence/analyze` | Fetch historical recommendations + alerts |
| `POST` | `/api/maintenance/submit` | Submit maintenance request + trigger workflow |
| `POST` | `/api/maintenance/owner-response` | Landlord approves or denies maintenance |
| `POST` | `/api/maintenance/vendor-response` | Vendor confirms ETA |
| `POST` | `/api/maintenance/complete` | Mark maintenance job complete |
| `POST` | `/api/predictive-maintenance/analyze` | Run Claude asset failure prediction |
| `POST` | `/api/screening` | Run Claude tenant application screening |
| `POST` | `/api/tenant/chat` | Send message to tenant AI assistant |
| `GET/POST` | `/api/sign/[token]` | Fetch/submit digital lease signing |
| `GET` | `/api/sign/[token]/pdf` | Download signed lease PDF |
| `POST` | `/api/sign/create` | Create signing token + draft lease |
| `POST` | `/api/xe-gr/crawl` | Trigger xe.gr market data crawl |

### Backend API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhook/whatsapp` | Twilio WhatsApp inbound (tenant + prospect routing) |
| `POST` | `/api/webhook/instagram` | Meta Instagram DM inbound |
| `POST` | `/api/stripe` | Stripe webhook (payment completion) |
| `POST` | `/api/renewals/initiate` | Initiate lease renewal workflow |
| `POST` | `/api/renewals/simulate` | Run renewal pricing simulation |
| `POST` | `/api/renewals/tenant-response` | Record tenant renewal response |
| `POST` | `/api/renewals/landlord-decision` | Record landlord final decision |
| `POST` | `/api/property-applications/select-best/{unitId}` | AI tenant selection |
| `GET` | `/health` | Backend health check |

---

## Market Coverage

PropAI's Revenue Intelligence engine currently supports live market data for:

| Country | Data Source | Coverage |
|---------|-------------|----------|
| 🇬🇷 Greece | xe.gr + Spitogatos (Playwright) | Athens, Thessaloniki, Crete, Islands |
| 🇬🇧 United Kingdom | Rightmove (Playwright) | England, Scotland, Wales |
| 🇺🇸 United States | RentCast API | All major metros |
| All others | City price index fallback | 30+ cities globally |

---

## The Opportunity

- **200 million** rental units globally managed by individual landlords
- **$2.4 trillion** in annual residential rental revenue
- **Average landlord** owns 2–5 properties and manages them with email and WhatsApp
- **Renewal negotiations** alone cost landlords an estimated 3–8% of annual revenue in sub-optimal pricing and unnecessary vacancy
- **Maintenance** is the #1 tenant dissatisfaction driver and #1 landlord time drain

PropAI addresses the entire operational surface area of property management with a single, AI-first platform — not a digitised version of the old workflow, but a fundamentally autonomous one.

---

## Roadmap

- [ ] **Multi-currency rent collection** — Stripe PaymentIntents across EUR, GBP, USD, AED
- [ ] **Contractor marketplace** — embedded tender/quote system with vetted vendors
- [ ] **AI lease review** — Claude flags unusual clauses in uploaded lease templates
- [ ] **Portfolio analytics** — yield, void rate, capex forecasting across all units
- [ ] **Multi-country legal templates** — full jurisdiction coverage for 50+ countries
- [ ] **Landlord mobile app** — React Native with push notifications
- [ ] **Open API** — webhooks and REST API for third-party integrations (accounting, HMRC/AADE filing)
- [ ] **AI rent guarantee** — PropAI underwrites rent risk using its own payment probability model

---

## Contributing

This project was built as a hackathon submission. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with Claude, Supabase, Twilio, Stripe, and a lot of ambition.

**PropAI** — *Because managing property should be autonomous.*

</div>
