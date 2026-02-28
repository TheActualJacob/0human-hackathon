-- ============================================================
-- CRITICAL FIX: Ensure landlords table has auth_user_id column
-- and properly link existing records
-- ============================================================

-- Step 1: Add auth_user_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='landlords' AND column_name='auth_user_id') THEN
        ALTER TABLE landlords ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Step 2: Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_landlords_auth_user_id ON landlords(auth_user_id);

-- Step 3: Update any existing landlord records to link with auth_users table
UPDATE landlords l
SET auth_user_id = au.id
FROM auth_users au
WHERE l.id = au.entity_id
AND au.role = 'landlord'
AND l.auth_user_id IS NULL;

-- Step 4: For any landlords still without auth_user_id, try to match by email
UPDATE landlords l
SET auth_user_id = u.id
FROM auth.users u
WHERE l.email = u.email
AND l.auth_user_id IS NULL;

-- Step 5: Show the current state
SELECT 
    l.id as landlord_id,
    l.full_name,
    l.email,
    l.auth_user_id,
    au.id as auth_users_id,
    au.role
FROM landlords l
LEFT JOIN auth_users au ON au.entity_id = l.id
ORDER BY l.created_at DESC;