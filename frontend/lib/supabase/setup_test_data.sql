-- ============================================================
-- Complete Test Data Setup for AI Maintenance Workflow
-- ============================================================
-- Run this script in Supabase SQL Editor to create test data

-- Clean up any existing test data first (optional)
DELETE FROM workflow_communications WHERE workflow_id IN (
    SELECT id FROM maintenance_workflows WHERE maintenance_request_id IN (
        SELECT id FROM maintenance_requests WHERE lease_id = 'test-lease-001'
    )
);
DELETE FROM vendor_bids WHERE workflow_id IN (
    SELECT id FROM maintenance_workflows WHERE maintenance_request_id IN (
        SELECT id FROM maintenance_requests WHERE lease_id = 'test-lease-001'
    )
);
DELETE FROM maintenance_workflows WHERE maintenance_request_id IN (
    SELECT id FROM maintenance_requests WHERE lease_id = 'test-lease-001'
);
DELETE FROM maintenance_requests WHERE lease_id = 'test-lease-001';
DELETE FROM tenants WHERE id = 'test-tenant-001';
DELETE FROM leases WHERE id = 'test-lease-001';
DELETE FROM units WHERE id = 'test-unit-001';
DELETE FROM contractors WHERE landlord_id = 'test-landlord-001';
DELETE FROM landlords WHERE id = 'test-landlord-001';

-- Create test landlord
INSERT INTO landlords (id, full_name, email, phone, whatsapp_number)
VALUES (
  'test-landlord-001',
  'Test Landlord',
  'landlord@test.com',
  '+1234567890',
  '+1234567890'
);

-- Create test unit
INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction)
VALUES (
  'test-unit-001',
  'test-landlord-001',
  'Apartment 4A',
  '456 Test Street',
  'San Francisco',
  'US',
  'california'
);

-- Create an active lease
INSERT INTO leases (id, unit_id, start_date, end_date, monthly_rent, deposit_amount, status)
VALUES (
  'test-lease-001',
  'test-unit-001',
  CURRENT_DATE - INTERVAL '3 months',
  CURRENT_DATE + INTERVAL '9 months',
  1800.00,
  3600.00,
  'active'
);

-- Create test tenant
INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
VALUES (
  'test-tenant-001',
  'test-lease-001',
  'Alex Thompson',
  'alex@testmail.com',
  '+1987654321',
  true
);

-- Create test contractors
INSERT INTO contractors (id, landlord_id, name, trades, phone, email, emergency_available)
VALUES 
  ('test-contractor-001', 'test-landlord-001', 'FastFix Plumbing', ARRAY['plumbing', 'emergency'], '+1111111111', 'contact@fastfix.com', true),
  ('test-contractor-002', 'test-landlord-001', 'ElectriPro Services', ARRAY['electrical', 'hvac'], '+2222222222', 'help@electripro.com', true),
  ('test-contractor-003', 'test-landlord-001', 'HandyHelp Solutions', ARRAY['plumbing', 'electrical', 'appliance', 'general'], '+3333333333', 'info@handyhelp.com', false);

-- Create more test tenants/units for variety
INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction)
VALUES 
  ('test-unit-002', 'test-landlord-001', 'Apartment 2B', '456 Test Street', 'San Francisco', 'US', 'california'),
  ('test-unit-003', 'test-landlord-001', 'Studio 101', '789 Demo Avenue', 'San Francisco', 'US', 'california');

INSERT INTO leases (id, unit_id, start_date, end_date, monthly_rent, deposit_amount, status)
VALUES 
  ('test-lease-002', 'test-unit-002', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months', 2200.00, 4400.00, 'active'),
  ('test-lease-003', 'test-unit-003', CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '11 months', 1500.00, 3000.00, 'active');

INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
VALUES 
  ('test-tenant-002', 'test-lease-002', 'Sarah Johnson', 'sarah@testmail.com', '+1555666777', true),
  ('test-tenant-003', 'test-lease-003', 'Mike Chen', 'mike@testmail.com', '+1888999000', true);

-- Verify the setup
SELECT 
  t.full_name as "Tenant Name",
  t.email as "Email",
  u.unit_identifier as "Unit",
  u.address as "Address",
  l.monthly_rent as "Monthly Rent",
  l.status as "Lease Status"
FROM tenants t
JOIN leases l ON t.lease_id = l.id
JOIN units u ON l.unit_id = u.id
WHERE t.is_primary_tenant = true
ORDER BY t.full_name;

-- Show available contractors
SELECT 
  name as "Contractor",
  array_to_string(trades, ', ') as "Specialties",
  phone as "Phone",
  CASE WHEN emergency_available THEN 'Yes' ELSE 'No' END as "Emergency Available"
FROM contractors
WHERE landlord_id = 'test-landlord-001'
ORDER BY name;