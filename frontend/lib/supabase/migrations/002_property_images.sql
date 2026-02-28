-- ============================================================
-- Property Images Migration
-- ============================================================

-- Add images column to units table if it doesn't exist
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Create index for faster queries on listing status and images
CREATE INDEX IF NOT EXISTS idx_units_images ON units USING GIN(images) WHERE listing_status IN ('public', 'private');

-- Update RLS policies to include image management
-- Landlords can update images for their own units (already covered by existing policy)