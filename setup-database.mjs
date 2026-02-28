import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hxmccpzjprbgsvpohxcy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWNjcHpqcHJiZ3N2cG9oeGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjU0NTUsImV4cCI6MjA4Nzg0MTQ1NX0.fKTlXbaO2nj-HjVxaGhcmaH3HldXJ2pffMaet1hWaZU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupWorkflowTables() {
  console.log('🚀 Setting up AI Maintenance Workflow System...\n');

  try {
    // Check if tables already exist
    const { data: existing } = await supabase
      .from('maintenance_workflows')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('✅ Workflow tables already exist!');
      console.log(`Found ${existing.length} existing workflows\n`);
      return;
    }

    console.log('❌ Workflow tables not found.');
    console.log('\n📋 Please follow these steps:\n');
    console.log('1. Go to https://supabase.com and sign in');
    console.log('2. Open your project (hxmccpzjprbgsvpohxcy)');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Copy and paste the contents of RUN_THIS_IN_SUPABASE.sql');
    console.log('5. Click "Run" button\n');
    console.log('This will create the workflow tables and convert your existing maintenance requests into workflows.');

  } catch (error) {
    if (error.message?.includes('maintenance_workflows')) {
      console.log('❌ Workflow tables do not exist yet.\n');
      console.log('Please run the SQL script in Supabase SQL Editor to create them.');
    } else {
      console.error('Error checking tables:', error);
    }
  }
}

setupWorkflowTables();