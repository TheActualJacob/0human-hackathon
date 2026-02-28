-- ============================================================
-- Extended Unit Fields Migration
-- ============================================================

-- Add missing fields to units table
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'apartment' CHECK (unit_type IN ('apartment', 'house', 'studio', 'room')),
ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3,1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS square_footage INTEGER,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to update updated_at
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add furnished_status and pet_policy to unit_attributes
ALTER TABLE unit_attributes
ADD COLUMN IF NOT EXISTS furnished_status TEXT DEFAULT 'unfurnished' CHECK (furnished_status IN ('furnished', 'unfurnished', 'partially_furnished')),
ADD COLUMN IF NOT EXISTS pet_policy TEXT DEFAULT 'case_by_case' CHECK (pet_policy IN ('allowed', 'not_allowed', 'case_by_case'));