import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dfmzipgtvidwfcmccdrx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbXppcGd0dmlkd2ZjbWNjZHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTgxNjUsImV4cCI6MjA5NTA5NDE2NX0.KXE6j-mbzeZnusKZ_ys1DtrC-X0wlaYrzfxvHDXdUos'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,        // ← CRITICAL for mobile OAuth redirect
    storage: window.localStorage,    // ← explicit storage for mobile browsers
    storageKey: 'zixplon-auth',      // ← unique key avoids conflicts
    flowType: 'implicit',            // ← needed for mobile OAuth
  }
})