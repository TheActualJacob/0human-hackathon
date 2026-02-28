const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupTestData() {
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔄 Setting up test data...');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../lib/supabase/create_test_tenant.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If RPC doesn't exist, try individual inserts
      console.log('📝 Using individual inserts...');
      
      // Create test landlord
      const { error: landlordError } = await supabase
        .from('landlords')
        .upsert({
          id: 'test-landlord-001',
          full_name: 'Test Landlord',
          email: 'landlord@test.com',
          phone: '+1234567890',
          whatsapp_number: '+1234567890'
        });
      
      if (landlordError && !landlordError.message.includes('duplicate')) {
        console.error('Error creating landlord:', landlordError);
      }
      
      // Create test unit
      const { error: unitError } = await supabase
        .from('units')
        .upsert({
          id: 'test-unit-001',
          landlord_id: 'test-landlord-001',
          unit_identifier: 'Apartment 4A',
          address: '456 Test Street',
          city: 'San Francisco',
          country: 'US',
          jurisdiction: 'california'
        });
      
      if (unitError && !unitError.message.includes('duplicate')) {
        console.error('Error creating unit:', unitError);
      }
      
      // Create test lease
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 9);
      
      const { error: leaseError } = await supabase
        .from('leases')
        .upsert({
          id: 'test-lease-001',
          unit_id: 'test-unit-001',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          monthly_rent: 1800.00,
          deposit_amount: 3600.00,
          status: 'active'
        });
      
      if (leaseError && !leaseError.message.includes('duplicate')) {
        console.error('Error creating lease:', leaseError);
      }
      
      // Create test tenant
      const { error: tenantError } = await supabase
        .from('tenants')
        .upsert({
          id: 'test-tenant-001',
          lease_id: 'test-lease-001',
          full_name: 'Alex Thompson',
          email: 'alex@testmail.com',
          whatsapp_number: '+1987654321',
          is_primary_tenant: true
        });
      
      if (tenantError && !tenantError.message.includes('duplicate')) {
        console.error('Error creating tenant:', tenantError);
      }
      
      // Create test contractors
      const contractors = [
        {
          id: 'test-contractor-001',
          landlord_id: 'test-landlord-001',
          name: 'FastFix Plumbing',
          trades: ['plumbing', 'emergency'],
          phone: '+1111111111',
          email: 'contact@fastfix.com',
          emergency_available: true
        },
        {
          id: 'test-contractor-002',
          landlord_id: 'test-landlord-001',
          name: 'ElectriPro Services',
          trades: ['electrical', 'hvac'],
          phone: '+2222222222',
          email: 'help@electripro.com',
          emergency_available: true
        },
        {
          id: 'test-contractor-003',
          landlord_id: 'test-landlord-001',
          name: 'HandyHelp Solutions',
          trades: ['plumbing', 'electrical', 'appliance', 'general'],
          phone: '+3333333333',
          email: 'info@handyhelp.com',
          emergency_available: false
        }
      ];
      
      for (const contractor of contractors) {
        const { error: contractorError } = await supabase
          .from('contractors')
          .upsert(contractor);
        
        if (contractorError && !contractorError.message.includes('duplicate')) {
          console.error('Error creating contractor:', contractorError);
        }
      }
    }
    
    // Verify the data was created
    const { data: tenantData, error: fetchError } = await supabase
      .from('tenants')
      .select(`
        *,
        leases!inner(
          *,
          units!inner(*)
        )
      `)
      .eq('id', 'test-tenant-001')
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching test data:', fetchError);
    } else if (tenantData) {
      console.log('\n✅ Test data created successfully!\n');
      console.log('📋 Test Tenant Details:');
      console.log('------------------------');
      console.log(`Name: ${tenantData.full_name}`);
      console.log(`Email: ${tenantData.email}`);
      console.log(`Unit: ${tenantData.leases.units.unit_identifier}`);
      console.log(`Address: ${tenantData.leases.units.address}, ${tenantData.leases.units.city}`);
      console.log(`Monthly Rent: $${tenantData.leases.monthly_rent}`);
      console.log(`Lease Status: ${tenantData.leases.status}`);
      console.log('\n🎉 You can now test the workflow with this tenant!\n');
    }
    
  } catch (err) {
    console.error('❌ Error setting up test data:', err);
    process.exit(1);
  }
}

// Run the setup
setupTestData();