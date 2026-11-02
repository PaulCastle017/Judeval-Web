import { addDays, isoWeekday } from './format'
import { nextTrainingDate } from './pollSlot'

/**
 * Valores por defecto «inteligentes» para crear entrenamientos y partidos desde el móvil.
 */

/** Categoría habitual: la asignada al entrenador, si no la última usada, si no la primera. */
export function defaultCategoryId(categoryIds: string[], assignedIds: string[], lastUsed: string | null): string {
  return categoryIds.find((id) => assignedIds.includes(id)) ?? (lastUsed && categoryIds.includes(lastUsed) ? lastUsed : categoryIds[0] ?? '')
}

/** Próximos días de entreno (incluido hoy) según los días ISO de la categoría. */
export function upcomingTrainingDays(from: string, weekdays: number[], count = 3): string[] {
  const out: string[] = []
  let day = from
  while (out.length < count && weekdays.length > 0) {
    const next = nextTrainingDate(day, weekdays)
    if (!next) break
    out.push(next)
    day = addDays(next, 1)
  }
  return out
}

/** Próximo sábado y domingo (si hoy es fin de semana, empieza hoy). */
export function upcomingWeekend(from: string): string[] {
  const dow = isoWeekday(from)
  if (dow === 7) return [from, addDays(from, 6)]
  const saturday = addDays(from, 6 - dow)
  return [saturday, addDays(saturday, 1)]
}

// --- Recientes y últimos usados (localStorage, sin romper si no está disponible) -----------
const KEY = (kind: string) => `judeval.recent.${kind}`

export function readRecent(kind: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY(kind)) ?? '[]')
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Guarda un valor reciente (sin duplicados, el más nuevo primero, máximo `max`). */
export function pushRecent(kind: string, value: string, max = 8) {
  const v = value.trim()
  if (!v) return
  try {
    const next = [v, ...readRecent(kind).filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, max)
    localStorage.setItem(KEY(kind), JSON.stringify(next))
  } catch {
    /* sin almacenamiento: no hay sugerencias */
  }
}

export const readLast = (kind: string): string | null => readRecent(kind)[0] ?? null

/** Guarda los valores de un partido creado para sugerirlos la próxima vez. */
export function rememberMatch(values: { category_id: string; opponent: string; venue: string; location: string; competition: string; start_time: string | null }) {
  pushRecent('categoria-partido', values.category_id)
  pushRecent('rival', values.opponent)
  pushRecent(`lugar-${values.venue}`, values.location)
  pushRecent('competicion', values.competition)
  if (values.start_time) pushRecent('hora-partido', values.start_time.slice(0, 5))
}
