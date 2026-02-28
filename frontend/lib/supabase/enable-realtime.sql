-- Enable Realtime for all tables
-- Run this in Supabase SQL Editor after creating the schema

-- Enable realtime for tenants table
ALTER PUBLICATION supabase_realtime ADD TABLE tenants;

-- Enable realtime for maintenance_tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_tickets;

-- Enable realtime for vendors table
ALTER PUBLICATION supabase_realtime ADD TABLE vendors;

-- Enable realtime for leases table
ALTER PUBLICATION supabase_realtime ADD TABLE leases;

-- Enable realtime for rent_payments table
ALTER PUBLICATION supabase_realtime ADD TABLE rent_payments;

-- Enable realtime for activity_feed table
ALTER PUBLICATION supabase_realtime ADD TABLE activity_feed;

-- Verify realtime is enabled
SELECT 
    schemaname,
    tablename 
FROM 
    pg_publication_tables 
WHERE 
    pubname = 'supabase_realtime';