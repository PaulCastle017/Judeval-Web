import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configError =
  !url || !anonKey
    ? 'Faltan las variables VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example como .env.local y rellénalas.'
    : null

// Solo se usa la clave pública (anon/publishable). La seguridad la aplica RLS en la base de datos.
export const supabase = createClient<Database>(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})
