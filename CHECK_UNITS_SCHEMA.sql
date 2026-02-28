-- Check the units table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'units'
ORDER BY ordinal_position;