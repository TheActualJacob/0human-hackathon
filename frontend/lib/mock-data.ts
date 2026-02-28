// Comprehensive mock data for the Demo Mode (Skip to Demo)
// This data is entirely in-memory and disconnected from Supabase

export const MOCK_LANDLORD = {
  id: 'mock-landlord-1',
  full_name: 'Alex Johnson (Demo)',
  email: 'alex@demo.com',
  avatar_url: 'https://ui-avatars.com/api/?name=Alex+Johnson&background=0D8ABC&color=fff',
};

export const MOCK_UNITS = [
  {
    id: 'unit-1',
    name: 'Loft 402',
    address: '123 Tech Ave, San Francisco, CA',
    status: 'occupied',
    type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    rent_amount: 3200,
    created_at: new Date().toISOString(),
  },
  {
    id: 'unit-2',
    name: 'Suite 10B',
    address: '456 Innovation Blvd, San Francisco, CA',
    status: 'vacant',
    type: 'commercial',
    bedrooms: 0,
    bathrooms: 2,
    rent_amount: 5500,
    created_at: new Date().toISOString(),
  },
  {
    id: 'unit-3',
    name: 'Garden Cottage',
    address: '789 Serenity Lane, Palo Alto, CA',
    status: 'occupied',
    type: 'house',
    bedrooms: 2,
    bathrooms: 1.5,
    rent_amount: 4200,
    created_at: new Date().toISOString(),
  }
];

export const MOCK_TENANTS = [
  {
    id: 'tenant-1',
    full_name: 'Sarah Miller',
    email: 'sarah@example.com',
    phone: '555-0101',
    unit_id: 'unit-1',
    status: 'active',
  },
  {
    id: 'tenant-2',
    full_name: 'David Chen',
    email: 'david@example.com',
    phone: '555-0102',
    unit_id: 'unit-3',
    status: 'active',
  }
];

export const MOCK_LEASES = [
  {
    id: 'lease-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2024-01-01',
    end_date: '2025-01-01',
    rent_amount: 3200,
    status: 'active',
  },
  {
    id: 'lease-2',
    unit_id: 'unit-3',
    tenant_id: 'tenant-2',
    start_date: '2023-06-01',
    end_date: '2024-06-01',
    rent_amount: 4200,
    status: 'active',
  }
];

export const MOCK_MAINTENANCE_REQUESTS = [
  {
    id: 'req-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    title: 'Leaking Faucet',
    description: 'The kitchen faucet is dripping constantly, even when turned off tightly.',
    status: 'SUBMITTED',
    priority: 'low',
    category: 'plumbing',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'req-2',
    unit_id: 'unit-3',
    tenant_id: 'tenant-2',
    title: 'AC Not Working',
    description: 'The air conditioning unit is blowing warm air. It is 85 degrees inside.',
    status: 'OWNER_NOTIFIED',
    priority: 'high',
    category: 'hvac',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  }
];

export const MOCK_PAYMENTS = [
  {
    id: 'pay-1',
    lease_id: 'lease-1',
    amount: 3200,
    status: 'paid',
    due_date: '2024-02-01',
    paid_at: '2024-01-31',
    type: 'rent',
  },
  {
    id: 'pay-2',
    lease_id: 'lease-2',
    amount: 4200,
    status: 'pending',
    due_date: '2024-03-01',
    paid_at: null,
    type: 'rent',
  }
];

export const MOCK_CONTRACTORS = [
  {
    id: 'con-1',
    full_name: 'QuickFix Plumbing',
    specialty: 'Plumbing',
    email: 'contact@quickfix.com',
    phone: '555-9988',
    rating: 4.8,
  },
  {
    id: 'con-2',
    full_name: 'Sparky Electrical',
    specialty: 'Electrical',
    email: 'info@sparky.com',
    phone: '555-7766',
    rating: 4.5,
  }
];
