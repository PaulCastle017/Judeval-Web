import type { Enums, Tables } from '../types/database'

export const NOTE_TYPE_LABELS: Record<Enums<'note_type'>, string> = {
  observacion: 'Observación',
  conversacion: 'Conversación',
  reconocimiento: 'Reconocimiento',
  incidencia: 'Incidencia',
}

// Áreas de conversación de la guía (sección 3)
export const NOTE_TOPIC_LABELS: Record<Enums<'note_topic'>, string> = {
  vida_fuera: 'Su vida fuera del equipo',
  bienestar: 'Bienestar general',
  experiencia: 'Su experiencia en Judeval',
  necesidades: 'Sus necesidades',
  objetivos: 'Sus objetivos',
  grupo: 'Relación con el grupo',
  otro: 'Otro',
}

export const STATUS_LABELS: Record<Enums<'player_status'>, string> = {
  activo: 'Activo',
  lesionado: 'Lesionado',
  baja: 'Baja',
}

export const POSITION_LABELS: Record<Enums<'player_position'>, string> = {
  jugador: 'Jugador',
  portero: 'Portero',
}

export const ATTENDANCE_LABELS: Record<Enums<'attendance_status'>, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
  lesionado: 'Lesionado',
}

export const ROLE_LABELS: Record<Enums<'staff_role'>, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
}

export const WEEKDAYS = [
  { iso: 1, short: 'L', name: 'Lunes' },
  { iso: 2, short: 'M', name: 'Martes' },
  { iso: 3, short: 'X', name: 'Miércoles' },
  { iso: 4, short: 'J', name: 'Jueves' },
  { iso: 5, short: 'V', name: 'Viernes' },
  { iso: 6, short: 'S', name: 'Sábado' },
  { iso: 7, short: 'D', name: 'Domingo' },
]

type PlayerNameFields = Pick<Tables<'players'>, 'first_name' | 'last_name' | 'display_name'>

export function playerName(p: PlayerNameFields): string {
  return p.display_name.trim() || [p.first_name, p.last_name].filter(Boolean).join(' ')
}

/** Fecha local (no UTC) en formato YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: string): number {
  return ((parseISODate(iso).getDay() + 6) % 7) + 1
}

/** Inicio de temporada (1 de septiembre) que contiene la fecha dada. */
export function seasonStart(iso: string): string {
  const d = parseISODate(iso)
  const year = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${year}-09-01`
}

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const longDateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(parseISODate(iso.slice(0, 10))) : ''
}

export function formatLongDate(iso: string): string {
  const s = longDateFmt.format(parseISODate(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ''
}
