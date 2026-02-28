-- ============================================================
-- COMPLETE SETUP FOR AI MAINTENANCE SYSTEM
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing workflow tables if they exist
DROP TABLE IF EXISTS vendor_bids CASCADE;
DROP TABLE IF EXISTS workflow_communications CASCADE;
DROP TABLE IF EXISTS maintenance_workflows CASCADE;

-- ============================================================
-- CREATE WORKFLOW TABLES
-- ============================================================

-- Create maintenance workflows table
CREATE TABLE maintenance_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_request_id UUID NOT NULL,
    current_state TEXT NOT NULL DEFAULT 'SUBMITTED',
    ai_analysis JSONB NOT NULL DEFAULT '{}',
    owner_response TEXT,
    owner_message TEXT,
    vendor_message TEXT,
    vendor_eta TIMESTAMPTZ,
    vendor_notes TEXT,
    tenant_satisfaction INTEGER,
    resolution_notes TEXT,
    state_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workflow communications table
CREATE TABLE workflow_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES maintenance_workflows(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    sender_id UUID,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendor bids table
CREATE TABLE vendor_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES maintenance_workflows(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL,
    estimated_cost DECIMAL(10, 2),
    proposed_eta TIMESTAMPTZ,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workflows_state ON maintenance_workflows(current_state);
CREATE INDEX idx_workflows_request ON maintenance_workflows(maintenance_request_id);
CREATE INDEX idx_communications_workflow ON workflow_communications(workflow_id);
CREATE INDEX idx_bids_workflow ON vendor_bids(workflow_id);

-- Disable RLS for now (enable with proper policies in production)
ALTER TABLE maintenance_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bids DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE SAMPLE WORKFLOWS FROM EXISTING MAINTENANCE REQUESTS
-- ============================================================

-- Create workflows for existing maintenance requests
INSERT INTO maintenance_workflows (
    id,
    maintenance_request_id,
    current_state,
    ai_analysis,
    created_at
)
SELECT 
    uuid_generate_v4(),
    id,
    CASE 
        WHEN status = 'open' THEN 'OWNER_NOTIFIED'
        WHEN status = 'in_progress' THEN 'IN_PROGRESS'
        WHEN status = 'resolved' THEN 'COMPLETED'
        ELSE 'SUBMITTED'
    END,
    jsonb_build_object(
        'category', category,
        'urgency', urgency,
        'vendor_required', true,
        'estimated_cost_range', 'medium',
        'reasoning', 'Requires professional attention',
        'confidence_score', 0.85
    ),
    created_at
FROM maintenance_requests
WHERE NOT EXISTS (
    SELECT 1 FROM maintenance_workflows mw 
    WHERE mw.maintenance_request_id = maintenance_requests.id
);

-- Add sample communications for each workflow
INSERT INTO workflow_communications (workflow_id, sender_type, sender_name, message)
SELECT 
    mw.id,
    'system',
    'AI System',
    'Maintenance request received and analyzed. Category: ' || 
    (mw.ai_analysis->>'category')::text || 
    ', Urgency: ' || 
    (mw.ai_analysis->>'urgency')::text
FROM maintenance_workflows mw;

-- Add owner notification for workflows in OWNER_NOTIFIED state
INSERT INTO workflow_communications (workflow_id, sender_type, sender_name, message)
SELECT 
    mw.id,
    'system',
    'AI System',
    'Property owner has been notified and will review this request.'
FROM maintenance_workflows mw
WHERE mw.current_state IN ('OWNER_NOTIFIED', 'IN_PROGRESS', 'COMPLETED');

-- ============================================================
-- VERIFY SETUP
-- ============================================================

-- Show results
SELECT 
    'Maintenance Workflows Created' as status,
    COUNT(*) as count
FROM maintenance_workflows

UNION ALL

SELECT 
    'Communications Created' as status,
    COUNT(*) as count
FROM workflow_communications

UNION ALL

SELECT 
    'Existing Maintenance Requests' as status,
    COUNT(*) as count
FROM maintenance_requests;