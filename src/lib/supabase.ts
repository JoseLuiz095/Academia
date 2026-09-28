import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const hasPlaceholderKey = !supabaseKey || supabaseKey.includes('sua-chave') || supabaseKey.includes('your-')
const hasValidUrl = typeof supabaseUrl === 'string' && /^https:\/\/[^\s]+\.supabase\.co$/.test(supabaseUrl)
const hasValidKey = typeof supabaseKey === 'string' && supabaseKey.length > 20 && !hasPlaceholderKey

export const supabase = hasValidUrl && hasValidKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseConfigured = Boolean(supabase)
export const supabaseConfigIssue = !hasValidUrl && !hasValidKey
  ? 'url_and_key'
  : !hasValidUrl
    ? 'url'
    : !hasValidKey
      ? 'publishable_key'
      : null
