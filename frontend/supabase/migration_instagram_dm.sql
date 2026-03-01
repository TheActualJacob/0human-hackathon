-- Migration: Instagram DM Channel Support
-- Adds instagram_user_id and source_channel to prospects and prospect_conversations
-- so that inbound Instagram DMs can be routed through the prospect agent.
-- Run this in the Supabase SQL editor or via supabase db push.

-- ============================================================
-- prospects — add Instagram identity + channel tracking
-- ============================================================

ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS instagram_user_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT 'whatsapp'
        CHECK (source_channel IN ('whatsapp', 'instagram_dm'));

CREATE INDEX IF NOT EXISTS idx_prospects_instagram_user ON prospects(instagram_user_id)
    WHERE instagram_user_id IS NOT NULL;

-- ============================================================
-- prospect_conversations — track which channel each message came from
-- ============================================================

ALTER TABLE prospect_conversations
    ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT 'whatsapp'
        CHECK (source_channel IN ('whatsapp', 'instagram_dm'));

-- ============================================================
-- signing_tokens — add landlord_id for post-signing notifications
-- (unit_id is reachable via application_id -> lease_applications.unit_id,
--  but landlord_id is added as a convenience denormalisation)
-- ============================================================

ALTER TABLE signing_tokens
    ADD COLUMN IF NOT EXISTS landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL;
