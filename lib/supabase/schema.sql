-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  unit VARCHAR(50) NOT NULL,
  lease_id UUID,
  move_in_date DATE NOT NULL,
  rent_amount DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(50) CHECK (payment_status IN ('current', 'late', 'pending')),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Maintenance tickets table
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) CHECK (category IN ('plumbing', 'electrical', 'appliance', 'hvac', 'general', 'emergency')),
  urgency VARCHAR(50) CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  status VARCHAR(50) CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'closed')),
  vendor_id UUID,
  vendor_name VARCHAR(255),
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  ai_classified BOOLEAN DEFAULT FALSE,
  ai_decisions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  specialty TEXT[] NOT NULL,
  avg_response_time DECIMAL(5, 2) NOT NULL,
  avg_cost DECIMAL(10, 2) NOT NULL,
  rating DECIMAL(3, 2) CHECK (rating >= 1 AND rating <= 5),
  ai_performance_score INTEGER DEFAULT 0 CHECK (ai_performance_score >= 0 AND ai_performance_score <= 100),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Leases table
CREATE TABLE IF NOT EXISTS leases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  unit VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  security_deposit DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) CHECK (status IN ('active', 'expiring', 'expired', 'terminated')),
  renewal_recommendation INTEGER CHECK (renewal_recommendation >= 0 AND renewal_recommendation <= 100),
  suggested_rent_increase DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Rent payments table
CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(50) CHECK (status IN ('paid', 'late', 'pending', 'overdue')),
  late_fee DECIMAL(10, 2),
  ai_reminded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type VARCHAR(50) CHECK (type IN ('maintenance', 'rent', 'lease', 'vendor', 'system')),
  action VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  entity_id UUID,
  ai_generated BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX idx_tenants_unit ON tenants(unit);
CREATE INDEX idx_maintenance_tickets_tenant_id ON maintenance_tickets(tenant_id);
CREATE INDEX idx_maintenance_tickets_status ON maintenance_tickets(status);
CREATE INDEX idx_rent_payments_tenant_id ON rent_payments(tenant_id);
CREATE INDEX idx_rent_payments_status ON rent_payments(status);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX idx_activity_feed_timestamp ON activity_feed(timestamp DESC);

-- Add foreign key constraint for lease_id in tenants table
ALTER TABLE tenants 
ADD CONSTRAINT fk_tenants_lease 
FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE SET NULL;

-- Add foreign key constraint for vendor_id in maintenance_tickets table
ALTER TABLE maintenance_tickets 
ADD CONSTRAINT fk_maintenance_vendor 
FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_tickets_updated_at BEFORE UPDATE ON maintenance_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON leases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rent_payments_updated_at BEFORE UPDATE ON rent_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();