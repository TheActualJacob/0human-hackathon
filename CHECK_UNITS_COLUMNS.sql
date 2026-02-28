-- Get the exact columns and their types from the units table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'units'
ORDER BY ordinal_position;

-- Also show a sample insert to see what's required
SELECT * FROM units LIMIT 1;