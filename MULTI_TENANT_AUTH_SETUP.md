# Multi-Tenant Authentication Setup Guide

## Quick Setup for Testing

### Step 1: Run the Auth Setup SQL Script

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `/frontend/lib/supabase/complete_setup.sql`
4. Click "Run"

### Step 2: Create Test Users Manually (Quick Method)

Since we need to test immediately, here's the quickest way to set up test accounts:

1. **Create Test Landlord:**
   - Email: `landlord@test.com`
   - Password: `testpass123`

2. **Create Test Tenant:**
   - Email: `tenant@test.com`
   - Password: `testpass123`

### Step 3: Link Test Accounts

After creating the users in Supabase Auth, run the linking script in SQL Editor to connect them to the existing data.

## Why Sign-In Isn't Working

The sign-in isn't working because:

1. **Missing auth_users table**: The mapping between Supabase Auth and our landlords/tenants tables doesn't exist
2. **No test auth accounts**: We need actual Supabase Auth accounts, not just database records
3. **Middleware issues**: The middleware is trying to check roles that don't exist yet

## Current State

- ✅ Landing page created
- ✅ Login/Signup pages created  
- ✅ Role-based routing structure
- ❌ Auth database schema not set up
- ❌ No test auth accounts
- ❌ Middleware not properly configured