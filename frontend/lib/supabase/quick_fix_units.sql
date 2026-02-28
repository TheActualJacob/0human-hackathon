-- Quick fix to add essential missing columns to units table

-- Add images column
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Add other missing columns with safe defaults
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'apartment',
ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3,1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS square_footage INTEGER,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to unit_attributes
ALTER TABLE unit_attributes
ADD COLUMN IF NOT EXISTS furnished_status TEXT DEFAULT 'unfurnished',
ADD COLUMN IF NOT EXISTS pet_policy TEXT DEFAULT 'case_by_case';

-- Verify columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'units' 
AND column_name IN ('images', 'unit_type', 'bedrooms', 'bathrooms', 'square_footage', 'postcode', 'updated_at');