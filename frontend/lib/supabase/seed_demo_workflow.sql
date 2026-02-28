-- ============================================================
-- Demo Data for AI Maintenance Workflow
-- ============================================================

-- Insert a demo landlord if not exists
INSERT INTO landlords (id, full_name, email, phone, whatsapp_number)
VALUES (
  'demo-landlord-001',
  'John Smith',
  'john@propertymanager.com',
  '+1234567890',
  '+1234567890'
) ON CONFLICT (id) DO NOTHING;

-- Insert a demo unit
INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction)
VALUES (
  'demo-unit-001',
  'demo-landlord-001',
  'Unit 5B',
  '123 Main Street',
  'San Francisco',
  'US',
  'california'
) ON CONFLICT (id) DO NOTHING;

-- Insert a demo lease
INSERT INTO leases (id, unit_id, start_date, end_date, monthly_rent, deposit_amount, status)
VALUES (
  'demo-lease-001',
  'demo-unit-001',
  CURRENT_DATE - INTERVAL '6 months',
  CURRENT_DATE + INTERVAL '6 months',
  2500.00,
  5000.00,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Insert a demo tenant
INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
VALUES (
  'demo-tenant-001',
  'demo-lease-001',
  'Sarah Johnson',
  'sarah@email.com',
  '+0987654321',
  true
) ON CONFLICT (id) DO NOTHING;

-- Insert demo contractors
INSERT INTO contractors (id, landlord_id, name, trades, phone, email, emergency_available)
VALUES 
  ('demo-contractor-001', 'demo-landlord-001', 'Quick Fix Plumbing', ARRAY['plumbing', 'emergency'], '+1111111111', 'contact@quickfix.com', true),
  ('demo-contractor-002', 'demo-landlord-001', '24/7 Emergency Services', ARRAY['plumbing', 'electrical', 'hvac', 'emergency'], '+2222222222', 'help@247services.com', true),
  ('demo-contractor-003', 'demo-landlord-001', 'Budget Handyman', ARRAY['plumbing', 'electrical', 'appliance'], '+3333333333', 'info@budgethandyman.com', false)
ON CONFLICT (id) DO NOTHING;

-- Create a demo maintenance request
INSERT INTO maintenance_requests (
  id, 
  lease_id, 
  description, 
  category, 
  urgency, 
  status,
  created_at
)
VALUES (
  'demo-request-001',
  'demo-lease-001',
  'There is water dripping from my ceiling in the bathroom. It started yesterday and is getting worse. I can see a wet patch that is growing.',
  'plumbing',
  'high',
  'open',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create workflow for the maintenance request
INSERT INTO maintenance_workflows (
  id,
  maintenance_request_id,
  current_state,
  ai_analysis,
  state_history,
  created_at,
  updated_at
)
VALUES (
  'demo-workflow-001',
  'demo-request-001',
  'OWNER_NOTIFIED',
  '{
    "category": "plumbing",
    "urgency": "high",
    "estimated_cost_range": "medium",
    "vendor_required": true,
    "reasoning": "Water leaking from ceiling indicates potential pipe issue above. This requires immediate professional attention to prevent water damage and mold growth. Tenant cannot safely address this themselves.",
    "confidence_score": 0.92
  }'::jsonb,
  '[
    {
      "state": "SUBMITTED",
      "timestamp": "' || NOW() || '",
      "metadata": {"action": "workflow_created"}
    },
    {
      "from_state": "SUBMITTED",
      "to_state": "OWNER_NOTIFIED",
      "timestamp": "' || (NOW() + INTERVAL '1 minute') || '",
      "metadata": {"action": "automatic_notification"}
    }
  ]'::jsonb,
  NOW(),
  NOW() + INTERVAL '1 minute'
) ON CONFLICT (id) DO NOTHING;

-- Add initial communications
INSERT INTO workflow_communications (id, workflow_id, sender_type, sender_name, message, created_at)
VALUES
  (
    'demo-comm-001',
    'demo-workflow-001',
    'tenant',
    'Sarah Johnson',
    'There is water dripping from my ceiling in the bathroom. It started yesterday and is getting worse. I can see a wet patch that is growing.',
    NOW()
  ),
  (
    'demo-comm-002',
    'demo-workflow-001',
    'system',
    'System',
    'Maintenance request submitted. Owner has been notified for approval.',
    NOW() + INTERVAL '30 seconds'
  ),
  (
    'demo-comm-003',
    'demo-workflow-001',
    'system',
    'System',
    'AI Analysis Complete: HIGH urgency plumbing issue detected. Water leak from ceiling requires immediate professional attention. Estimated cost: $200-$800. Vendor required.',
    NOW() + INTERVAL '1 minute'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Demo Workflow Progression Functions
-- ============================================================

-- Function to simulate owner approval
CREATE OR REPLACE FUNCTION demo_approve_request() RETURNS void AS $$
BEGIN
  -- Update workflow state
  UPDATE maintenance_workflows 
  SET 
    current_state = 'VENDOR_CONTACTED',
    owner_response = 'approved',
    owner_response_message = 'Approved - please fix ASAP',
    vendor_message = 'Hi Quick Fix Plumbing, We have a high urgency water leak from ceiling at Unit 5B, 123 Main Street that requires your expertise. Could you please provide an ETA for addressing this issue? The tenant has reported: "Water dripping from ceiling in bathroom with growing wet patch." Thank you for your prompt attention to this matter. Best regards, Property Management',
    state_history = state_history || '[
      {
        "from_state": "OWNER_NOTIFIED",
        "to_state": "OWNER_RESPONDED",
        "timestamp": "' || NOW() || '",
        "metadata": {"response": "approved", "message": "Approved - please fix ASAP"}
      },
      {
        "from_state": "OWNER_RESPONDED",
        "to_state": "DECISION_MADE",
        "timestamp": "' || (NOW() + INTERVAL '5 seconds') || '",
        "metadata": {"action": "approved"}
      },
      {
        "from_state": "DECISION_MADE",
        "to_state": "VENDOR_CONTACTED",
        "timestamp": "' || (NOW() + INTERVAL '10 seconds') || '",
        "metadata": {"action": "vendor_required"}
      },
      {
        "from_state": "VENDOR_CONTACTED",
        "to_state": "AWAITING_VENDOR_RESPONSE",
        "timestamp": "' || (NOW() + INTERVAL '15 seconds') || '",
        "metadata": {"action": "awaiting_vendor"}
      }
    ]'::jsonb,
    updated_at = NOW()
  WHERE id = 'demo-workflow-001';

  -- Add communications
  INSERT INTO workflow_communications (workflow_id, sender_type, sender_name, message) VALUES
    ('demo-workflow-001', 'owner', 'Property Owner', 'Approved - please fix ASAP'),
    ('demo-workflow-001', 'system', 'System', 'Owner approved the request. Contacting vendors for immediate service.'),
    ('demo-workflow-001', 'system', 'System', 'Vendor contacted with message: Hi Quick Fix Plumbing, We have a high urgency water leak...');
END;
$$ LANGUAGE plpgsql;

-- Function to simulate vendor response
CREATE OR REPLACE FUNCTION demo_vendor_response() RETURNS void AS $$
BEGIN
  -- Update workflow
  UPDATE maintenance_workflows 
  SET 
    current_state = 'IN_PROGRESS',
    vendor_eta = NOW() + INTERVAL '2 hours',
    vendor_notes = 'Will arrive within 2 hours with necessary equipment',
    state_history = state_history || '[
      {
        "from_state": "AWAITING_VENDOR_RESPONSE",
        "to_state": "ETA_CONFIRMED",
        "timestamp": "' || NOW() || '",
        "metadata": {"vendor_id": "demo-contractor-001", "eta": "' || (NOW() + INTERVAL '2 hours') || '"}
      },
      {
        "from_state": "ETA_CONFIRMED",
        "to_state": "TENANT_NOTIFIED",
        "timestamp": "' || (NOW() + INTERVAL '5 seconds') || '",
        "metadata": {"action": "eta_notification"}
      },
      {
        "from_state": "TENANT_NOTIFIED",
        "to_state": "IN_PROGRESS",
        "timestamp": "' || (NOW() + INTERVAL '10 seconds') || '",
        "metadata": {"action": "work_started"}
      }
    ]'::jsonb,
    updated_at = NOW()
  WHERE id = 'demo-workflow-001';

  -- Update maintenance request
  UPDATE maintenance_requests
  SET 
    contractor_id = 'demo-contractor-001',
    scheduled_at = NOW() + INTERVAL '2 hours',
    status = 'in_progress'
  WHERE id = 'demo-request-001';

  -- Add vendor bid
  INSERT INTO vendor_bids (workflow_id, contractor_id, bid_amount, estimated_completion_time, message)
  VALUES ('demo-workflow-001', 'demo-contractor-001', 350.00, 2, 'Will arrive within 2 hours with necessary equipment');

  -- Add communications
  INSERT INTO workflow_communications (workflow_id, sender_type, sender_id, sender_name, message) VALUES
    ('demo-workflow-001', 'vendor', 'demo-contractor-001', 'Quick Fix Plumbing', 'ETA confirmed: ' || TO_CHAR(NOW() + INTERVAL '2 hours', 'Month DD at HH12:MI AM')),
    ('demo-workflow-001', 'system', 'System', 'Good news! A contractor has been scheduled for your maintenance request. They will arrive on ' || TO_CHAR(NOW() + INTERVAL '2 hours', 'Month DD at HH12:MI AM') || '.');
END;
$$ LANGUAGE plpgsql;

-- Function to complete the workflow
CREATE OR REPLACE FUNCTION demo_complete_workflow() RETURNS void AS $$
BEGIN
  -- Update workflow
  UPDATE maintenance_workflows 
  SET 
    current_state = 'COMPLETED',
    state_history = state_history || '[
      {
        "from_state": "IN_PROGRESS",
        "to_state": "COMPLETED",
        "timestamp": "' || NOW() || '",
        "metadata": {"notes": "Fixed burst pipe in upstairs unit. Replaced damaged section.", "cost": 425}
      }
    ]'::jsonb,
    updated_at = NOW()
  WHERE id = 'demo-workflow-001';

  -- Update maintenance request
  UPDATE maintenance_requests
  SET 
    status = 'completed',
    completed_at = NOW(),
    cost = 425
  WHERE id = 'demo-request-001';

  -- Add completion communication
  INSERT INTO workflow_communications (workflow_id, sender_type, sender_name, message)
  VALUES ('demo-workflow-001', 'system', 'System', 'Repair completed. Fixed burst pipe in upstairs unit. Replaced damaged section.');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Instructions for Demo
-- ============================================================
-- 1. Run this script to create initial demo data
-- 2. To simulate owner approval: SELECT demo_approve_request();
-- 3. To simulate vendor response: SELECT demo_vendor_response();
-- 4. To complete the workflow: SELECT demo_complete_workflow();