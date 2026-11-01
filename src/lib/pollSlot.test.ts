import { describe, expect, it } from 'vitest'
import { currentPollSlot, madridDateHour, nextTrainingDate } from './pollSlot'

// Instantes en UTC; Madrid es UTC+1 en invierno y UTC+2 en verano.
const at = (iso: string) => new Date(iso)

describe('currentPollSlot (hora de Madrid)', () => {
  it('el martes antes de las 08:00 sigue vigente el turno del domingo anterior', () => {
    // Martes 3/11/2026 07:59 en Madrid (UTC+1) = 06:59 UTC
    expect(currentPollSlot(at('2026-11-03T06:59:00Z'))).toEqual({ slotDate: '2026-11-01', weekday: 'domingo' })
  })
  it('el martes a las 08:00 empieza el turno del martes', () => {
    expect(currentPollSlot(at('2026-11-03T07:00:00Z'))).toEqual({ slotDate: '2026-11-03', weekday: 'martes' })
  })
  it('el turno del martes dura hasta el domingo a las 08:00', () => {
    expect(currentPollSlot(at('2026-11-07T22:00:00Z')).slotDate).toBe('2026-11-03') // sábado noche
    expect(currentPollSlot(at('2026-11-08T06:59:00Z')).slotDate).toBe('2026-11-03') // domingo 07:59
    expect(currentPollSlot(at('2026-11-08T07:00:00Z'))).toEqual({ slotDate: '2026-11-08', weekday: 'domingo' })
  })
  it('lunes: turno del domingo', () => {
    expect(currentPollSlot(at('2026-11-02T12:00:00Z'))).toEqual({ slotDate: '2026-11-01', weekday: 'domingo' })
  })
  it('usa la hora de Madrid aunque el instante caiga en otro día en UTC', () => {
    // Domingo 1/11 00:30 en Madrid = sábado 31/10 23:30 UTC → aún no son las 08:00 del domingo
    expect(currentPollSlot(at('2026-10-31T23:30:00Z')).slotDate).toBe('2026-10-27')
  })
  it('respeta el horario de verano (UTC+2)', () => {
    // Domingo 25/10/2026 es el cambio de hora (a las 03:00 vuelve a las 02:00).
    // Martes 20/10 08:00 en Madrid (verano) = 06:00 UTC
    expect(currentPollSlot(at('2026-10-20T05:59:00Z')).slotDate).toBe('2026-10-18')
    expect(currentPollSlot(at('2026-10-20T06:00:00Z')).slotDate).toBe('2026-10-20')
    // Domingo del cambio: 08:00 en Madrid ya es invierno (UTC+1) = 07:00 UTC
    expect(currentPollSlot(at('2026-10-25T06:59:00Z')).slotDate).toBe('2026-10-20')
    expect(currentPollSlot(at('2026-10-25T07:00:00Z')).slotDate).toBe('2026-10-25')
  })
  it('madridDateHour', () => {
    expect(madridDateHour(at('2026-11-03T07:00:00Z'))).toEqual({ date: '2026-11-03', hour: 8 })
  })
})

describe('nextTrainingDate', () => {
  it('domingo → lunes y martes → miércoles (lunes y miércoles)', () => {
    expect(nextTrainingDate('2026-11-01', [1, 3])).toBe('2026-11-02')
    expect(nextTrainingDate('2026-11-03', [1, 3])).toBe('2026-11-04')
  })
  it('incluye el mismo día y devuelve null sin días', () => {
    expect(nextTrainingDate('2026-11-04', [3])).toBe('2026-11-04')
    expect(nextTrainingDate('2026-11-04', [])).toBeNull()
  })
})
