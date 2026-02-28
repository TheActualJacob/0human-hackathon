# Supabase Database Setup

This application is now connected to your Supabase database. Here's what you need to know:

## Database Configuration

Your database connection is configured in `.env.local`:
```
DATABASE_URL=postgresql://postgres:yXds84912345678yX@db.hxmccpzjprbgsvpohxcy.supabase.co:5432/postgres
```

## Required: Get Your Supabase Anon Key

To complete the setup, you need to get your Supabase anon key:

1. Go to your Supabase dashboard
2. Navigate to Settings > API
3. Copy the `anon public` key
4. Update `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Database Schema

Run the schema SQL file in your Supabase SQL editor:
```sql
-- Copy the contents of /lib/supabase/schema.sql
```

This will create all necessary tables:
- `tenants` - Tenant information
- `maintenance_tickets` - Maintenance requests
- `vendors` - Service providers
- `leases` - Lease agreements
- `rent_payments` - Payment records
- `activity_feed` - Activity logs

## Real-time Updates

The application now supports real-time updates! When enabled:
- New maintenance tickets appear instantly
- Activity feed updates in real-time
- Payment status changes reflect immediately

To enable real-time:
1. Run `/lib/supabase/enable-realtime.sql` in your Supabase SQL Editor
2. Real-time subscriptions are automatically set up when the app starts

## Data Management

All data is now fetched from and saved to your Supabase database. The mock data has been removed, and the application uses real database operations.

### Key Changes:
- Removed all mock data files
- Updated Zustand store to use Supabase client
- All CRUD operations now interact with the database
- Field names updated to match database schema (snake_case)

## Adding Initial Data

You can add data directly through:
1. Supabase Table Editor in the dashboard
2. SQL queries in the SQL editor
3. The application's UI (create tickets, add vendors, etc.)

## Troubleshooting

If you see loading indefinitely:
1. Check that your anon key is set correctly
2. Verify the database schema has been created
3. Check browser console for any errors
4. Ensure your Supabase project is active