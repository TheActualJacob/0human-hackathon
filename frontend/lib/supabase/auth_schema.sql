-- ============================================================
-- AUTH SCHEMA FOR MULTI-TENANT PROPAI
-- Run this in Supabase SQL Editor to set up authentication
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('landlord', 'tenant');

-- Create auth users mapping table
CREATE TABLE auth_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role user_role NOT NULL,
    entity_id UUID NOT NULL, -- References either landlords.id or tenants.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add auth_user_id to landlords and tenants
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_auth_users_entity ON auth_users(entity_id);
CREATE INDEX IF NOT EXISTS idx_landlords_auth_user ON landlords(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_auth_user ON tenants(auth_user_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- Auth users policies
CREATE POLICY "Users can view own auth record" ON auth_users
    FOR SELECT USING (auth.uid() = id);

-- Landlord policies
CREATE POLICY "Landlords can view own record" ON landlords
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Landlords can update own record" ON landlords
    FOR UPDATE USING (auth_user_id = auth.uid());

-- Tenant policies
CREATE POLICY "Tenants can view own record" ON tenants
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Tenants can update own record" ON tenants
    FOR UPDATE USING (auth_user_id = auth.uid());

-- Units policies
CREATE POLICY "Landlords can view own units" ON units
    FOR SELECT USING (
        landlord_id IN (
            SELECT id FROM landlords WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Tenants can view their unit" ON units
    FOR SELECT USING (
        id IN (
            SELECT unit_id FROM leases 
            WHERE id IN (
                SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Leases policies
CREATE POLICY "Landlords can view own leases" ON leases
    FOR SELECT USING (
        landlord_id IN (
            SELECT id FROM landlords WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Tenants can view own lease" ON leases
    FOR SELECT USING (
        id IN (
            SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
        )
    );

-- Payments policies
CREATE POLICY "Landlords can view payments for their properties" ON payments
    FOR SELECT USING (
        lease_id IN (
            SELECT id FROM leases 
            WHERE landlord_id IN (
                SELECT id FROM landlords WHERE auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Tenants can view own payments" ON payments
    FOR SELECT USING (
        lease_id IN (
            SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
        )
    );

-- Maintenance requests policies
CREATE POLICY "Landlords can view maintenance for their properties" ON maintenance_requests
    FOR SELECT USING (
        lease_id IN (
            SELECT id FROM leases 
            WHERE landlord_id IN (
                SELECT id FROM landlords WHERE auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Tenants can view own maintenance requests" ON maintenance_requests
    FOR SELECT USING (
        lease_id IN (
            SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Tenants can create maintenance requests" ON maintenance_requests
    FOR INSERT WITH CHECK (
        lease_id IN (
            SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
        )
    );

-- Maintenance workflows policies
CREATE POLICY "Landlords can view workflows for their properties" ON maintenance_workflows
    FOR SELECT USING (
        maintenance_request_id IN (
            SELECT id FROM maintenance_requests 
            WHERE lease_id IN (
                SELECT id FROM leases 
                WHERE landlord_id IN (
                    SELECT id FROM landlords WHERE auth_user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Tenants can view workflows for their requests" ON maintenance_workflows
    FOR SELECT USING (
        maintenance_request_id IN (
            SELECT id FROM maintenance_requests 
            WHERE lease_id IN (
                SELECT lease_id FROM tenants WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Contractors policies (landlords only)
CREATE POLICY "Landlords can view own contractors" ON contractors
    FOR ALL USING (
        landlord_id IN (
            SELECT id FROM landlords WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- TENANT INVITATION SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID REFERENCES landlords(id),
    lease_id UUID REFERENCES leases(id),
    invite_code VARCHAR(8) UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
    email VARCHAR(255),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on invites
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;

-- Invite policies
CREATE POLICY "Landlords can manage own invites" ON tenant_invites
    FOR ALL USING (
        landlord_id IN (
            SELECT id FROM landlords WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view invite by code" ON tenant_invites
    FOR SELECT USING (true);

-- ============================================================
-- HELPER FUNCTIONS
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
-- TRIGGERS
-- ============================================================

-- Trigger to create auth_users entry after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be populated by the signup process
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Auth schema created successfully! Next steps:';
  RAISE NOTICE '1. Enable Email Auth in Supabase Dashboard > Authentication > Providers';
  RAISE NOTICE '2. Configure email templates in Authentication > Email Templates';
  RAISE NOTICE '3. Set up redirect URLs in Authentication > URL Configuration';
END $$;