-- ============================================================
-- AUTHENTICATION & ROLE MAPPING
-- ============================================================

-- Create auth_users table to map Supabase Auth users to roles and entities
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('landlord', 'tenant')),
    entity_id UUID NOT NULL, -- References either landlords.id or tenants.id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_users
CREATE POLICY "Users can view their own auth mapping"
    ON auth_users FOR SELECT
    USING (auth.uid() = id);

-- ============================================================
-- TENANT INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    email TEXT, -- Optional: restrict to specific email
    invite_code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_invites
CREATE POLICY "Landlords can manage invites for their leases"
    ON tenant_invites FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN units u ON l.unit_id = u.id
            JOIN auth_users au ON u.landlord_id = au.entity_id
            WHERE l.id = tenant_invites.lease_id AND au.id = auth.uid()
        )
    );

CREATE POLICY "Anyone with a code can view an invite"
    ON tenant_invites FOR SELECT
    USING (used_at IS NULL AND expires_at > NOW());

-- ============================================================
-- UPDATE EXISTING TABLES FOR AUTH
-- ============================================================

-- Add auth_user_id to landlords if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='landlords' AND column_name='auth_user_id') THEN
        ALTER TABLE landlords ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add auth_user_id to tenants if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='auth_user_id') THEN
        ALTER TABLE tenants ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- RLS POLICIES FOR CORE TABLES
-- ============================================================

-- Landlords
CREATE POLICY "Landlords can view their own profile"
    ON landlords FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Landlords can update their own profile"
    ON landlords FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- Units
CREATE POLICY "Landlords can manage their own units"
    ON units FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth_users au
            WHERE au.id = auth.uid() AND au.role = 'landlord' AND au.entity_id = units.landlord_id
        )
    );

CREATE POLICY "Tenants can view their own unit"
    ON units FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN tenants t ON l.id = t.lease_id
            WHERE l.unit_id = units.id AND t.auth_user_id = auth.uid()
        )
    );

-- Leases
CREATE POLICY "Landlords can manage leases for their units"
    ON leases FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM units u
            JOIN auth_users au ON u.landlord_id = au.entity_id
            WHERE u.id = leases.unit_id AND au.id = auth.uid()
        )
    );

CREATE POLICY "Tenants can view their own lease"
    ON leases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.lease_id = leases.id AND t.auth_user_id = auth.uid()
        )
    );

-- Tenants
CREATE POLICY "Landlords can view tenants in their units"
    ON tenants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN units u ON l.unit_id = u.id
            JOIN auth_users au ON u.landlord_id = au.entity_id
            WHERE l.id = tenants.lease_id AND au.id = auth.uid()
        )
    );

CREATE POLICY "Tenants can view their own profile"
    ON tenants FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Maintenance Requests
CREATE POLICY "Landlords can manage maintenance for their units"
    ON maintenance_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN units u ON l.unit_id = u.id
            JOIN auth_users au ON u.landlord_id = au.entity_id
            WHERE l.id = maintenance_requests.lease_id AND au.id = auth.uid()
        )
    );

CREATE POLICY "Tenants can manage their own maintenance requests"
    ON maintenance_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.lease_id = maintenance_requests.lease_id AND t.auth_user_id = auth.uid()
        )
    );
