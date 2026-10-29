import { z } from 'zod'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const date = z.string().regex(ISO_DATE, 'Fecha no válida')
const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)

export const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-zA-Z]/, 'Debe contener letras')
  .regex(/\d/, 'Debe contener números')

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Email no válido')),
  password: z.string().min(1, 'Introduce la contraseña'),
})

export const changePasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' })

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Introduce tu nombre').max(120, 'Máximo 120 caracteres'),
})

export const playerSchema = z.object({
  category_id: z.uuid('Elige una categoría'),
  first_name: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres'),
  last_name: optionalText(80),
  display_name: optionalText(80),
  position: z.enum(['jugador', 'portero']),
  status: z.enum(['activo', 'lesionado', 'baja']),
  birth_year: z
    .union([z.literal(''), z.coerce.number().int('Año no válido').min(1990, 'Año no válido').max(2035, 'Año no válido')])
    .transform((v) => (v === '' ? null : v)),
  availability_notes: optionalText(500),
  physical_considerations: optionalText(1000),
})

export const noteSchema = z.object({
  type: z.enum(['observacion', 'conversacion', 'reconocimiento', 'incidencia']),
  topic: z
    .union([z.literal(''), z.enum(['vida_fuera', 'bienestar', 'experiencia', 'necesidades', 'objetivos', 'grupo', 'otro'])])
    .transform((v) => (v === '' ? null : v)),
  body: z.string().trim().min(1, 'Escribe el contenido de la nota').max(4000, 'Máximo 4000 caracteres'),
  note_date: date,
  follow_up: z.boolean(),
})

export const sessionSchema = z.object({
  notes: optionalText(2000),
  closing_question: optionalText(300),
  closing_summary: optionalText(2000),
})

export const reviewSchema = z.object({
  review_date: date,
  integration: optionalText(4000),
  coherence: optionalText(4000),
  positive_behaviors: optionalText(4000),
  conflicts: optionalText(4000),
  privacy: optionalText(4000),
  next_change: optionalText(4000),
})

export const reviewActionSchema = z.object({
  description: z.string().trim().min(1, 'Describe la acción').max(500, 'Máximo 500 caracteres'),
  player_id: z
    .string()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  owner_id: z
    .string()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  due_date: z
    .string()
    .transform((v) => v || null)
    .pipe(date.nullable()),
})

export const commitmentSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: optionalText(500),
  category_id: z
    .string()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  sort_order: z.coerce.number().int().min(0).max(999),
})

const TIME = /^\d{2}:\d{2}(:\d{2})?$/
export const categorySchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres'),
    schedule_text: optionalText(120),
    training_weekdays: z.array(z.number().int().min(1).max(7)),
    start_time: z
      .string()
      .transform((v) => v || null)
      .pipe(z.string().regex(TIME, 'Hora no válida').nullable()),
    end_time: z
      .string()
      .transform((v) => v || null)
      .pipe(z.string().regex(TIME, 'Hora no válida').nullable()),
    season: z.string().trim().min(1, 'Indica la temporada').max(20),
    sort_order: z.coerce.number().int().min(0).max(999),
  })
  .refine((v) => !v.start_time || !v.end_time || v.end_time > v.start_time, {
    path: ['end_time'],
    message: 'La hora de fin debe ser posterior a la de inicio',
  })

export const newUserSchema = z.object({
  full_name: z.string().trim().min(1, 'Introduce el nombre').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Email no válido')),
  role: z.enum(['admin', 'coach']),
  password,
})

export type FieldErrors = Partial<Record<string, string>>

/** Valida y devuelve los datos limpios o un mapa campo → primer error. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form'
    errors[key] ??= issue.message
  }
  return { ok: false, errors }
}
