# Quick Authentication Setup

## Current Login Issue

The login page isn't redirecting because:
1. Supabase Auth is not configured with any users
2. The `auth_users` mapping table doesn't exist in your database
3. The authentication flow requires actual Supabase Auth accounts

## Temporary Solution (Already Implemented)

You can now login with these demo credentials:

### Landlord Account:
- Email: `landlord@test.com`
- Password: `testpass`

### Tenant Account:
- Email: `tenant@test.com`  
- Password: `testpass`

## To Set Up Real Authentication

### Step 1: Enable Authentication in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Ensure **Email** provider is enabled

### Step 2: Create the Auth Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Create auth mapping table
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role TEXT CHECK (role IN ('landlord', 'tenant')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add auth columns to existing tables
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auth_user_id UUID;
```

### Step 3: Create Test Users

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Invite user**
3. Create two users:
   - `landlord@test.com` with a secure password
   - `tenant@test.com` with a secure password

### Step 4: Link Users to Entities

After creating the auth users, run this SQL to link them:

```sql
-- First, get the IDs of your auth users
SELECT id, email FROM auth.users;

-- Then link them (replace the UUIDs with actual values)
INSERT INTO auth_users (id, role, entity_id) VALUES
  ('auth-user-id-for-landlord', 'landlord', (SELECT id FROM landlords LIMIT 1)),
  ('auth-user-id-for-tenant', 'tenant', (SELECT id FROM tenants LIMIT 1));
```

## Current Demo Mode

The application currently works in "demo mode":
- Authentication is bypassed for the test accounts
- All data is visible without proper filtering
- This allows you to explore both dashboards immediately

Once you set up proper authentication, the app will:
- Filter data based on the logged-in user
- Enforce proper access control
- Support real user registration