import { describe, expect, it } from 'vitest'
import { addMonths, filterItems, gridRange, isMonth, itemsByDay, mergeItems, monthGrid, type EventRow, type MatchRow } from './calendar'

describe('monthGrid', () => {
  it('semanas de lunes a domingo que cubren el mes', () => {
    const weeks = monthGrid('2026-11') // 1 de noviembre de 2026 es domingo
    expect(weeks[0][0]).toBe('2026-10-26')
    expect(weeks[0][6]).toBe('2026-11-01')
    expect(weeks[weeks.length - 1][6]).toBe('2026-12-06')
    expect(weeks).toHaveLength(6)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
  it('febrero que empieza en lunes y acaba en domingo: 4 semanas justas', () => {
    expect(monthGrid('2027-02')).toHaveLength(4) // 1 feb 2027 es lunes; no bisiesto
    expect(monthGrid('2027-02')[3][6]).toBe('2027-02-28')
  })
  it('febrero bisiesto incluye el 29', () => {
    expect(monthGrid('2028-02').flat()).toContain('2028-02-29')
  })
  it('rango a consultar = rejilla completa', () => {
    expect(gridRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' })
  })
})

describe('meses', () => {
  it('addMonths cruza años en ambos sentidos', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 0)).toBe('2026-11')
  })
  it('isMonth valida AAAA-MM', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('nov')).toBe(false)
    expect(isMonth(null)).toBe(false)
  })
})

const event = (over: Partial<EventRow> = {}): EventRow => ({
  id: 'e1',
  title: 'Reunión de la Estructura',
  kind: 'reunion',
  sport: null,
  event_date: '2026-11-20',
  start_time: '19:00:00',
  end_time: null,
  location: 'Sede',
  ...over,
})
const match = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'm1',
  match_date: '2026-11-21',
  start_time: '10:00:00',
  opponent: 'CV Prueba',
  venue: 'visitante',
  location: 'Pabellón',
  goals_for: null,
  finished_at: null,
  category: { name: 'Cadetes', sport: 'voley' },
  match_players: [{ count: 9 }],
  ...over,
})

describe('mergeItems', () => {
  const items = mergeItems(
    { events: [event()], matches: [match()], meetings: [{ id: 'a1', title: 'Acta suelta', meeting_date: '2026-11-20' }] },
    '2026-11-17',
  )
  it('une eventos, partidos y actas, ordenados por fecha y hora (sin hora primero)', () => {
    expect(items.map((i) => i.key)).toEqual(['a-a1', 'e-e1', 'm-m1'])
  })
  it('el partido conserva deporte, estado, convocados y enlace a su ficha', () => {
    const m = items.find((i) => i.kind === 'partido')!
    expect(m).toMatchObject({ sport: 'voley', title: 'Cadetes vs CV Prueba', link: '/partidos/m1', matchStatus: 'programado', calledUp: 9 })
  })
  it('el acta sin evento se ve como reunión de club que enlaza al acta', () => {
    expect(items[0]).toMatchObject({ kind: 'reunion', sport: null, link: '/reuniones/a1' })
  })
  it('agrupa por día', () => {
    const byDay = itemsByDay(items)
    expect(byDay.get('2026-11-20')).toHaveLength(2)
    expect(byDay.get('2026-11-21')).toHaveLength(1)
  })
})

describe('filterItems', () => {
  const items = mergeItems(
    { events: [event(), event({ id: 'e2', kind: 'otro', sport: 'futsal', title: 'Torneo' })], matches: [match()], meetings: [] },
    '2026-11-17',
  )
  it('por tipo', () => {
    expect(filterItems(items, { kinds: ['partido'], sport: 'todos' }).map((i) => i.key)).toEqual(['m-m1'])
  })
  it('por deporte: los de club se ven siempre; «Club» solo muestra los de club', () => {
    const all = ['partido', 'reunion', 'otro'] as const
    expect(filterItems(items, { kinds: [...all], sport: 'futsal' }).map((i) => i.key)).toEqual(['e-e1', 'e-e2'])
    expect(filterItems(items, { kinds: [...all], sport: 'voley' }).map((i) => i.key)).toEqual(['e-e1', 'm-m1'])
    expect(filterItems(items, { kinds: [...all], sport: 'club' }).map((i) => i.key)).toEqual(['e-e1'])
  })
})
