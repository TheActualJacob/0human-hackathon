-- ============================================================
-- FINAL FIX: Link your authenticated user to your landlord record
-- ============================================================

-- First, let's see your current auth user
SELECT id, email FROM auth.users WHERE email = 'manolisgeo00@gmail.com';

-- Update your landlord record with your auth user ID
UPDATE landlords 
SET auth_user_id = (SELECT id FROM auth.users WHERE email = 'manolisgeo00@gmail.com')
WHERE email = 'manolisgeo00@gmail.com';

-- Verify the update worked
SELECT 
    l.id as landlord_id,
    l.full_name,
    l.email,
    l.auth_user_id,
    u.id as auth_user_id_check,
    u.email as auth_email
FROM landlords l
LEFT JOIN auth.users u ON u.id = l.auth_user_id
WHERE l.email = 'manolisgeo00@gmail.com';

-- Also ensure the auth_users mapping exists
INSERT INTO auth_users (id, role, entity_id)
SELECT 
    u.id,
    'landlord',
    l.id
FROM auth.users u
JOIN landlords l ON l.email = u.email
WHERE u.email = 'manolisgeo00@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'landlord',
    entity_id = EXCLUDED.entity_id;

-- Final verification
SELECT * FROM auth_users WHERE id = (SELECT id FROM auth.users WHERE email = 'manolisgeo00@gmail.com');