import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './database.types'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

// Cookie-based client for server components — reads the user session
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — cookies can't be set, ignore
        }
      },
    },
  })
}

// Service-role client — bypasses RLS, for server-side agent use only
// Lazy-initialized to avoid crashing when SUPABASE_SERVICE_ROLE_KEY is not set
let _supabaseAdmin: ReturnType<typeof createSupabaseClient<Database>> | null = null
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    if (!supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    }
    _supabaseAdmin = createSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _supabaseAdmin
}
