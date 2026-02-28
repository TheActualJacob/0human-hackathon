# 🚀 FINAL FIX: Making Maintenance Requests Work

## The Problem
Maintenance requests are disappearing because:
1. The backend API has CORS issues
2. Database tables might not exist
3. The workflow creation might be failing

## Quick Solution

### Step 1: Run Complete Database Setup

**Go to your Supabase Dashboard → SQL Editor** and run this entire script:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all workflow tables
CREATE TABLE IF NOT EXISTS maintenance_workflows (
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

CREATE TABLE IF NOT EXISTS workflow_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL,
    sender_type TEXT NOT NULL,
    sender_id UUID,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    estimated_cost DECIMAL(10, 2),
    proposed_eta TIMESTAMPTZ,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for development (enable with proper policies in production)
ALTER TABLE maintenance_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bids DISABLE ROW LEVEL SECURITY;

-- Create test data
DELETE FROM tenants WHERE id LIKE 'test-%';
DELETE FROM leases WHERE id LIKE 'test-%';
DELETE FROM units WHERE id LIKE 'test-%';
DELETE FROM landlords WHERE id LIKE 'test-%';

INSERT INTO landlords (id, full_name, email, phone_number, address, zip_code)
VALUES ('test-landlord-001', 'Test Property LLC', 'admin@test.com', '+1234567890', '123 Main St', '10001');

INSERT INTO units (id, landlord_id, unit_identifier, address, zip_code, rental_price)
VALUES ('test-unit-001', 'test-landlord-001', 'Apt 4A', '456 Oak Ave, Apt 4A', '10002', 2500.00);

INSERT INTO leases (id, landlord_id, unit_id, start_date, end_date, rent_amount, status)
VALUES ('test-lease-001', 'test-landlord-001', 'test-unit-001', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months', 2500.00, 'active');

INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
VALUES ('test-tenant-001', 'test-lease-001', 'Test Tenant', 'tenant@test.com', '+1234567890', true);
```

### Step 2: Verify Services

1. **Frontend** should be running on http://localhost:3000
   ```bash
   cd frontend && npm run dev
   ```

2. **Backend** should be running on http://localhost:8001
   ```bash
   cd backend && /Users/admin/Library/Python/3.9/bin/uvicorn app.main:app --reload --port 8001
   ```

### Step 3: Use the Debug Panel

1. Go to http://localhost:3000/maintenance
2. Click the **Debug** button (bottom right)
3. Check:
   - Backend Status (should show "Backend Connected")
   - Database tables (should show all tables exist)
   - If backend shows as disconnected, the API isn't running

### Step 4: Submit a Test Request

1. Click "Submit New Maintenance Request"
2. Select "Test Tenant - Apt 4A"
3. Enter: "My kitchen sink is leaking"
4. Click "Submit to AI"

### Step 5: If It Still Doesn't Work

Use the Debug Panel to:
1. Click "Refresh Data" to reload from database
2. Check if any workflows or requests appear
3. Look for errors in the console (F12)

## Manual Test (Bypass API)

If the API isn't working, you can create a test workflow directly in Supabase:

**Run this in SQL Editor:**

```sql
-- Create a test maintenance request and workflow
DO $$
DECLARE
    req_id UUID := uuid_generate_v4();
    wf_id UUID := uuid_generate_v4();
BEGIN
    -- Insert maintenance request
    INSERT INTO maintenance_requests (id, lease_id, description, category, urgency, status)
    VALUES (req_id, 'test-lease-001', 'Test maintenance request', 'plumbing', 'medium', 'open');
    
    -- Insert workflow
    INSERT INTO maintenance_workflows (
        id, 
        maintenance_request_id, 
        current_state,
        ai_analysis
    )
    VALUES (
        wf_id,
        req_id,
        'OWNER_NOTIFIED',
        '{"category": "plumbing", "urgency": "medium", "vendor_required": true, "reasoning": "Test workflow", "confidence_score": 0.95}'::jsonb
    );
    
    -- Insert initial communication
    INSERT INTO workflow_communications (workflow_id, sender_type, sender_name, message)
    VALUES (wf_id, 'system', 'AI System', 'Maintenance request received and analyzed.');
    
    RAISE NOTICE 'Test workflow created with ID: %', wf_id;
END $$;
```

Then refresh the page - you should see the test workflow!

## Common Issues & Solutions

1. **"Failed to fetch"**
   - Backend isn't running → Start it on port 8001
   - CORS issue → Backend should allow localhost:3000

2. **"maintenance_workflows does not exist"**
   - Tables not created → Run the SQL setup script above

3. **Workflows not showing after submit**
   - Check Debug Panel → Click "Refresh Data"
   - Check browser console for errors

4. **Backend can't connect to database**
   - Check `.env` file has correct DATABASE_URL
   - Verify Supabase project is accessible

## Success Indicators

When working properly:
- ✅ Debug Panel shows "Backend Connected"
- ✅ All tables show as existing with row counts
- ✅ Submitting a request creates a workflow
- ✅ Workflow appears in timeline immediately
- ✅ Can interact with owner/vendor actions

The Debug Panel is your friend - use it to diagnose issues!