import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*, delegates(*)')
    .eq('id', userId)
    .single()
  return data
}