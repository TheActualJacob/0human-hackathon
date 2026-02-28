const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSetup() {
  try {
    console.log('🚀 Setting up workflow tables...\n');

    // Read the SQL file
    const sqlContent = fs.readFileSync(
      path.join(__dirname, '../../RUN_THIS_IN_SUPABASE.sql'),
      'utf8'
    );

    // Split into individual statements (simple split, might need refinement)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comment-only lines
      if (statement.trim().startsWith('--')) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n✨ Setup complete!');
    console.log('\nNow you can:');
    console.log('1. Go to http://localhost:3000/maintenance');
    console.log('2. Your maintenance requests should now appear as workflows!');

  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\n⚠️  Automated setup failed. Please run the SQL manually in Supabase.');
  }
}

runSetup();