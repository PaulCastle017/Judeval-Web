import { describe, expect, it } from 'vitest'
import { isPastMatch, isPastTraining, matchStatus, trainingStatus } from './eventStatus'

const today = '2026-11-17'

describe('matchStatus', () => {
  const base = { match_date: today, goals_for: null, finished_at: null }
  it('programado: hoy o futuro, sin resultado ni finalizar', () => {
    expect(matchStatus(base, today)).toBe('programado')
    expect(matchStatus({ ...base, match_date: '2026-11-21' }, today)).toBe('programado')
  })
  it('pendiente de cerrar: fecha pasada sin resultado ni finalizar', () => {
    expect(matchStatus({ ...base, match_date: '2026-11-15' }, today)).toBe('pendiente')
  })
  it('jugado: con resultado y sin finalizar (incluido el 0–0 y el de hoy)', () => {
    expect(matchStatus({ ...base, goals_for: 0 }, today)).toBe('jugado')
    expect(matchStatus({ ...base, match_date: '2026-11-15', goals_for: 3 }, today)).toBe('jugado')
  })
  it('finalizado manda sobre todo lo demás', () => {
    expect(matchStatus({ ...base, finished_at: '2026-11-17T20:00:00Z' }, today)).toBe('finalizado')
    expect(matchStatus({ ...base, goals_for: 2, finished_at: '2026-11-17T20:00:00Z' }, today)).toBe('finalizado')
  })
})

describe('trainingStatus', () => {
  const base = { session_date: today, finished_at: null, hasList: false }
  it('programado / pendiente de lista / lista pasada / finalizado', () => {
    expect(trainingStatus(base, today)).toBe('programado')
    expect(trainingStatus({ ...base, session_date: '2026-11-16' }, today)).toBe('pendiente')
    expect(trainingStatus({ ...base, session_date: '2026-11-16', hasList: true }, today)).toBe('lista')
    expect(trainingStatus({ ...base, hasList: true, finished_at: '2026-11-17T19:00:00Z' }, today)).toBe('finalizado')
  })
})

describe('próximos / anteriores', () => {
  it('un partido de hoy pasa a «Jugados» con resultado o al finalizarlo', () => {
    expect(isPastMatch({ match_date: today, goals_for: null, finished_at: null }, today)).toBe(false)
    expect(isPastMatch({ match_date: today, goals_for: 1, finished_at: null }, today)).toBe(true)
    expect(isPastMatch({ match_date: today, goals_for: null, finished_at: 'x' }, today)).toBe(true)
  })
  it('un entrenamiento de hoy pasa a «Anteriores» al finalizarlo (no por pasar lista)', () => {
    expect(isPastTraining({ session_date: today, finished_at: null }, today)).toBe(false)
    expect(isPastTraining({ session_date: today, finished_at: 'x' }, today)).toBe(true)
    expect(isPastTraining({ session_date: '2026-11-16', finished_at: null }, today)).toBe(true)
  })
})
