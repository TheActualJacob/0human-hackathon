-- ============================================================
-- Fix Units Table - Add Missing Columns
-- ============================================================

-- First, check what columns already exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'units'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add images column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'images') THEN
        ALTER TABLE units ADD COLUMN images TEXT[] DEFAULT '{}';
    END IF;
    
    -- Add unit_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'unit_type') THEN
        ALTER TABLE units ADD COLUMN unit_type TEXT DEFAULT 'apartment' CHECK (unit_type IN ('apartment', 'house', 'studio', 'room'));
    END IF;
    
    -- Add bedrooms column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'bedrooms') THEN
        ALTER TABLE units ADD COLUMN bedrooms INTEGER DEFAULT 1;
    END IF;
    
    -- Add bathrooms column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'bathrooms') THEN
        ALTER TABLE units ADD COLUMN bathrooms NUMERIC(3,1) DEFAULT 1;
    END IF;
    
    -- Add square_footage column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'square_footage') THEN
        ALTER TABLE units ADD COLUMN square_footage INTEGER;
    END IF;
    
    -- Add postcode column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'postcode') THEN
        ALTER TABLE units ADD COLUMN postcode TEXT;
    END IF;
    
    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'updated_at') THEN
        ALTER TABLE units ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Check unit_attributes table columns
DO $$ 
BEGIN
    -- Add furnished_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit_attributes' AND column_name = 'furnished_status') THEN
        ALTER TABLE unit_attributes ADD COLUMN furnished_status TEXT DEFAULT 'unfurnished' CHECK (furnished_status IN ('furnished', 'unfurnished', 'partially_furnished'));
    END IF;
    
    -- Add pet_policy column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit_attributes' AND column_name = 'pet_policy') THEN
        ALTER TABLE unit_attributes ADD COLUMN pet_policy TEXT DEFAULT 'case_by_case' CHECK (pet_policy IN ('allowed', 'not_allowed', 'case_by_case'));
    END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_units_updated_at') THEN
        CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'units'
AND column_name IN ('images', 'unit_type', 'bedrooms', 'bathrooms', 'square_footage', 'postcode', 'updated_at')
ORDER BY column_name;