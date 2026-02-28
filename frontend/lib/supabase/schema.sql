-- ============================================================
-- AI Property Manager – Supabase Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LANDLORDS
-- ============================================================
CREATE TABLE landlords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    whatsapp_number TEXT,
    notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": true, "digest_frequency": "daily"}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LANDLORD NOTIFICATIONS
-- ============================================================
CREATE TABLE landlord_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    lease_id UUID, -- FK added after leases table
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'emergency_maintenance', 'legal_notice_issued', 'eviction_started',
        'tenant_vacated', 'dispute_ruled', 'rent_overdue', 'compliance_expiry',
        'payment_received', 'general', 'signature_required'
    )),
    message TEXT NOT NULL,
    related_record_type TEXT,
    related_record_id UUID,
    requires_signature BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNITS
-- ============================================================
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    unit_identifier TEXT NOT NULL, -- e.g. "Flat 3", "Unit B", "12 Oak Street"
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'GB',
    jurisdiction TEXT NOT NULL DEFAULT 'england_wales', -- for legal logic
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNIT ATTRIBUTES
-- ============================================================
CREATE TABLE unit_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
    -- Layout
    square_footage NUMERIC,
    bedrooms INT,
    bathrooms INT,
    has_ensuite BOOLEAN DEFAULT FALSE,
    floor_level INT,
    -- Furnishing
    furnished_status TEXT CHECK (furnished_status IN ('unfurnished', 'part_furnished', 'fully_furnished')),
    furnishing_notes TEXT,
    -- Heating
    heating_type TEXT CHECK (heating_type IN ('gas_central', 'electric', 'underfloor', 'other')),
    boiler_location TEXT,
    boiler_model TEXT,
    boiler_last_serviced DATE,
    -- Features
    has_dishwasher BOOLEAN DEFAULT FALSE,
    has_washing_machine BOOLEAN DEFAULT FALSE,
    has_dryer BOOLEAN DEFAULT FALSE,
    has_ac BOOLEAN DEFAULT FALSE,
    has_garden_access BOOLEAN DEFAULT FALSE,
    has_balcony BOOLEAN DEFAULT FALSE,
    has_parking BOOLEAN DEFAULT FALSE,
    has_lift BOOLEAN DEFAULT FALSE,
    -- Utilities
    gas_provider TEXT,
    electricity_provider TEXT,
    water_provider TEXT,
    broadband_provider TEXT,
    meter_locations TEXT,
    -- Access
    door_code TEXT,
    key_fob_number TEXT,
    key_safe_code TEXT,
    spare_key_location TEXT,
    -- Building
    bin_collection_day TEXT,
    bin_collection_notes TEXT,
    building_manager_contact TEXT,
    -- Insurance
    buildings_insurance_provider TEXT,
    insurance_policy_number TEXT,
    insurance_renewal_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNIT APPLIANCES
-- ============================================================
CREATE TABLE unit_appliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    appliance_type TEXT NOT NULL, -- boiler, oven, fridge, washing_machine, etc.
    make TEXT,
    model TEXT,
    serial_number TEXT,
    install_date DATE,
    warranty_expiry DATE,
    last_serviced_at DATE,
    condition TEXT CHECK (condition IN ('good', 'fair', 'poor', 'faulty')) DEFAULT 'good',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNIT STATUS (live snapshot – one row per unit)
-- ============================================================
CREATE TABLE unit_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
    occupancy_status TEXT CHECK (occupancy_status IN (
        'occupied', 'vacant', 'notice_given', 'between_tenancies', 'under_refurb'
    )) DEFAULT 'vacant',
    condition_rating INT CHECK (condition_rating BETWEEN 1 AND 5),
    condition_notes TEXT,
    has_open_maintenance BOOLEAN DEFAULT FALSE,
    open_maintenance_count INT DEFAULT 0,
    has_chronic_issue BOOLEAN DEFAULT FALSE,
    chronic_issue_count INT DEFAULT 0,
    meter_reading_electric NUMERIC,
    meter_reading_gas NUMERIC,
    meter_reading_date DATE,
    move_in_date DATE,
    expected_move_out_date DATE,
    actual_move_out_date DATE,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UNIT DOCUMENTS (compliance & certificates)
-- ============================================================
CREATE TABLE unit_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'gas_safety', 'epc', 'electrical_cert', 'fire_risk', 'asbestos',
        'planning_permission', 'hmo_licence', 'inventory', 'move_in_checklist',
        'move_out_checklist', 'other'
    )),
    document_url TEXT,
    issue_date DATE,
    expiry_date DATE,
    status TEXT CHECK (status IN ('valid', 'expiring_soon', 'expired')) DEFAULT 'valid',
    reminder_sent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE ISSUES (chronic/ongoing – distinct from one-off requests)
-- ============================================================
CREATE TABLE maintenance_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'damp', 'mould', 'pest', 'structural', 'drainage',
        'heating', 'electrical', 'noise', 'other'
    )),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'critical')) DEFAULT 'minor',
    is_chronic BOOLEAN DEFAULT FALSE,
    is_building_wide BOOLEAN DEFAULT FALSE,
    first_reported_at TIMESTAMPTZ DEFAULT NOW(),
    last_reported_at TIMESTAMPTZ DEFAULT NOW(),
    report_count INT DEFAULT 1,
    times_addressed INT DEFAULT 0,
    status TEXT CHECK (status IN (
        'monitoring', 'active', 'in_remediation', 'resolved', 'unresolvable'
    )) DEFAULT 'active',
    resolution_attempts JSONB DEFAULT '[]', -- [{date, action, contractor, outcome}]
    related_maintenance_request_ids UUID[] DEFAULT '{}',
    related_dispute_ids UUID[] DEFAULT '{}',
    potential_liability BOOLEAN DEFAULT FALSE, -- agent flags if legal exposure risk
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEASES
-- ============================================================
CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_rent NUMERIC NOT NULL,
    deposit_amount NUMERIC,
    deposit_held NUMERIC,
    deposit_scheme TEXT, -- TDS, DPS, MyDeposits etc.
    notice_period_days INT DEFAULT 30,
    status TEXT CHECK (status IN (
        'active', 'expired', 'terminated', 'notice_given', 'pending'
    )) DEFAULT 'active',
    lease_document_url TEXT,
    special_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK now leases exists
ALTER TABLE landlord_notifications
    ADD CONSTRAINT fk_landlord_notifications_lease
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE SET NULL;

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    whatsapp_number TEXT NOT NULL UNIQUE, -- primary lookup key for agent
    id_document_url TEXT,
    is_primary_tenant BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    amount_due NUMERIC NOT NULL,
    amount_paid NUMERIC DEFAULT 0,
    due_date DATE NOT NULL,
    paid_date DATE,
    status TEXT CHECK (status IN (
        'pending', 'paid', 'late', 'partial', 'missed'
    )) DEFAULT 'pending',
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENT PLANS
-- ============================================================
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    total_arrears NUMERIC NOT NULL,
    installment_amount NUMERIC NOT NULL,
    installment_frequency TEXT CHECK (installment_frequency IN ('weekly', 'fortnightly', 'monthly')) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT CHECK (status IN ('active', 'completed', 'breached')) DEFAULT 'active',
    agreed_at TIMESTAMPTZ DEFAULT NOW(),
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS (raw WhatsApp message log)
-- ============================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_body TEXT NOT NULL,
    whatsapp_message_id TEXT,
    intent_classification TEXT, -- what the agent decided this message was about
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATION CONTEXT (rolling summary per lease – one row)
-- ============================================================
CREATE TABLE conversation_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL UNIQUE REFERENCES leases(id) ON DELETE CASCADE,
    summary TEXT, -- agent-maintained plain English summary of the relationship
    open_threads JSONB DEFAULT '[]', -- outstanding questions or pending actions
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE REQUESTS (one-off jobs linked to lease)
-- ============================================================
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    maintenance_issue_id UUID REFERENCES maintenance_issues(id) ON DELETE SET NULL, -- set if promoted to chronic
    category TEXT NOT NULL CHECK (category IN (
        'plumbing', 'electrical', 'structural', 'appliance',
        'heating', 'pest', 'damp', 'access', 'other'
    )),
    description TEXT NOT NULL,
    urgency TEXT CHECK (urgency IN ('emergency', 'high', 'routine')) DEFAULT 'routine',
    status TEXT CHECK (status IN (
        'open', 'assigned', 'in_progress', 'completed', 'closed', 'reopened'
    )) DEFAULT 'open',
    contractor_id UUID, -- FK added after contractors table
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cost NUMERIC,
    photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTRACTORS
-- ============================================================
CREATE TABLE contractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trades TEXT[] NOT NULL DEFAULT '{}', -- plumbing, electrical, structural, etc.
    phone TEXT,
    email TEXT,
    emergency_available BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK now contractors exists
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_contractor
    FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL;

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'rent_arrears', 'property_damage', 'noise', 'deposit',
        'harassment', 'repairs', 'other'
    )),
    description TEXT NOT NULL,
    status TEXT CHECK (status IN (
        'open', 'under_review', 'ruled', 'appealed', 'closed'
    )) DEFAULT 'open',
    ruling TEXT,
    evidence_urls TEXT[] DEFAULT '{}',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- ============================================================
-- LEGAL ACTIONS
-- ============================================================
CREATE TABLE legal_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'formal_notice', 'section_8', 'section_21', 'eviction_notice',
        'payment_demand', 'deposit_deduction_notice', 'tribunal_prep',
        'payment_plan_agreement', 'lease_violation_notice', 'other'
    )),
    document_url TEXT,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    response_deadline TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,
    status TEXT CHECK (status IN (
        'issued', 'acknowledged', 'complied', 'escalated', 'expired'
    )) DEFAULT 'issued',
    agent_reasoning TEXT, -- why the agent took this action
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT TEMPLATES (legal letters per jurisdiction)
-- ============================================================
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jurisdiction TEXT NOT NULL,
    document_type TEXT NOT NULL,
    template_body TEXT NOT NULL, -- with {{placeholders}}
    legal_basis TEXT, -- the actual law / statute it references
    version INT DEFAULT 1,
    last_reviewed_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT ACTIONS (immutable audit log – never delete rows)
-- ============================================================
CREATE TABLE agent_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
    action_category TEXT NOT NULL CHECK (action_category IN (
        'maintenance', 'payment', 'legal', 'communication',
        'dispute', 'document', 'scheduling', 'escalation', 'other'
    )),
    action_description TEXT NOT NULL,
    tools_called JSONB DEFAULT '[]',
    input_summary TEXT,
    output_summary TEXT,
    confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (performance for agent lookups)
-- ============================================================
CREATE INDEX idx_tenants_whatsapp ON tenants(whatsapp_number);
CREATE INDEX idx_leases_unit_id ON leases(unit_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_conversations_lease_id ON conversations(lease_id);
CREATE INDEX idx_payments_lease_id ON payments(lease_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_maintenance_requests_lease_id ON maintenance_requests(lease_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_issues_unit_id ON maintenance_issues(unit_id);
CREATE INDEX idx_disputes_lease_id ON disputes(lease_id);
CREATE INDEX idx_legal_actions_lease_id ON legal_actions(lease_id);
CREATE INDEX idx_agent_actions_lease_id ON agent_actions(lease_id);
CREATE INDEX idx_agent_actions_timestamp ON agent_actions(timestamp);
CREATE INDEX idx_unit_documents_expiry ON unit_documents(expiry_date);
CREATE INDEX idx_landlord_notifications_landlord_id ON landlord_notifications(landlord_id);
CREATE INDEX idx_landlord_notifications_read ON landlord_notifications(read_at);

-- ============================================================
-- ROW LEVEL SECURITY (enable for all tables)
-- ============================================================
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- END
-- ============================================================
