import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

// Service-role client — bypasses RLS, for server-side agent use only
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
