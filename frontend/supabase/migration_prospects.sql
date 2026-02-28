-- Migration: Prospect-to-Lease Pipeline
-- Creates tables for prospective tenant inquiries, applications, and digital signing.
-- Run this in the Supabase SQL editor or via supabase db push.

-- ============================================================
-- prospects
-- Tracks anyone who has messaged via WhatsApp but is not yet a tenant.
-- ============================================================
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    interested_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'inquiring'
        CHECK (status IN ('inquiring', 'applied', 'approved', 'rejected', 'lease_sent', 'signed')),
    conversation_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone_number);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);

-- ============================================================
-- prospect_conversations
-- Raw inbound/outbound WhatsApp messages for prospects (mirrors conversations table).
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_body TEXT NOT NULL,
    whatsapp_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_conversations_prospect ON prospect_conversations(prospect_id);

-- ============================================================
-- lease_applications
-- Full rental application submitted via the public /apply form.
-- ============================================================
CREATE TABLE IF NOT EXISTS lease_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    current_address TEXT,
    employment_status TEXT CHECK (employment_status IN ('employed', 'self_employed', 'student', 'retired', 'unemployed', 'other')),
    employer_name TEXT,
    monthly_income NUMERIC(10, 2),
    references_text TEXT,
    additional_info TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    landlord_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_applications_prospect ON lease_applications(prospect_id);
CREATE INDEX IF NOT EXISTS idx_lease_applications_status ON lease_applications(status);
CREATE INDEX IF NOT EXISTS idx_lease_applications_unit ON lease_applications(unit_id);

-- ============================================================
-- signing_tokens
-- One-time tokens that gate the public /sign/[token] page.
-- The token IS the id UUID (sent as a URL parameter).
-- ============================================================
CREATE TABLE IF NOT EXISTS signing_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    application_id UUID REFERENCES lease_applications(id) ON DELETE SET NULL,
    lease_content TEXT NOT NULL,
    prospect_name TEXT NOT NULL,
    prospect_phone TEXT NOT NULL,
    unit_address TEXT,
    monthly_rent NUMERIC(10, 2),
    signature_data_url TEXT,
    signed_at TIMESTAMPTZ,
    pdf_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signing_tokens_prospect ON signing_tokens(prospect_id);

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read prospects"
    ON prospects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read prospect_conversations"
    ON prospect_conversations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read lease_applications"
    ON lease_applications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can read signing_tokens by id"
    ON signing_tokens FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert lease_applications"
    ON lease_applications FOR INSERT TO anon, authenticated WITH CHECK (true);
