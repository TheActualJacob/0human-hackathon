# Multi-Tenant PropAI Setup Guide

## Overview

This guide will help you set up the multi-tenant authentication system for PropAI, splitting the application into separate landlord and tenant dashboards.

## Prerequisites

1. Frontend server running on http://localhost:3000
2. Access to Supabase Dashboard
3. Backend server (optional - the app works without it)

## Step-by-Step Setup

### 1. Run Database Setup Script

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of:
   ```
   frontend/lib/supabase/complete_setup.sql
   ```
5. Click **Run**
6. You should see success messages including test data creation

### 2. Create Authentication Users

1. In Supabase Dashboard, go to **Authentication > Users**
2. Click **Add user** → **Create new user**
3. Create two users:

   **Landlord Account:**
   - Email: `landlord@test.com`
   - Password: `testpass123`
   - Email confirm: Check "Auto Confirm Email"

   **Tenant Account:**
   - Email: `tenant@test.com`
   - Password: `testpass123`
   - Email confirm: Check "Auto Confirm Email"

4. Note down the User IDs shown after creation (you'll need these)

### 3. Link Auth Accounts to Database

1. Go back to **SQL Editor**
2. Click **New Query**
3. First, run this to find your user IDs:
   ```sql
   SELECT id, email, created_at 
   FROM auth.users 
   WHERE email IN ('landlord@test.com', 'tenant@test.com');
   ```
4. Copy the IDs from the results
5. Open `frontend/lib/supabase/link_auth_accounts.sql`
6. Replace:
   - `YOUR_LANDLORD_AUTH_ID` with the ID for landlord@test.com
   - `YOUR_TENANT_AUTH_ID` with the ID for tenant@test.com
7. Run the modified SQL

### 4. Verify Setup

Run this SQL to verify everything is connected:

```sql
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
LEFT JOIN tenants t ON au.entity_id = t.id AND au.role = 'tenant';
```

You should see both users with their roles and names.

## Testing the Application

### 1. Access the Application

1. Open http://localhost:3000
2. You should see the new landing page

### 2. Test Landlord Login

1. Click **Login** or **I'm a Landlord**
2. Login with:
   - Email: `landlord@test.com`
   - Password: `testpass123`
3. You should be redirected to the landlord dashboard at `/landlord/dashboard`
4. Explore:
   - Properties management
   - Tenant management
   - Maintenance requests
   - Payment tracking

### 3. Test Tenant Login

1. Sign out (user menu in top right)
2. Login with:
   - Email: `tenant@test.com`
   - Password: `testpass123`
3. You should be redirected to the tenant dashboard at `/tenant/dashboard`
4. Explore:
   - Lease details
   - Payment history
   - Maintenance requests
   - Documents

### 4. Test Tenant Signup with Invite Code

1. Sign out
2. Click **I'm a Tenant** on landing page
3. Enter invite code: `TEST1234`
4. The property details should appear
5. Fill in the form to create a new tenant account

## Features Implemented

### For Landlords
- ✅ Dedicated dashboard with property overview
- ✅ Property/unit management
- ✅ Tenant management and invitations
- ✅ Lease creation and tracking
- ✅ Payment monitoring
- ✅ Maintenance request handling
- ✅ Contractor management

### For Tenants
- ✅ Personalized dashboard
- ✅ Lease information display
- ✅ Payment history and due dates
- ✅ Maintenance request submission
- ✅ Document access
- ✅ Profile management

### Security
- ✅ Role-based access control
- ✅ Separate navigation for each role
- ✅ Protected routes with middleware
- ✅ Auth state persistence
- ✅ Secure tenant invitation system

## Troubleshooting

### "Access Denied" Error
- Make sure you're logged in with the correct account type
- Landlords cannot access `/tenant/*` routes
- Tenants cannot access `/landlord/*` routes

### Cannot Login
- Verify the auth accounts were created in Supabase
- Check that the accounts are linked (run the verify query)
- Ensure email confirmation is enabled

### No Data Showing
- Run the complete setup SQL script again
- Check browser console for errors
- Verify Supabase connection in `.env.local`

## Next Steps

1. **Enable Row Level Security (RLS)**
   - Currently disabled for development
   - Enable and configure policies for production

2. **Add More Features**
   - Email notifications
   - Document uploads
   - Payment processing
   - Advanced reporting

3. **Customize UI**
   - Update branding
   - Modify color schemes
   - Add custom features

## Development Notes

- Frontend uses Zustand stores split by role (`/lib/store/`)
- Authentication utilities in `/lib/auth/`
- Middleware handles route protection
- Each role has its own layout component
- Mock data is completely removed - all data from Supabase