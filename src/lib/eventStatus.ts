/**
 * Estados de partidos y entrenamientos, deducidos siempre igual en tarjetas, fichas, Inicio y calendario.
 * No hay estado «en curso»: no hay marcador en directo y en voley solo se guarda el resultado final.
 */
export type MatchStatus = 'programado' | 'pendiente' | 'jugado' | 'finalizado'
export type TrainingStatus = 'programado' | 'pendiente' | 'lista' | 'finalizado'
type Tone = 'neutral' | 'info' | 'success' | 'warn'

export const MATCH_STATUS: Record<MatchStatus, { label: string; tone: Tone }> = {
  programado: { label: 'Programado', tone: 'info' },
  pendiente: { label: 'Pendiente de cerrar', tone: 'warn' },
  jugado: { label: 'Jugado', tone: 'neutral' },
  finalizado: { label: 'Finalizado ✓', tone: 'success' },
}

export const TRAINING_STATUS: Record<TrainingStatus, { label: string; tone: Tone }> = {
  programado: { label: 'Programado', tone: 'info' },
  pendiente: { label: 'Pendiente de lista', tone: 'warn' },
  lista: { label: 'Lista pasada ✓', tone: 'success' },
  finalizado: { label: 'Finalizado ✓', tone: 'success' },
}

/** Finalizado manda; si no, con resultado está jugado; si la fecha ya pasó sin cerrar, pendiente. */
export function matchStatus(m: { match_date: string; goals_for: number | null; finished_at: string | null }, today: string): MatchStatus {
  if (m.finished_at) return 'finalizado'
  if (m.goals_for !== null) return 'jugado'
  if (m.match_date < today) return 'pendiente'
  return 'programado'
}

export function trainingStatus(t: { session_date: string; finished_at: string | null; hasList: boolean }, today: string): TrainingStatus {
  if (t.finished_at) return 'finalizado'
  if (t.hasList) return 'lista'
  if (t.session_date < today) return 'pendiente'
  return 'programado'
}

/** Ya «pasado» para los listados: fecha anterior a hoy, o terminado aunque sea de hoy. */
export const isPastMatch = (m: { match_date: string; goals_for: number | null; finished_at: string | null }, today: string) =>
  m.match_date < today || m.finished_at !== null || m.goals_for !== null
export const isPastTraining = (t: { session_date: string; finished_at: string | null }, today: string) =>
  t.session_date < today || t.finished_at !== null
