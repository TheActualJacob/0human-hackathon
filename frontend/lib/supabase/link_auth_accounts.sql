-- ============================================================
-- LINK AUTH ACCOUNTS
-- Run this after creating auth users in Supabase Dashboard
-- ============================================================

-- STEP 1: First, find your auth user IDs by running this query:
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('landlord@test.com', 'tenant@test.com');

-- STEP 2: Copy the IDs from above and paste them in the queries below

-- ============================================================
-- LINK LANDLORD ACCOUNT
-- Replace 'YOUR_LANDLORD_AUTH_ID' with actual ID from step 1
-- ============================================================

-- Example: If landlord auth ID is 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
-- Then replace 'YOUR_LANDLORD_AUTH_ID' with 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

INSERT INTO auth_users (id, role, entity_id)
VALUES (
    'YOUR_LANDLORD_AUTH_ID', 
    'landlord', 
    (SELECT id FROM landlords WHERE email = 'landlord@test.com')
);

UPDATE landlords 
SET auth_user_id = 'YOUR_LANDLORD_AUTH_ID'
WHERE email = 'landlord@test.com';

-- ============================================================
-- LINK TENANT ACCOUNT
-- Replace 'YOUR_TENANT_AUTH_ID' with actual ID from step 1
-- ============================================================

-- Example: If tenant auth ID is '550e8400-e29b-41d4-a716-446655440000'
-- Then replace 'YOUR_TENANT_AUTH_ID' with '550e8400-e29b-41d4-a716-446655440000'

INSERT INTO auth_users (id, role, entity_id)
VALUES (
    'YOUR_TENANT_AUTH_ID', 
    'tenant', 
    (SELECT id FROM tenants WHERE email = 'tenant@test.com')
);

UPDATE tenants 
SET auth_user_id = 'YOUR_TENANT_AUTH_ID'
WHERE email = 'tenant@test.com';

-- ============================================================
-- VERIFY THE SETUP
-- ============================================================

-- Check if everything is linked correctly:
SELECT 
    au.id as auth_id,
    au.role,
    CASE 
        WHEN au.role = 'landlord' THEN l.full_name
        WHEN au.role = 'tenant' THEN t.full_name
    END as name,
    CASE 
        WHEN au.role = 'landlord' THEN l.email
        WHEN au.role = 'tenant' THEN t.email
    END as email
FROM auth_users au
LEFT JOIN landlords l ON au.entity_id = l.id AND au.role = 'landlord'
LEFT JOIN tenants t ON au.entity_id = t.id AND au.role = 'tenant'
WHERE au.id IN (
    SELECT id FROM auth.users WHERE email IN ('landlord@test.com', 'tenant@test.com')
);