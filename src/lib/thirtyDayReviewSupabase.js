import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pmxfjlzjvcbnvwtikzsl.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBteGZqbHpqdmNibnZ3dGlrenNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNjU4MzksImV4cCI6MjA5Mjc0MTgzOX0.dz2SHqqwYRUPPaEE3uTx5MmPhSWOJWDygJdTVyPdJLc'

export const thirtyDayReviewSupabase = createClient(supabaseUrl, supabaseKey)
