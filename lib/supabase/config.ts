const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const configuredSupabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim()

if (!configuredSupabaseUrl || !configuredSupabaseKey) {
  throw new Error(
    'Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
  )
}

const supabaseUrl: string = configuredSupabaseUrl
const supabaseKey: string = configuredSupabaseKey

export { supabaseUrl, supabaseKey }
