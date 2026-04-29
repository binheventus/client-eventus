import { createClient } from '@supabase/supabase-js'

const legacySupabaseUrl = 'https://pmxfjlzjvcbnvwtikzsl.supabase.co'
const legacySupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBteGZqbHpqdmNibnZ3dGlrenNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjU4MzksImV4cCI6MjA5Mjc0MTgzOX0.dz2SHqqwYRUPPaEE3uTx5MmPhSWOJWDygJdTVyPdJLc'

const supabaseUrl =
  import.meta.env.VITE_30DAY_REVIEW_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  legacySupabaseUrl

const supabaseKey =
  import.meta.env.VITE_30DAY_REVIEW_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_30DAY_REVIEW_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  legacySupabaseKey

export const thirtyDayReviewSupabase = createClient(supabaseUrl, supabaseKey)
