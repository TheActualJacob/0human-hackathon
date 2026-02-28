# PropAI - AI-Powered Property Management Platform

A modern property management dashboard that demonstrates AI-powered automation for maintenance, rent collection, and tenant management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 🎯 Demo Flow

### 1. Dashboard Overview
- View KPI metrics and AI resolution rate
- Monitor live activity feed showing AI actions
- Check agent status panel (Active mode, 78% autonomy)

### 2. Maintenance Demo (Hero Feature)
1. Navigate to **Maintenance** page
2. Click **"New Ticket"** button
3. Select any tenant (e.g., "Sarah Johnson - Unit 2A")
4. Enter title: "Kitchen sink issue"
5. Click the example text for description
6. Click **"Run AI Agent"** button
7. Watch AI classify the issue and assign vendor automatically

### 3. Key Features to Highlight

#### AI Classification
- Automatically categorizes maintenance issues
- Sets urgency levels based on description
- Shows confidence scores

#### Smart Vendor Assignment
- Selects optimal vendor based on:
  - Specialty match
  - Response time
  - AI performance score
  - Availability

#### Autonomous Mode Toggle
- Visit **Settings** page
- Adjust autonomy level slider
- Switch between Active/Passive/Off modes

## 🏗️ Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS** (Dark mode)
- **shadcn/ui** components
- **Zustand** for state management
- **Recharts** for data visualization

## 🎨 Design Features

- Bloomberg Terminal aesthetic
- Dark mode by default
- AI glow effects on automated elements
- Real-time activity animations
- High contrast, minimal design

## 📊 Mock Data

All data is pre-populated for demo purposes:
- 8 tenants with varying risk scores
- 5 maintenance tickets in different states
- 6 vendors with performance metrics
- Rent payment history
- Lease renewal predictions

## 🤖 AI Features

- **Maintenance Classification**: Categorizes issues based on keywords
- **Vendor Selection**: Matches best vendor using multiple criteria
- **Risk Scoring**: Calculates tenant risk based on payment history
- **Renewal Recommendations**: Suggests lease renewal probability
- **Activity Generation**: Creates realistic activity log entries

## 📱 Pages

1. **Dashboard** - Command center with KPIs and activity feed
2. **Maintenance** - Ticket management with AI decision panel
3. **Rent Collection** - Payment tracking and automated reminders
4. **Tenants** - Risk profiles and AI-generated insights
5. **Leases** - Renewal recommendations and expiry tracking
6. **Vendors** - Performance metrics and AI scoring
7. **Reports** - Analytics and AI efficiency metrics
8. **Settings** - Configure agent behavior and automation rules

## 🎪 Presentation Tips

1. Start on the Dashboard to show the "command center" feel
2. Emphasize the AI agent status (Active, 78% autonomy)
3. Demo the maintenance flow - it's the most impressive
4. Show how AI decisions appear in real-time
5. Point out the AI glow effects on automated elements
6. Toggle autonomous mode in Settings to show control
7. Highlight time saved and efficiency metrics in Reports

## 🔧 Customization

To adjust mock data, edit files in `/lib/mockData/`
To modify AI behavior, update `/lib/agentEngine/index.ts`






















## CLAUDE STRUCTURE

<![CDATA[<div align="center">

# 🏠 PropPilot AI

### **The Property Management Agency — Run Entirely by AI Agents**

*Replacing the traditional property management agency with an autonomous multi-agent system that handles your properties 24/7 — from rent collection to broken boilers.*

[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20AI-7C3AED?style=for-the-badge&logo=anthropic&logoColor=white)](https://anthropic.com)
[![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=python&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-Dashboard-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Twilio-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://twilio.com)

---

**🇬🇷 Built for the Greek rental market · 🤖 Zero-human operations · ⚡ 24/7 autonomous agents**

</div>

---

## 💡 The Problem

Greece has **500,000+ small landlords**, most managing 1–5 properties. They spend **15–20 hours/month** on rent collection, maintenance coordination, tenant communication, and paperwork — or they pay a property management company **8–12% of monthly rent** for a service that still runs on phone calls and spreadsheets.

**PropPilot AI replaces the entire agency** with a team of specialized AI agents that operate autonomously across every channel tenants and landlords already use.

---

## 🏗️ The Five Pillars — Each Powered by an AI Agent

<table>
<tr>
<td width="20%" align="center">
<h3>📋 Administrative<br/>Management</h3>
<em>The Compliance Agent</em>
</td>
<td width="20%" align="center">
<h3>🔧 Technical<br/>Management</h3>
<em>The Maintenance Agent</em>
</td>
<td width="20%" align="center">
<h3>💰 Financial<br/>Management</h3>
<em>The Finance Agent</em>
</td>
<td width="20%" align="center">
<h3>🤝 Conflict<br/>Resolution</h3>
<em>The Mediator Agent</em>
</td>
<td width="20%" align="center">
<h3>👥 Tenant<br/>Selection</h3>
<em>The Screening Agent</em>
</td>
</tr>
<tr>
<td valign="top">
Lease tracking & renewals<br/>
Regulatory compliance<br/>
Document generation<br/>
Deadline monitoring<br/>
Receipt issuance
</td>
<td valign="top">
Maintenance request intake<br/>
Issue classification & urgency<br/>
Tradesperson coordination<br/>
Scheduling & follow-up<br/>
Repair cost tracking
</td>
<td valign="top">
Rent collection monitoring<br/>
Payment reminders (escalating)<br/>
Expense tracking<br/>
Monthly financial reports<br/>
Tax-ready summaries
</td>
<td valign="top">
Tenant dispute handling<br/>
Professional mediation<br/>
Noise/behavior complaints<br/>
Escalation protocols<br/>
Communication logging
</td>
<td valign="top">
Inquiry qualification<br/>
Viewing scheduling<br/>
Background assessment<br/>
Application processing<br/>
Lease onboarding
</td>
</tr>
</table>

---

## 🔄 How It Works — Zero Human in the Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     TENANT CHANNELS                          │
│   WhatsApp  ·  SMS  ·  Phone Call  ·  Email                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   🧠 AGENT ORCHESTRATOR                      │
│                                                              │
│   Receives message → Classifies intent → Routes to the      │
│   appropriate specialized agent → Executes autonomously      │
│                                                              │
│   Powered by Claude (Anthropic) with function calling        │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ 📋     │ │ 🔧     │ │ 💰     │ │ 🤝     │ │ 👥     │
   │ Admin  │ │ Maint. │ │Finance │ │Mediator│ │Screen. │
   │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
       │          │          │          │          │
       └──────────┴──────────┴──────────┴──────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  📊 LANDLORD DASHBOARD                       │
│                                                              │
│   Property overview  ·  Rent status  ·  Agent activity log  │
│   Maintenance history  ·  Financial reports  ·  Overrides   │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Autonomous Flows

### 💰 Rent Collection Cycle
```
Day 1   → Agent checks bank for incoming rent
          ✅ Paid → Generate receipt → Send to tenant via WhatsApp
          ❌ Not paid → Flag, wait until Day 5

Day 5   → Friendly reminder (WhatsApp):
          "Γεια σου Μαρία, μικρή υπενθύμιση για το ενοίκιο..."

Day 10  → Firmer follow-up + offer to discuss

Day 15  → Alert landlord with recommended actions

Day 30  → Monthly summary to landlord:
          "All 3 properties: 2 paid on time, 1 paid Day 7."
```

### 🔧 Maintenance Request
```
Tenant WhatsApp: "Ο θερμοσίφωνας δεν δουλεύει"
  ↓
Agent classifies: PLUMBING → URGENT (no hot water)
  ↓
Finds plumber from approved list → Contacts via WhatsApp
  ↓
Coordinates schedule between tenant & plumber
  ↓
Confirms appointment with both parties
  ↓
After repair: verifies fix with tenant → Logs cost
  ↓
Notifies landlord: "Water heater fixed. Cost: €120."
```

### 🤝 Conflict Resolution
```
Tenant A: "Ο γείτονας κάνει φασαρία κάθε βράδυ"
  ↓
Agent acknowledges → Logs complaint with timestamp
  ↓
Sends diplomatic message to Tenant B (if same property/building)
  ↓
Monitors for resolution → Follows up after 48h
  ↓
Escalates to landlord only if unresolved after 2 attempts
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Agent Brain** | Claude Sonnet 4.5 (Anthropic) | LLM with function calling — the decision-making core |
| **Backend** | Python + FastAPI | API server, webhook handler, agent orchestration |
| **Database** | Supabase (PostgreSQL) | Properties, tenants, payments, repairs, activity logs |
| **Messaging** | Twilio WhatsApp API | Bi-directional tenant & tradesperson communication |
| **Frontend** | Next.js + Tailwind + shadcn/ui | Landlord dashboard |
| **Scheduling** | APScheduler | Cron jobs: rent checks, reminders, reports |
| **PDFs** | WeasyPrint | Rent receipts, financial summaries |
| **Deployment** | Railway (backend) + Vercel (frontend) | Fast, free-tier deployment |

---

## 📁 Project Structure

```
proppilot-ai/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Environment variables & settings
│   │
│   ├── agents/
│   │   ├── orchestrator.py      # Routes messages to specialized agents
│   │   ├── maintenance.py       # 🔧 Technical management agent
│   │   ├── finance.py           # 💰 Financial management agent
│   │   ├── admin.py             # 📋 Administrative management agent
│   │   ├── mediator.py          # 🤝 Conflict resolution agent
│   │   ├── screening.py         # 👥 Tenant selection agent
│   │   └── prompts/
│   │       ├── system.py        # Base system prompt
│   │       ├── maintenance.py   # Maintenance-specific prompt
│   │       ├── finance.py       # Finance-specific prompt
│   │       └── ...
│   │
│   ├── tools/
│   │   ├── whatsapp.py          # Send/receive WhatsApp messages
│   │   ├── database.py          # Supabase CRUD operations
│   │   ├── pdf_generator.py     # Receipt & report generation
│   │   ├── scheduler.py         # APScheduler cron job definitions
│   │   └── bank_monitor.py      # Payment detection (simulated for MVP)
│   │
│   ├── webhooks/
│   │   ├── twilio.py            # Incoming WhatsApp webhook handler
│   │   └── payment.py           # Payment notification webhook
│   │
│   ├── models/
│   │   ├── property.py          # Property data model
│   │   ├── tenant.py            # Tenant data model
│   │   ├── payment.py           # Payment/rent data model
│   │   ├── maintenance.py       # Repair request data model
│   │   └── activity.py          # Agent activity log model
│   │
│   ├── api/
│   │   ├── properties.py        # GET /api/properties
│   │   ├── activity.py          # GET /api/activity-log
│   │   ├── payments.py          # GET /api/payments
│   │   └── simulate.py          # POST /api/simulate-* (demo helpers)
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Dashboard home — property overview
│   │   ├── activity/
│   │   │   └── page.tsx         # Agent activity feed (real-time)
│   │   ├── property/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Property detail view
│   │   └── layout.tsx           # App shell & navigation
│   │
│   ├── components/
│   │   ├── PropertyCard.tsx     # Property status card
│   │   ├── ActivityFeed.tsx     # Real-time agent action log
│   │   ├── RentTimeline.tsx     # Visual rent payment timeline
│   │   ├── MaintenanceLog.tsx   # Repair history & status
│   │   └── FinancialSummary.tsx # Income/expense overview
│   │
│   ├── lib/
│   │   └── supabase.ts         # Supabase client config
│   │
│   ├── package.json
│   └── tailwind.config.ts
│
├── database/
│   ├── schema.sql               # Full Supabase schema
│   └── seed.sql                 # Demo data (3 properties, tenants, history)
│
├── docs/
│   ├── ARCHITECTURE.md          # System design deep-dive
│   ├── AGENT_PROMPTS.md         # All agent system prompts
│   └── DEMO_SCRIPT.md          # Hackathon demo walkthrough
│
├── .env.example                 # Required environment variables
├── docker-compose.yml           # Local development setup
└── README.md                    # ← You are here
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Twilio account with WhatsApp Sandbox enabled
- Anthropic API key
- Supabase project

### 1. Clone & configure
```bash
git clone https://github.com/your-team/proppilot-ai.git
cd proppilot-ai
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, TWILIO_SID, TWILIO_TOKEN, SUPABASE_URL, SUPABASE_KEY
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Database
```bash
# Run in Supabase SQL editor:
# 1. database/schema.sql
# 2. database/seed.sql
```

### 5. WhatsApp Webhook
```bash
# Expose local server (for Twilio webhook)
ngrok http 8000

# Set Twilio WhatsApp Sandbox webhook to:
# https://your-ngrok-url.ngrok.io/webhook/whatsapp
```

---

## 🎯 Demo Scenario

> **Landlord Κώστας** owns 3 apartments in Athens. He used to spend 15 hours/month managing them. Now, PropPilot AI handles everything.

| Demo Step | What Happens | What Judges See |
|---|---|---|
| 1. **Maintenance** | Send WhatsApp: *"Ο θερμοσίφωνας χάλασε"* | Agent responds, contacts plumber, schedules repair — all in 60 seconds |
| 2. **Rent Collection** | Simulate a payment arriving | Agent detects it, generates receipt, sends to tenant, updates dashboard |
| 3. **Late Rent** | Show a tenant who hasn't paid | Agent has already sent a reminder. Show the actual WhatsApp message chain |
| 4. **Dashboard** | Open the landlord dashboard | All 3 properties, rent status, agent activity log, financial summary |
| 5. **The Punchline** | — | *"This replaces a €150/month agency. PropPilot runs 24/7 for a fraction of the cost."* |

---

## 📊 Agent Activity Log (Sample)

```
📋 PropPilot AI — Activity Log — March 15, 2026
──────────────────────────────────────────────────

09:01  💰 Checked bank: Rent received from Maria K. (€500)
       → Generated receipt → Sent via WhatsApp ✓

09:01  ⚠️  Checked bank: No payment from Nikos P. (€450)
       → Day 7 overdue. Friendly reminder sent.

11:34  🔧 Maintenance request — Apartment B (Παγκράτι):
       "Ο θερμοσίφωνας δεν δουλεύει"
       → Classified: Plumbing / Urgent
       → Contacted Γιώργος (plumber): Available tomorrow 10am
       → Confirmed with tenant ✓
       → Est. cost: €80-120 (auto-approved)

14:00  💰 Late payment received: Nikos P. (€450)
       → Generated receipt → Sent via WhatsApp ✓
       → All 3 properties now paid for March ✅

18:00  📋 Lease alert: Apartment C lease expires in 30 days
       → Drafted renewal terms → Sent to landlord for review
```

---

## 👥 Team

Built in 24 hours at **[Hackathon Name]** by:

- **[Name]** — Backend & Agent Architecture
- **[Name]** — AI Integration & Agent Prompts
- **[Name]** — Frontend Dashboard & Demo

---

## 📄 License

MIT — built for Greek landlords, by Greek developers. 🇬🇷

---

<div align="center">

*PropPilot AI — Because your properties should manage themselves.*

**🏠 🤖 ✨**

</div>
]]>