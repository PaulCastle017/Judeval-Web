import { FunctionsHttpError } from '@supabase/supabase-js'

const PG_MESSAGES: Record<string, string> = {
  '42501': 'No tienes permiso para realizar esta acción.',
  '23505': 'Ya existe un registro con esos datos.',
  '23514': 'Algún dato no es válido (revisa longitudes y campos obligatorios).',
  '23503': 'No se puede completar: hay datos relacionados que lo impiden.',
  '23502': 'Falta un dato obligatorio.',
  '22P02': 'Algún dato tiene un formato no válido.',
  PGRST116: 'No se ha encontrado el registro.',
  PGRST301: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
}

const AUTH_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/user is banned/i, 'Esta cuenta está desactivada. Habla con el coordinador.'],
  [/email not confirmed/i, 'El email de esta cuenta no está confirmado.'],
  [/password should be|weak password/i, 'La contraseña es demasiado débil: mínimo 8 caracteres, con letras y números.'],
  [/same.*password|different from the old/i, 'La nueva contraseña debe ser distinta de la actual.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera un momento y vuelve a probar.'],
  [/failed to fetch|networkerror|load failed/i, 'No hay conexión con el servidor. Revisa tu conexión a Internet.'],
  [/jwt expired/i, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'],
]

/** Convierte cualquier error (Postgres, Auth, red…) en un mensaje legible en español. */
export function toMessage(err: unknown): string {
  if (!err) return 'Error desconocido.'
  if (typeof err === 'string') return err
  const e = err as { code?: string; message?: string }
  if (e.code && PG_MESSAGES[e.code]) return PG_MESSAGES[e.code]
  const msg = e.message ?? String(err)
  for (const [re, text] of AUTH_MESSAGES) if (re.test(msg)) return text
  if (/row-level security/i.test(msg)) return PG_MESSAGES['42501']
  return msg || 'Se ha producido un error inesperado.'
}

/** Extrae el mensaje que devuelve una Edge Function en { error }. */
export async function functionErrorMessage(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json()
      if (body?.error) return String(body.error)
    } catch {
      /* respuesta sin JSON */
    }
  }
  return toMessage(err)
}
