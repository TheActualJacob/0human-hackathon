-- ============================================================
-- MUST RUN THIS IN SUPABASE SQL EDITOR
-- Adds all marketplace columns to the units table
-- ============================================================

-- Step 1: Add all new columns to units table
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS unit_type       TEXT DEFAULT 'apartment',
ADD COLUMN IF NOT EXISTS bedrooms        INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bathrooms       NUMERIC(3,1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS square_footage  INTEGER,
ADD COLUMN IF NOT EXISTS postcode        TEXT,
ADD COLUMN IF NOT EXISTS listing_status  TEXT DEFAULT 'not_listed' CHECK (listing_status IN ('not_listed', 'public', 'private')),
ADD COLUMN IF NOT EXISTS listing_description TEXT,
ADD COLUMN IF NOT EXISTS listing_created_at  TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS listing_expires_at  TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rent_amount         DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS security_deposit    DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS available_date      DATE,
ADD COLUMN IF NOT EXISTS images              TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Add columns to unit_attributes
ALTER TABLE unit_attributes
ADD COLUMN IF NOT EXISTS furnished_status TEXT DEFAULT 'unfurnished',
ADD COLUMN IF NOT EXISTS pet_policy       TEXT DEFAULT 'case_by_case';

-- Step 3: Create property_applications table
CREATE TABLE IF NOT EXISTS property_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    applicant_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT CHECK (status IN ('pending', 'ai_screening', 'under_review', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
    ai_screening_result JSONB,
    ai_screening_score DECIMAL(3,2),
    landlord_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create property_invites table
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

-- Step 5: Enable RLS on new tables
ALTER TABLE property_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_invites ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for property_applications
DROP POLICY IF EXISTS "Authenticated users can submit applications" ON property_applications;
CREATE POLICY "Authenticated users can submit applications" ON property_applications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Applicants can view own applications" ON property_applications;
CREATE POLICY "Applicants can view own applications" ON property_applications
FOR SELECT USING (
    (applicant_data->>'email' = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR
    (tenant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM auth_users WHERE auth_users.id = auth.uid() AND auth_users.entity_id = property_applications.tenant_id
    ))
);

DROP POLICY IF EXISTS "Landlords can view unit applications" ON property_applications;
CREATE POLICY "Landlords can view unit applications" ON property_applications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM units 
        JOIN auth_users ON auth_users.entity_id = units.landlord_id
        WHERE units.id = property_applications.unit_id 
        AND auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord'
    )
);

DROP POLICY IF EXISTS "Landlords can update unit applications" ON property_applications;
CREATE POLICY "Landlords can update unit applications" ON property_applications
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM units 
        JOIN auth_users ON auth_users.entity_id = units.landlord_id
        WHERE units.id = property_applications.unit_id 
        AND auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord'
    )
);

-- Step 7: RLS Policies for property_invites
DROP POLICY IF EXISTS "Landlords can manage own invites" ON property_invites;
CREATE POLICY "Landlords can manage own invites" ON property_invites
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM auth_users 
        WHERE auth_users.id = auth.uid() 
        AND auth_users.role = 'landlord' 
        AND auth_users.entity_id = property_invites.landlord_id
    )
);

DROP POLICY IF EXISTS "Public can view invites by token" ON property_invites;
CREATE POLICY "Public can view invites by token" ON property_invites
FOR SELECT USING (true);

-- Step 8: Allow public to read public listings on units
DROP POLICY IF EXISTS "Public can view public listings" ON units;
CREATE POLICY "Public can view public listings" ON units
FOR SELECT USING (listing_status = 'public' OR listing_status = 'private');

-- Step 9: Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_applications_updated_at ON property_applications;
CREATE TRIGGER update_property_applications_updated_at BEFORE UPDATE ON property_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'units' ORDER BY ordinal_position;