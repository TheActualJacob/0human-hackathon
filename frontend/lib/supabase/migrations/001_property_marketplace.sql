-- ============================================================
-- Property Marketplace Migration
-- ============================================================

-- Add new columns to units table for property listings
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS listing_status TEXT CHECK (listing_status IN ('not_listed', 'public', 'private')) DEFAULT 'not_listed',
ADD COLUMN IF NOT EXISTS listing_description TEXT,
ADD COLUMN IF NOT EXISTS listing_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS listing_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rent_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS security_deposit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS available_date DATE;

-- Create property applications table
CREATE TABLE IF NOT EXISTS property_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    applicant_data JSONB NOT NULL, -- Store application data before tenant record exists
    status TEXT CHECK (status IN ('pending', 'ai_screening', 'under_review', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
    ai_screening_result JSONB,
    ai_screening_score DECIMAL(3,2), -- 0.00 to 1.00
    landlord_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create property invites table (replaces tenant_invites)
CREATE TABLE IF NOT EXISTS property_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    message TEXT,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update tenants table to allow tenants without active lease
-- First, we need to handle existing data by ensuring all tenants have a lease_id
-- Then we can make lease_id nullable
ALTER TABLE tenants 
ALTER COLUMN lease_id DROP NOT NULL;

-- Add profile_data column to store tenant profile information
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_units_listing_status ON units(listing_status) WHERE listing_status = 'public';
CREATE INDEX IF NOT EXISTS idx_units_available_date ON units(available_date) WHERE listing_status = 'public';
CREATE INDEX IF NOT EXISTS idx_units_rent_amount ON units(rent_amount) WHERE listing_status = 'public';
CREATE INDEX IF NOT EXISTS idx_property_applications_unit ON property_applications(unit_id);
CREATE INDEX IF NOT EXISTS idx_property_applications_status ON property_applications(status);
CREATE INDEX IF NOT EXISTS idx_property_invites_token ON property_invites(token);
CREATE INDEX IF NOT EXISTS idx_property_invites_email ON property_invites(email);

-- Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE property_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_invites ENABLE ROW LEVEL SECURITY;

-- Units table - allow public to view public listings
CREATE POLICY "Public can view public listings" ON units
FOR SELECT 
USING (listing_status = 'public');

-- Units table - landlords can view and manage their own units
CREATE POLICY "Landlords can manage own units" ON units
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM auth_users 
        WHERE auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord' 
        AND auth_users.entity_id = units.landlord_id
    )
);

-- Property applications - authenticated users can submit applications
CREATE POLICY "Authenticated users can submit applications" ON property_applications
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Property applications - applicants can view their own applications
CREATE POLICY "Applicants can view own applications" ON property_applications
FOR SELECT 
USING (
    -- If they have a tenant_id, match it
    (tenant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM auth_users 
        WHERE auth_users.id = auth.uid() 
        AND auth_users.entity_id = property_applications.tenant_id
    ))
    OR
    -- Otherwise match by email in applicant_data
    (applicant_data->>'email' = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Property applications - landlords can view applications for their units
CREATE POLICY "Landlords can view unit applications" ON property_applications
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM units 
        JOIN auth_users ON auth_users.entity_id = units.landlord_id
        WHERE units.id = property_applications.unit_id 
        AND auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord'
    )
);

-- Property applications - landlords can update applications for their units
CREATE POLICY "Landlords can update unit applications" ON property_applications
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM units 
        JOIN auth_users ON auth_users.entity_id = units.landlord_id
        WHERE units.id = property_applications.unit_id 
        AND auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord'
    )
);

-- Property invites - landlords can manage their own invites
CREATE POLICY "Landlords can manage own invites" ON property_invites
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM auth_users 
        WHERE auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord' 
        AND auth_users.entity_id = property_invites.landlord_id
    )
);

-- Property invites - anyone can view invite by token (for accepting invites)
CREATE POLICY "Public can view invites by token" ON property_invites
FOR SELECT 
USING (true); -- Token validation will be done in application logic

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_property_applications_updated_at BEFORE UPDATE ON property_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();