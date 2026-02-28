-- ============================================================
-- DEBUG: First, let's see what we're dealing with
-- ============================================================

-- 1. Show all auth.users
SELECT 
    id,
    email,
    created_at
FROM auth.users;

-- 2. Show all landlords with their emails
SELECT 
    id,
    full_name,
    email,
    auth_user_id,
    created_at
FROM landlords
ORDER BY created_at;

-- 3. Show all tenants with their emails
SELECT 
    id,
    full_name,
    email,  
    auth_user_id,
    created_at
FROM tenants
ORDER BY created_at;

-- 4. Check if auth_users table exists and what's in it
SELECT * FROM auth_users;

-- ============================================================
-- FIX: Now let's fix the linking issues
-- ============================================================

-- STEP 1: First ensure the auth_user_id column exists on both tables
ALTER TABLE landlords 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- STEP 2: Link existing records by matching emails
-- This is the critical part - match auth.users to landlords/tenants by email
UPDATE landlords l
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(TRIM(l.email)) = LOWER(TRIM(au.email))
AND l.auth_user_id IS NULL;

UPDATE tenants t  
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(TRIM(t.email)) = LOWER(TRIM(au.email))
AND t.auth_user_id IS NULL;

-- STEP 3: Create/Update auth_users mapping table
-- First check if the table exists
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('landlord', 'tenant')),
    entity_id UUID NOT NULL
);

-- Insert missing landlord mappings
INSERT INTO auth_users (id, role, entity_id)
SELECT 
    l.auth_user_id,
    'landlord',
    l.id
FROM landlords l
WHERE l.auth_user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM auth_users au WHERE au.id = l.auth_user_id
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    entity_id = EXCLUDED.entity_id;

-- Insert missing tenant mappings  
INSERT INTO auth_users (id, role, entity_id)
SELECT 
    t.auth_user_id,
    'tenant', 
    t.id
FROM tenants t
WHERE t.auth_user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM auth_users au WHERE au.id = t.auth_user_id
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    entity_id = EXCLUDED.entity_id;

-- ============================================================
-- VERIFY: Check the results
-- ============================================================

-- Show updated landlord status
SELECT 
    'Landlords' as table_name,
    COUNT(*) as total,
    COUNT(auth_user_id) as with_auth_user_id,
    COUNT(*) - COUNT(auth_user_id) as missing_auth_user_id
FROM landlords

UNION ALL

SELECT 
    'Tenants' as table_name,
    COUNT(*) as total,
    COUNT(auth_user_id) as with_auth_user_id,
    COUNT(*) - COUNT(auth_user_id) as missing_auth_user_id
FROM tenants;

-- Show which emails don't have auth.users accounts
SELECT 
    'Landlords without auth account' as issue,
    l.email,
    l.full_name
FROM landlords l
WHERE l.auth_user_id IS NULL

UNION ALL

SELECT 
    'Tenants without auth account' as issue,
    t.email,
    t.full_name  
FROM tenants t
WHERE t.auth_user_id IS NULL;