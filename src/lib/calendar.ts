/**
 * Calendario compartido (los dos deportes): lógica pura, sin React ni Supabase.
 * Los partidos no se copian a ninguna tabla: se leen de `matches` y se unen aquí con los
 * eventos (`calendar_events`) y las actas sin evento (`meetings`).
 */
import { addDays, isoWeekday, SPORT_EMOJI } from './format'
import { matchStatus, type MatchStatus } from './eventStatus'
import type { Enums } from '../types/database'

type Sport = Enums<'sport_type'>
export type CalendarKind = 'partido' | 'reunion' | 'otro'

export type CalendarItem = {
  key: string
  kind: CalendarKind
  date: string
  time: string | null
  endTime: string | null
  title: string
  detail: string
  /** null = club (los dos deportes) */
  sport: Sport | null
  link: string
  matchStatus?: MatchStatus
  calledUp?: number
}

export const KIND_LABELS: Record<CalendarKind, { label: string; plural: string; icon: string }> = {
  partido: { label: 'Partido', plural: 'Partidos', icon: '🏆' },
  reunion: { label: 'Reunión', plural: 'Reuniones', icon: '👥' },
  otro: { label: 'Otro', plural: 'Otros', icon: '📌' },
}

export const sportTag = (sport: Sport | null) => (sport ? SPORT_EMOJI[sport] : 'Club')

// --- Meses ---------------------------------------------------------------------

/** «2026-11» del día dado. */
export const monthOf = (iso: string) => iso.slice(0, 7)

/** Mes desplazado: addMonths('2026-12', 1) → '2027-01'. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** «2026-11» → «Noviembre de 2026» */
export function monthLabel(month: string): string {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** ¿Es un mes válido (AAAA-MM)? */
export const isMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

/**
 * Semanas (de lunes a domingo) que cubren el mes, con los días de los meses vecinos
 * para completar la primera y la última semana.
 */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`
  const start = addDays(first, 1 - isoWeekday(first))
  const next = `${addMonths(month, 1)}-01`
  const weeks: string[][] = []
  for (let day = start; day < next; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
  }
  return weeks
}

/** Primer y último día de la rejilla del mes (lo que hay que consultar). */
export function gridRange(month: string): { from: string; to: string } {
  const weeks = monthGrid(month)
  return { from: weeks[0][0], to: weeks[weeks.length - 1][6] }
}

// --- Unir y ordenar ---------------------------------------------------------------

export type EventRow = {
  id: string
  title: string
  kind: Enums<'event_kind'>
  sport: Sport | null
  event_date: string
  start_time: string | null
  end_time: string | null
  location: string
}
export type MatchRow = {
  id: string
  match_date: string
  start_time: string | null
  opponent: string
  venue: Enums<'match_venue'>
  location: string
  goals_for: number | null
  finished_at: string | null
  category: { name: string; sport: Sport } | null
  match_players?: { count: number }[]
}
export type MeetingRow = { id: string; title: string; meeting_date: string }

/** Une eventos, partidos (de los dos deportes) y actas sin evento en una sola lista ordenada. */
export function mergeItems(
  { events, matches, meetings }: { events: EventRow[]; matches: MatchRow[]; meetings: MeetingRow[] },
  today: string,
): CalendarItem[] {
  const items: CalendarItem[] = [
    ...events.map(
      (e): CalendarItem => ({
        key: `e-${e.id}`,
        kind: e.kind,
        date: e.event_date,
        time: e.start_time,
        endTime: e.end_time,
        title: e.title,
        detail: e.location,
        sport: e.sport,
        link: `/calendario/evento/${e.id}`,
      }),
    ),
    ...matches.map(
      (m): CalendarItem => ({
        key: `m-${m.id}`,
        kind: 'partido',
        date: m.match_date,
        time: m.start_time,
        endTime: null,
        title: `${m.category?.name ?? ''} vs ${m.opponent}`.trim(),
        detail: [m.venue === 'local' ? '🏠 Local' : '✈️ Visitante', m.location].filter(Boolean).join(' · '),
        sport: m.category?.sport ?? null,
        link: `/partidos/${m.id}`,
        matchStatus: matchStatus(m, today),
        calledUp: m.match_players?.[0]?.count,
      }),
    ),
    // Actas sin evento previo: se ven como reunión en su fecha (las vinculadas ya salen con su evento)
    ...meetings.map(
      (a): CalendarItem => ({
        key: `a-${a.id}`,
        kind: 'reunion',
        date: a.meeting_date,
        time: null,
        endTime: null,
        title: a.title,
        detail: '📝 Acta',
        sport: null,
        link: `/reuniones/${a.id}`,
      }),
    ),
  ]
  return sortItems(items)
}

/** Por fecha y hora (sin hora, al principio del día) y después por título. */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'es'),
  )
}

/** Agrupa por día (respeta el orden de entrada). */
export function itemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const list = map.get(item.date)
    if (list) list.push(item)
    else map.set(item.date, [item])
  }
  return map
}

export type CalendarFilter = { kinds: CalendarKind[]; sport: Sport | 'club' | 'todos' }

/** Filtros del calendario: tipo y deporte. Los eventos de club se ven con cualquier deporte. */
export function filterItems(items: CalendarItem[], { kinds, sport }: CalendarFilter): CalendarItem[] {
  return items.filter(
    (i) => kinds.includes(i.kind) && (sport === 'todos' || (sport === 'club' ? i.sport === null : i.sport === sport || i.sport === null)),
  )
}
