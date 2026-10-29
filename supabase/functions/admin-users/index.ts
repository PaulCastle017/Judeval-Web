// Edge Function: gestión de cuentas del equipo técnico (solo admins).
// La clave service_role la inyecta Supabase como variable de entorno del servidor;
// nunca llega al navegador ni al repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = ['admin', 'coach'] as const
type Role = (typeof ROLES)[number]

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new HttpError(400, `Campo «${field}» no válido`)
  }
  return value.trim()
}

function requireUserId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, 'Usuario no válido')
  return value
}

function requireRole(value: unknown): Role {
  if (!ROLES.includes(value as Role)) throw new HttpError(400, 'Rol no válido')
  return value as Role
}

function requirePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72 || !/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    throw new HttpError(400, 'La contraseña debe tener entre 8 y 72 caracteres, con letras y números')
  }
  return value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) throw new HttpError(500, 'Función mal configurada')

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // 1. Identificar a quien llama a partir de su JWT
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Falta la sesión')
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) throw new HttpError(401, 'Sesión no válida o caducada')
    const callerId = userData.user.id

    // 2. Comprobar que es admin activo
    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('role, active')
      .eq('id', callerId)
      .maybeSingle()
    if (callerError) throw callerError
    if (!caller || !caller.active || caller.role !== 'admin') {
      throw new HttpError(403, 'Solo un administrador puede gestionar usuarios')
    }

    // 3. Validar y ejecutar la acción
    const body = await req.json().catch(() => {
      throw new HttpError(400, 'Cuerpo JSON no válido')
    })
    const action = body?.action

    switch (action) {
      case 'create': {
        const email = requireString(body.email, 'email', 254).toLowerCase()
        if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email no válido')
        const fullName = requireString(body.full_name, 'nombre', 120)
        const role = requireRole(body.role ?? 'coach')
        const password = requirePassword(body.password)

        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (error) {
          if (/already|registered|exists/i.test(error.message)) throw new HttpError(409, 'Ya existe un usuario con ese email')
          throw error
        }

        const { error: profileError } = await admin
          .from('profiles')
          .update({ full_name: fullName, role, active: true })
          .eq('id', created.user.id)
        if (profileError) {
          await admin.auth.admin.deleteUser(created.user.id)
          throw profileError
        }
        return json(200, { ok: true, user_id: created.user.id })
      }

      case 'set_active': {
        const userId = requireUserId(body.user_id)
        if (typeof body.active !== 'boolean') throw new HttpError(400, 'Campo «active» no válido')
        if (userId === callerId) throw new HttpError(400, 'No puedes desactivar tu propia cuenta')

        const { error: banError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: body.active ? 'none' : '876000h',
        })
        if (banError) throw banError
        const { error } = await admin.from('profiles').update({ active: body.active }).eq('id', userId)
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'set_role': {
        const userId = requireUserId(body.user_id)
        const role = requireRole(body.role)
        if (userId === callerId) throw new HttpError(400, 'No puedes cambiar tu propio rol')
        const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'reset_password': {
        const userId = requireUserId(body.user_id)
        const password = requirePassword(body.password)
        const { error } = await admin.auth.admin.updateUserById(userId, { password })
        if (error) throw error
        return json(200, { ok: true })
      }

      default:
        throw new HttpError(400, 'Acción no válida')
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message })
    console.error('admin-users error:', err)
    return json(500, { error: 'Error interno al gestionar el usuario' })
  }
})
