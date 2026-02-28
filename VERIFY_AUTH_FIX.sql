-- ============================================================
-- VERIFICATION: Check if the auth fix worked
-- ============================================================

-- 1. Show all landlords with their auth status
SELECT 
    l.id,
    l.full_name,
    l.email,
    l.auth_user_id,
    CASE 
        WHEN l.auth_user_id IS NOT NULL THEN '✅ Linked'
        ELSE '❌ Not Linked'
    END as auth_status,
    au.role as mapped_role,
    au.entity_id as mapped_entity_id
FROM landlords l
LEFT JOIN auth_users au ON au.id = l.auth_user_id;

-- 2. Show all tenants with their auth status
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.auth_user_id,
    CASE 
        WHEN t.auth_user_id IS NOT NULL THEN '✅ Linked'
        ELSE '❌ Not Linked'
    END as auth_status,
    au.role as mapped_role,
    au.entity_id as mapped_entity_id
FROM tenants t
LEFT JOIN auth_users au ON au.id = t.auth_user_id;

-- 3. Summary statistics
SELECT 
    'Total Landlords' as metric,
    COUNT(*) as count
FROM landlords
UNION ALL
SELECT 
    'Landlords with auth_user_id' as metric,
    COUNT(*) as count
FROM landlords
WHERE auth_user_id IS NOT NULL
UNION ALL
SELECT 
    'Total Tenants' as metric,
    COUNT(*) as count
FROM tenants
UNION ALL
SELECT 
    'Tenants with auth_user_id' as metric,
    COUNT(*) as count
FROM tenants
WHERE auth_user_id IS NOT NULL
UNION ALL
SELECT 
    'Total auth_users mappings' as metric,
    COUNT(*) as count
FROM auth_users
UNION ALL
SELECT 
    'Total auth.users' as metric,
    COUNT(*) as count
FROM auth.users;