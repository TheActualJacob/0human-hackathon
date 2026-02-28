-- ============================================================
-- VERIFY AND FIX RLS POLICIES
-- Run this to ensure the tables can be accessed
-- ============================================================

-- Drop existing RLS policies if any
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON maintenance_workflows;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON workflow_communications;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON vendor_bids;

-- Create permissive policies for development
-- NOTE: In production, you should create more restrictive policies

-- Maintenance Workflows - Allow all operations for authenticated users
CREATE POLICY "Enable read access for all users" ON maintenance_workflows
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON maintenance_workflows
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON maintenance_workflows
    FOR UPDATE USING (true);

-- Workflow Communications - Allow all operations for authenticated users
CREATE POLICY "Enable read access for all users" ON workflow_communications
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON workflow_communications
    FOR INSERT WITH CHECK (true);

-- Vendor Bids - Allow all operations for authenticated users
CREATE POLICY "Enable read access for all users" ON vendor_bids
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON vendor_bids
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON vendor_bids
    FOR UPDATE USING (true);

-- Also check if tables exist and have proper structure
SELECT 
    'maintenance_workflows' as table_name,
    COUNT(*) as row_count,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'maintenance_workflows'
    ) as exists
UNION ALL
SELECT 
    'workflow_communications' as table_name,
    COUNT(*) as row_count,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'workflow_communications'
    ) as exists
FROM workflow_communications
UNION ALL
SELECT 
    'vendor_bids' as table_name,
    COUNT(*) as row_count,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'vendor_bids'
    ) as exists
FROM vendor_bids;