/**
 * Resultado de voley por sets (reglamento al mejor de 5): entre 3 y 5 sets, sin empates,
 * y el partido termina justo cuando un equipo gana su 3.er set (3-0, 3-1 o 3-2).
 * Es la misma regla que aplica la base de datos (public.volley_sets_valid).
 */
export type VolleySet = { for: number; against: number }
export type SetRow = { for: string; against: string }

export type VolleySummary = { won: number; lost: number; finished: boolean; error: string | null }

const MAX_POINTS = 99

export function volleySummary(sets: VolleySet[]): VolleySummary {
  let won = 0
  let lost = 0
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    const bad = (n: number) => !Number.isInteger(n) || n < 0 || n > MAX_POINTS
    if (bad(s.for) || bad(s.against)) return { won, lost, finished: false, error: `Set ${i + 1}: puntos no válidos` }
    if (s.for === s.against) return { won, lost, finished: false, error: `Set ${i + 1}: un set no puede acabar en empate` }
    if (won === 3 || lost === 3) {
      return { won, lost, finished: true, error: `Sobra el set ${i + 1}: el partido ya había terminado` }
    }
    if (s.for > s.against) won++
    else lost++
  }
  const finished = won === 3 || lost === 3
  if (sets.length < 3) return { won, lost, finished: false, error: 'Los 3 primeros sets son obligatorios' }
  if (!finished) return { won, lost, finished, error: `Falta el set ${sets.length + 1}: va ${won}-${lost}` }
  return { won, lost, finished, error: null }
}

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))

/** Sets completos (ambas casillas rellenas) desde el principio, sin huecos. */
function completePrefix(rows: SetRow[]): VolleySet[] {
  const out: VolleySet[] = []
  for (const r of rows) {
    const f = toNumber(r.for)
    const a = toNumber(r.against)
    if (f === null || a === null || Number.isNaN(f) || Number.isNaN(a)) break
    out.push({ for: f, against: a })
  }
  return out
}

/**
 * Cuántas filas de set mostrar en el editor: siempre 3; la 4.ª solo si tras 3 sets
 * va 2-1 (o 1-2) y la 5.ª solo si tras 4 va 2-2. Así no se puede introducir un
 * resultado imposible.
 */
export function setsToShow(rows: SetRow[]): number {
  const done = completePrefix(rows)
  let won = 0
  let lost = 0
  let visible = 3
  for (let i = 0; i < done.length && i < 5; i++) {
    if (done[i].for > done[i].against) won++
    else if (done[i].for < done[i].against) lost++
    if (i >= 2 && i === visible - 1 && won < 3 && lost < 3 && visible < 5) visible++
  }
  return visible
}

/** Convierte lo escrito en el editor en sets válidos, `null` si se deja todo vacío, o un error. */
export function parseSetRows(rows: SetRow[]): { ok: true; sets: VolleySet[] | null } | { ok: false; error: string } {
  const visible = rows.slice(0, setsToShow(rows))
  if (visible.every((r) => r.for.trim() === '' && r.against.trim() === '')) return { ok: true, sets: null }
  for (let i = 0; i < visible.length; i++) {
    if (visible[i].for.trim() === '' || visible[i].against.trim() === '') {
      return { ok: false, error: `Completa el set ${i + 1} (o deja todos vacíos para no registrar resultado)` }
    }
  }
  const sets = completePrefix(visible)
  const summary = volleySummary(sets)
  return summary.error ? { ok: false, error: summary.error } : { ok: true, sets }
}

/** Lee la columna jsonb `sets`; null si no hay o no tiene la forma esperada. */
export function parseSets(value: unknown): VolleySet[] | null {
  if (!Array.isArray(value)) return null
  const sets = value.filter(
    (s): s is VolleySet => !!s && typeof s === 'object' && typeof s.for === 'number' && typeof s.against === 'number',
  )
  return sets.length === value.length && sets.length > 0 ? sets : null
}

export const formatSets = (sets: VolleySet[]) => sets.map((s) => `${s.for}-${s.against}`).join(', ')
