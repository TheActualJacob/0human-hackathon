-- ============================================================
-- MIGRATION: Add profile_data column to tenants
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add profile_data JSONB column to store application auto-fill data,
-- emergency contacts, and notification preferences
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'profile_data';
