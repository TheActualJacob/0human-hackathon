# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (from `frontend/`)
```bash
npm run dev        # Start Next.js dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run check-db   # Test Supabase connection
```

### Backend (from `backend/`)
```bash
# First-time setup
py -m venv venv
source venv/Scripts/activate   # Git Bash on Windows
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload  # Starts on localhost:8000
```

No test or lint commands are configured yet.

## Architecture

Monorepo with two independent applications:

- **`frontend/`** — Next.js 16 (App Router) + React 19 + TypeScript
- **`backend/`** — FastAPI + SQLAlchemy (async) + asyncpg

Both connect to **Supabase** (hosted PostgreSQL). The frontend reads/writes via the Supabase JS client; the backend uses SQLAlchemy with `postgresql+asyncpg://` connection strings.

### Frontend

**State management:** Single Zustand store at `lib/store/useStore.ts`. All data fetching, CRUD operations, and real-time Supabase subscriptions live here. Pages consume the store directly via `useStore()` hook.

**UI:** Shadcn/ui components (new-york style) in `components/ui/`. Dark mode is always on (Bloomberg Terminal aesthetic). Styling uses TailwindCSS 4.

**AI agent engine:** `lib/agentEngine/index.ts` contains domain-specific AI functions (maintenance classification, vendor selection, tenant risk scoring, WhatsApp intent parsing, legal action recommendations). These are client-side helpers, not API calls.

**Routing:** App Router pages at `app/<route>/page.tsx`. Key routes: `/` (dashboard), `/landlords`, `/units`, `/tenants`, `/leases`, `/payments`, `/maintenance`, `/conversations`, `/legal`, `/contractors`, `/reports`, `/settings`.

**Layout:** `app/layout.tsx` wraps all pages with `StoreProvider` (initializes Zustand + Supabase subscriptions), a sidebar, and top bar.

**Supabase client:** `lib/supabase/client.ts` exports `createBrowserClient()`. Types are auto-generated in `lib/supabase/database.types.ts`.

### Backend

Minimal/skeletal — currently only a health check endpoint at `GET /health`.

**Structure:** `app/main.py` (FastAPI app + CORS + Stripe init), `app/config.py` (Pydantic settings), `app/database.py` (async SQLAlchemy engine/session), `app/routes/` (route modules), `app/models/` (empty, awaiting model definitions).

CORS is configured to allow `http://localhost:3000`.

## Environment Variables

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `DATABASE_URL` — PostgreSQL connection string (server-side)

### Backend (`backend/.env`)
- `DATABASE_URL` — Must use `postgresql+asyncpg://` prefix
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY` (optional)
