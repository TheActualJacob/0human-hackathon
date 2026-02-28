-- ============================================================
-- AI Maintenance Workflow Schema Extensions
-- ============================================================

-- ============================================================
-- MAINTENANCE WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_request_id UUID NOT NULL UNIQUE REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    current_state TEXT NOT NULL CHECK (current_state IN (
        'SUBMITTED', 
        'OWNER_NOTIFIED', 
        'OWNER_RESPONDED', 
        'DECISION_MADE', 
        'VENDOR_CONTACTED', 
        'AWAITING_VENDOR_RESPONSE',
        'ETA_CONFIRMED', 
        'TENANT_NOTIFIED', 
        'IN_PROGRESS',
        'COMPLETED', 
        'CLOSED_DENIED'
    )) DEFAULT 'SUBMITTED',
    ai_analysis JSONB NOT NULL DEFAULT '{}', -- Claude's structured analysis
    owner_response TEXT CHECK (owner_response IN ('approved', 'denied', 'question')),
    owner_response_message TEXT,
    vendor_message TEXT, -- AI-generated outreach message
    vendor_eta TIMESTAMPTZ,
    vendor_notes TEXT,
    state_history JSONB DEFAULT '[]', -- Array of {state, timestamp, metadata}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKFLOW COMMUNICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES maintenance_workflows(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('tenant', 'owner', 'vendor', 'system')),
    sender_id UUID,
    sender_name TEXT,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Additional data like attachments, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VENDOR BIDS (for dynamic bidding system)
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES maintenance_workflows(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    bid_amount NUMERIC NOT NULL,
    estimated_completion_time INT, -- hours
    message TEXT,
    is_selected BOOLEAN DEFAULT FALSE,
    ai_score NUMERIC, -- AI evaluation score 0-100
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_maintenance_workflows_request_id ON maintenance_workflows(maintenance_request_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_workflows_state ON maintenance_workflows(current_state);
CREATE INDEX IF NOT EXISTS idx_workflow_communications_workflow_id ON workflow_communications(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_communications_created ON workflow_communications(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_bids_workflow_id ON vendor_bids(workflow_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bids_contractor_id ON vendor_bids(contractor_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE maintenance_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bids ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGERS for automatic updates
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maintenance_workflows_updated_at 
    BEFORE UPDATE ON maintenance_workflows 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to append state history
CREATE OR REPLACE FUNCTION append_state_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_state IS DISTINCT FROM NEW.current_state THEN
        NEW.state_history = NEW.state_history || jsonb_build_object(
            'from_state', OLD.current_state,
            'to_state', NEW.current_state,
            'timestamp', CURRENT_TIMESTAMP,
            'metadata', COALESCE(NEW.state_history->'metadata', '{}'::jsonb)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_state_transitions 
    BEFORE UPDATE ON maintenance_workflows 
    FOR EACH ROW 
    EXECUTE FUNCTION append_state_history();

-- ============================================================
-- END
-- ============================================================