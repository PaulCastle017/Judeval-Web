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
  body: z.string().trim().min(1, 'Escribe lo que has visto o quieres resaltar').max(8000, 'Máximo 8000 caracteres'),
  player_ids: z.array(z.uuid()).max(100),
})

const TIME = /^\d{2}:\d{2}(:\d{2})?$/
const optionalTime = z
  .string()
  .transform((v) => v || null)
  .pipe(z.string().regex(TIME, 'Hora no válida').nullable())
const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number().int(message).min(min, message).max(max, message)])
    .transform((v) => (v === '' || v === null ? null : v))

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Pon nombre al ejercicio').max(120, 'Máximo 120 caracteres'),
  minutes: optionalInt(1, 300, 'Minutos no válidos'),
  notes: optionalText(300),
})

export const trainingSchema = z.object({
  category_id: z.uuid('Elige una categoría'),
  session_date: date,
  start_time: optionalTime,
  duration_minutes: optionalInt(15, 300, 'Entre 15 y 300 minutos'),
  notes: optionalText(2000),
  exercises: z.array(exerciseSchema).max(30, 'Máximo 30 ejercicios'),
})

export type Exercise = z.output<typeof exerciseSchema>

export const matchSchema = z.object({
  category_id: z.uuid('Elige una categoría'),
  match_date: date,
  start_time: optionalTime,
  opponent: z.string().trim().min(1, 'Indica el rival').max(120, 'Máximo 120 caracteres'),
  location: optionalText(200),
  venue: z.enum(['local', 'visitante']),
  competition: optionalText(120),
  notes: optionalText(2000),
})

export const matchResultSchema = z
  .object({
    goals_for: optionalInt(0, 99, 'Marcador no válido'),
    goals_against: optionalInt(0, 99, 'Marcador no válido'),
  })
  .refine((v) => (v.goals_for === null) === (v.goals_against === null), {
    path: ['goals_against'],
    message: 'Completa los dos marcadores (o deja ambos vacíos)',
  })

/** Lee la columna jsonb `exercises`; si algo no encaja, devuelve lista vacía en vez de romper la pantalla. */
export function parseExercises(value: unknown): Exercise[] {
  const result = z.array(exerciseSchema).safeParse(value)
  return result.success ? result.data : []
}

export const commitmentSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: optionalText(500),
  category_id: z
    .string()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  status: z.enum(['pendiente', 'cumplido', 'no_conseguido']),
  sort_order: z.coerce.number().int().min(0).max(999),
})

export const categorySchema = z
  .object({
    sport: z.enum(['futsal', 'voley']),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres'),
    schedule_text: optionalText(120),
    training_weekdays: z.array(z.number().int().min(1).max(7)),
    start_time: optionalTime,
    end_time: optionalTime,
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
