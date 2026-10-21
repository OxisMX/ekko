import type { Database } from '@ekko/shared'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno del panel.')
}

// WHY: default browser persistence + auto refresh keep the cashier device signed in (F-20).
export const supabase = createClient<Database>(url, anonKey)
