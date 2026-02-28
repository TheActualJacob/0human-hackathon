-- ============================================================
-- Create Test Tenant for Workflow Testing
-- ============================================================

-- First, check if we have any landlords. If not, create a test one
INSERT INTO landlords (id, full_name, email, phone, whatsapp_number)
VALUES (
  'test-landlord-001',
  'Test Landlord',
  'landlord@test.com',
  '+1234567890',
  '+1234567890'
) ON CONFLICT (id) DO NOTHING;

-- Create a test unit
INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction)
VALUES (
  'test-unit-001',
  'test-landlord-001',
  'Apartment 4A',
  '456 Test Street',
  'San Francisco',
  'US',
  'california'
) ON CONFLICT (id) DO NOTHING;

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
) ON CONFLICT (id) DO NOTHING;

-- Create a test tenant
INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
VALUES (
  'test-tenant-001',
  'test-lease-001',
  'Alex Thompson',
  'alex@testmail.com',
  '+1987654321',
  true
) ON CONFLICT (id) DO NOTHING;

-- Also add some test contractors for the workflow
INSERT INTO contractors (id, landlord_id, name, trades, phone, email, emergency_available)
VALUES 
  ('test-contractor-001', 'test-landlord-001', 'FastFix Plumbing', ARRAY['plumbing', 'emergency'], '+1111111111', 'contact@fastfix.com', true),
  ('test-contractor-002', 'test-landlord-001', 'ElectriPro Services', ARRAY['electrical', 'hvac'], '+2222222222', 'help@electripro.com', true),
  ('test-contractor-003', 'test-landlord-001', 'HandyHelp Solutions', ARRAY['plumbing', 'electrical', 'appliance', 'general'], '+3333333333', 'info@handyhelp.com', false)
ON CONFLICT (id) DO NOTHING;

-- Output confirmation
SELECT 
  t.full_name as tenant_name,
  t.email as tenant_email,
  u.unit_identifier,
  u.address,
  l.status as lease_status,
  l.monthly_rent
FROM tenants t
JOIN leases l ON t.lease_id = l.id
JOIN units u ON l.unit_id = u.id
WHERE t.id = 'test-tenant-001';