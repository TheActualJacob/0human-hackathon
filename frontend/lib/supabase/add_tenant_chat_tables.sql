-- ============================================================
-- MIGRATION: Tenant AI Chat Tables
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Session groups: one row per conversation thread
CREATE TABLE IF NOT EXISTS tenant_chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lease_id    UUID REFERENCES leases(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT 'New Conversation',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages within a session
CREATE TABLE IF NOT EXISTS tenant_chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES tenant_chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant ON tenant_chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON tenant_chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON tenant_chat_messages(session_id, created_at);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE tenant_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_chat_messages ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same pattern as maintenance_workflows)
CREATE POLICY "Enable read for all users" ON tenant_chat_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tenant_chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON tenant_chat_sessions FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON tenant_chat_sessions FOR DELETE USING (true);

CREATE POLICY "Enable read for all users" ON tenant_chat_messages FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON tenant_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete for all users" ON tenant_chat_messages FOR DELETE USING (true);

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('tenant_chat_sessions', 'tenant_chat_messages');
