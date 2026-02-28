-- ============================================================
-- ROBUST FIX: Link ALL auth users to their landlord/tenant records
-- This fixes existing records and ensures future ones work
-- ============================================================

-- STEP 1: Fix all existing landlords
-- Link landlords to auth users by matching emails
UPDATE landlords l
SET auth_user_id = u.id
FROM auth.users u
WHERE l.email = u.email
AND l.auth_user_id IS NULL;

-- STEP 2: Fix all existing tenants  
-- Link tenants to auth users by matching emails
UPDATE tenants t
SET auth_user_id = u.id
FROM auth.users u
WHERE t.email = u.email
AND t.auth_user_id IS NULL;

-- STEP 3: Ensure auth_users table has all mappings
-- Insert missing landlord mappings
INSERT INTO auth_users (id, role, entity_id)
SELECT 
    u.id,
    'landlord',
    l.id
FROM auth.users u
JOIN landlords l ON l.auth_user_id = u.id
WHERE NOT EXISTS (
    SELECT 1 FROM auth_users au WHERE au.id = u.id
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    entity_id = EXCLUDED.entity_id;

-- Insert missing tenant mappings
INSERT INTO auth_users (id, role, entity_id)
SELECT 
    u.id,
    'tenant',
    t.id
FROM auth.users u
JOIN tenants t ON t.auth_user_id = u.id
WHERE NOT EXISTS (
    SELECT 1 FROM auth_users au WHERE au.id = u.id
)
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    entity_id = EXCLUDED.entity_id;

-- STEP 4: Create a trigger to automatically set auth_user_id for future signups
-- This ensures new landlords are automatically linked
CREATE OR REPLACE FUNCTION link_auth_user_to_landlord()
RETURNS TRIGGER AS $$
BEGIN
    -- If auth_user_id is not set, try to find it by email
    IF NEW.auth_user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.auth_user_id
        FROM auth.users
        WHERE email = NEW.email
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_link_landlord_auth ON landlords;

-- Create the trigger
CREATE TRIGGER auto_link_landlord_auth
BEFORE INSERT OR UPDATE ON landlords
FOR EACH ROW
EXECUTE FUNCTION link_auth_user_to_landlord();

-- Same trigger for tenants
CREATE OR REPLACE FUNCTION link_auth_user_to_tenant()
RETURNS TRIGGER AS $$
BEGIN
    -- If auth_user_id is not set, try to find it by email
    IF NEW.auth_user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.auth_user_id
        FROM auth.users
        WHERE email = NEW.email
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_link_tenant_auth ON tenants;

-- Create the trigger
CREATE TRIGGER auto_link_tenant_auth
BEFORE INSERT OR UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION link_auth_user_to_tenant();

-- STEP 5: Verify the fix worked
SELECT 
    'Landlords with auth_user_id' as check_type,
    COUNT(*) as count
FROM landlords
WHERE auth_user_id IS NOT NULL

UNION ALL

SELECT 
    'Landlords without auth_user_id' as check_type,
    COUNT(*) as count
FROM landlords
WHERE auth_user_id IS NULL

UNION ALL

SELECT 
    'Auth users mapped' as check_type,
    COUNT(*) as count
FROM auth_users

UNION ALL

SELECT 
    'Total auth.users' as check_type,
    COUNT(*) as count
FROM auth.users;