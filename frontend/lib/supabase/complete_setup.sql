-- ============================================================
-- COMPLETE MULTI-TENANT SETUP FOR PROPAI
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CREATE AUTH SCHEMA
-- ============================================================

-- Create user roles enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('landlord', 'tenant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create auth users mapping table
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    entity_id UUID NOT NULL, -- References either landlords.id or tenants.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add auth_user_id to landlords and tenants if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'landlords' AND column_name = 'auth_user_id') THEN
        ALTER TABLE landlords ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'auth_user_id') THEN
        ALTER TABLE tenants ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_entity ON auth_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_landlords_auth_user ON landlords(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_auth_user ON tenants(auth_user_id);

-- ============================================================
-- 2. CREATE TENANT INVITATION SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
    invite_code VARCHAR(8) UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
    email VARCHAR(255),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for invite lookups
CREATE INDEX IF NOT EXISTS idx_tenant_invites_code ON tenant_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_landlord ON tenant_invites(landlord_id);

-- ============================================================
-- 3. DISABLE RLS FOR DEVELOPMENT
-- (Enable and configure properly for production)
-- ============================================================

ALTER TABLE landlords DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE units DISABLE ROW LEVEL SECURITY;
ALTER TABLE leases DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE contractors DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. CREATE TEST DATA
-- ============================================================

-- Create a test landlord
DO $$ 
DECLARE
    test_landlord_id UUID;
    test_unit_id UUID;
    test_lease_id UUID;
    test_tenant_id UUID;
BEGIN
    -- Check if test data already exists
    IF NOT EXISTS (SELECT 1 FROM landlords WHERE email = 'landlord@test.com') THEN
        
        -- Insert test landlord
        INSERT INTO landlords (id, full_name, email, phone, address, zip_code, whatsapp_number)
        VALUES (
            uuid_generate_v4(),
            'John Landlord',
            'landlord@test.com',
            '+1234567890',
            'Test Property Management LLC',
            '12345',
            '+1234567890'
        ) RETURNING id INTO test_landlord_id;
        
        -- Insert test unit
        INSERT INTO units (id, landlord_id, name, address, unit_type, bedrooms, bathrooms, square_footage, rent_amount)
        VALUES (
            uuid_generate_v4(),
            test_landlord_id,
            'Sunset Apartments Unit 101',
            '123 Main St, Apt 101, Anytown, CA 12345',
            'apartment',
            2,
            1,
            850,
            1500
        ) RETURNING id INTO test_unit_id;
        
        -- Insert test lease
        INSERT INTO leases (id, unit_id, landlord_id, start_date, end_date, rent_amount, security_deposit, status)
        VALUES (
            uuid_generate_v4(),
            test_unit_id,
            test_landlord_id,
            CURRENT_DATE - INTERVAL '6 months',
            CURRENT_DATE + INTERVAL '6 months',
            1500,
            3000,
            'active'
        ) RETURNING id INTO test_lease_id;
        
        -- Insert test tenant
        INSERT INTO tenants (id, lease_id, full_name, email, phone, whatsapp_number, is_primary_tenant)
        VALUES (
            uuid_generate_v4(),
            test_lease_id,
            'Jane Tenant',
            'tenant@test.com',
            '+1987654321',
            '+1987654321',
            true
        ) RETURNING id INTO test_tenant_id;
        
        -- Create payments for the test tenant
        INSERT INTO payments (lease_id, amount_due, due_date, status, payment_date, amount_paid)
        VALUES
        -- Past payments (paid)
        (test_lease_id, 1500, CURRENT_DATE - INTERVAL '5 months', 'paid', CURRENT_DATE - INTERVAL '5 months', 1500),
        (test_lease_id, 1500, CURRENT_DATE - INTERVAL '4 months', 'paid', CURRENT_DATE - INTERVAL '4 months', 1500),
        (test_lease_id, 1500, CURRENT_DATE - INTERVAL '3 months', 'paid', CURRENT_DATE - INTERVAL '3 months', 1500),
        (test_lease_id, 1500, CURRENT_DATE - INTERVAL '2 months', 'paid', CURRENT_DATE - INTERVAL '2 months', 1500),
        (test_lease_id, 1500, CURRENT_DATE - INTERVAL '1 month', 'paid', CURRENT_DATE - INTERVAL '1 month', 1500),
        -- Current month (pending)
        (test_lease_id, 1500, CURRENT_DATE + INTERVAL '5 days', 'pending', NULL, NULL),
        -- Future payments
        (test_lease_id, 1500, CURRENT_DATE + INTERVAL '1 month' + INTERVAL '5 days', 'pending', NULL, NULL);
        
        -- Create some test maintenance requests
        INSERT INTO maintenance_requests (lease_id, description, category, urgency, status, created_at)
        VALUES
        (test_lease_id, 'Kitchen sink is leaking', 'plumbing', 'medium', 'completed', CURRENT_DATE - INTERVAL '2 months'),
        (test_lease_id, 'AC not cooling properly', 'hvac', 'high', 'in_progress', CURRENT_DATE - INTERVAL '3 days'),
        (test_lease_id, 'Bedroom door handle is loose', 'other', 'low', 'open', CURRENT_DATE - INTERVAL '1 day');
        
        -- Create test contractor
        INSERT INTO contractors (landlord_id, name, service_type, phone, email, whatsapp_number, hourly_rate, rating, is_available)
        VALUES
        (test_landlord_id, 'Quick Fix Plumbing', 'plumbing', '+1555123456', 'plumber@quickfix.com', '+1555123456', 75, 4.5, true),
        (test_landlord_id, 'Cool Air HVAC', 'hvac', '+1555789012', 'service@coolair.com', '+1555789012', 85, 4.8, true);
        
        -- Create a tenant invite for testing
        INSERT INTO tenant_invites (landlord_id, lease_id, invite_code)
        VALUES (test_landlord_id, test_lease_id, 'TEST1234');
        
        RAISE NOTICE 'Test data created successfully!';
        RAISE NOTICE 'Test Landlord Email: landlord@test.com';
        RAISE NOTICE 'Test Tenant Email: tenant@test.com';
        RAISE NOTICE 'Test Invite Code: TEST1234';
        RAISE NOTICE 'Use password "testpass123" for testing (you''ll need to create auth accounts manually)';
        
    ELSE
        RAISE NOTICE 'Test data already exists. Skipping creation.';
    END IF;
END $$;

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM auth_users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user entity (landlord or tenant record)
CREATE OR REPLACE FUNCTION get_user_entity(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    user_role_val user_role;
    entity_id_val UUID;
    result JSONB;
BEGIN
    SELECT role, entity_id INTO user_role_val, entity_id_val
    FROM auth_users WHERE id = user_id;
    
    IF user_role_val = 'landlord' THEN
        SELECT to_jsonb(l.*) INTO result
        FROM landlords l WHERE l.id = entity_id_val;
    ELSIF user_role_val = 'tenant' THEN
        SELECT to_jsonb(t.*) INTO result
        FROM tenants t WHERE t.id = entity_id_val;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. CREATE DEMO AUTH ACCOUNTS
-- ============================================================

-- Note: Auth accounts must be created through Supabase Auth
-- This section provides instructions for manual creation

DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SETUP COMPLETE! Next steps:';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. Go to Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Create two users:';
    RAISE NOTICE '   - Email: landlord@test.com, Password: testpass123';
    RAISE NOTICE '   - Email: tenant@test.com, Password: testpass123';
    RAISE NOTICE '';
    RAISE NOTICE '3. After creating users, run this SQL to link them:';
    RAISE NOTICE '';
    RAISE NOTICE '-- Get the auth user IDs first (check Authentication > Users)';
    RAISE NOTICE '-- Then run these with the actual IDs:';
    RAISE NOTICE '';
    RAISE NOTICE '-- For landlord (replace YOUR_LANDLORD_AUTH_ID):';
    RAISE NOTICE 'INSERT INTO auth_users (id, role, entity_id)';
    RAISE NOTICE 'VALUES (''YOUR_LANDLORD_AUTH_ID'', ''landlord'', (SELECT id FROM landlords WHERE email = ''landlord@test.com''));';
    RAISE NOTICE '';
    RAISE NOTICE 'UPDATE landlords SET auth_user_id = ''YOUR_LANDLORD_AUTH_ID''';
    RAISE NOTICE 'WHERE email = ''landlord@test.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '-- For tenant (replace YOUR_TENANT_AUTH_ID):';
    RAISE NOTICE 'INSERT INTO auth_users (id, role, entity_id)';
    RAISE NOTICE 'VALUES (''YOUR_TENANT_AUTH_ID'', ''tenant'', (SELECT id FROM tenants WHERE email = ''tenant@test.com''));';
    RAISE NOTICE '';
    RAISE NOTICE 'UPDATE tenants SET auth_user_id = ''YOUR_TENANT_AUTH_ID''';
    RAISE NOTICE 'WHERE email = ''tenant@test.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
END $$;