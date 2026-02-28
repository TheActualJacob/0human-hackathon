#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔍 Checking Supabase Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('---------------------');
console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? 'Set' : '❌ Missing'}`);
console.log(`${SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE' ? '❌' : '✅'} NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE' ? 'Needs to be updated' : 'Set'}`);
console.log(`✅ DATABASE_URL: ${DATABASE_URL ? 'Set' : '❌ Missing'}`);

if (SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE') {
  console.log('\n⚠️  Action Required:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Navigate to Settings → API');
  console.log('3. Copy the "anon public" key');
  console.log('4. Update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

console.log('\n📝 Next Steps:');
console.log('1. Ensure all environment variables are correctly set');
console.log('2. Run the SQL schema in Supabase SQL Editor');
console.log('3. Enable Realtime on your tables (optional for live updates)');
console.log('4. Restart your Next.js development server');