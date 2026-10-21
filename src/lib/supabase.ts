import { createClient } from '@supabase/supabase-js'
import { requestCache } from './requestCache'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co'
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'missing-key'

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: requestCache.fetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
