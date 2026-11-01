import { addDays, isoWeekday } from './format'

/**
 * Turnos de la encuesta de asistencia por WhatsApp: martes y domingo desde las 08:00
 * (hora de Madrid, sea cual sea la zona horaria del dispositivo).
 * El turno vigente es el más reciente que ya ha empezado: así el recordatorio se
 * rearma solo cada semana y cada turno dura hasta que empieza el siguiente.
 */
export const POLL_TIME_ZONE = 'Europe/Madrid'
export const POLL_HOUR = 8
const POLL_WEEKDAYS: Record<number, PollWeekday> = { 2: 'martes', 7: 'domingo' }

export type PollWeekday = 'martes' | 'domingo'
export type PollSlot = { slotDate: string; weekday: PollWeekday }

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: POLL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Fecha (YYYY-MM-DD) y hora en Madrid para un instante dado. */
export function madridDateHour(now: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(partsFmt.formatToParts(now).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 }
}

export function currentPollSlot(now: Date = new Date()): PollSlot {
  const { date, hour } = madridDateHour(now)
  for (let back = 0; back <= 7; back++) {
    const day = addDays(date, -back)
    const weekday = POLL_WEEKDAYS[isoWeekday(day)]
    if (!weekday) continue
    if (back === 0 && hour < POLL_HOUR) continue // hoy toca, pero aún no son las 08:00
    return { slotDate: day, weekday }
  }
  // Inalcanzable: en 8 días siempre hay un martes o un domingo ya empezado
  throw new Error('Sin turno de encuesta')
}

/** Próximo día de entrenamiento (desde `fromDate`, incluido) según los días ISO de la categoría. */
export function nextTrainingDate(fromDate: string, trainingWeekdays: number[]): string | null {
  if (trainingWeekdays.length === 0) return null
  for (let i = 0; i < 7; i++) {
    const day = addDays(fromDate, i)
    if (trainingWeekdays.includes(isoWeekday(day))) return day
  }
  return null
}
