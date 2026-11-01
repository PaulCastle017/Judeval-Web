import { describe, expect, it } from 'vitest'
import { formatSets, parseSetRows, parseSets, setsToShow, volleySummary, type SetRow } from './volley'

const S = (...pairs: [number, number][]) => pairs.map(([f, a]) => ({ for: f, against: a }))
const R = (...pairs: [string, string][]): SetRow[] => pairs.map(([f, a]) => ({ for: f, against: a }))

describe('volleySummary (mejor de 5)', () => {
  it('acepta 3-0, 3-1 y 3-2 (también derrotas)', () => {
    expect(volleySummary(S([25, 20], [25, 18], [25, 22]))).toEqual({ won: 3, lost: 0, finished: true, error: null })
    expect(volleySummary(S([25, 20], [20, 25], [25, 22], [25, 19])).won).toBe(3)
    expect(volleySummary(S([25, 20], [20, 25], [25, 22], [19, 25], [15, 12])).error).toBeNull()
    expect(volleySummary(S([20, 25], [18, 25], [22, 25]))).toMatchObject({ won: 0, lost: 3, error: null })
  })
  it('rechaza empates, menos de 3 sets, partidos sin terminar y sets de más', () => {
    expect(volleySummary(S([25, 25], [25, 20], [25, 20])).error).toMatch(/empate/)
    expect(volleySummary(S([25, 20], [25, 20])).error).toMatch(/3 primeros/)
    expect(volleySummary(S([25, 20], [20, 25], [25, 22])).error).toBe('Falta el set 4: va 2-1')
    expect(volleySummary(S([25, 20], [25, 20], [25, 20], [25, 20])).error).toMatch(/Sobra el set 4/)
    expect(volleySummary(S([25, 20], [25, 20], [100, 20])).error).toMatch(/no válidos/)
  })
})

describe('setsToShow: el editor solo muestra los sets que pueden jugarse', () => {
  it('3 filas al empezar y con 3-0', () => {
    expect(setsToShow(R(['', ''], ['', ''], ['', '']))).toBe(3)
    expect(setsToShow(R(['25', '20'], ['25', '18'], ['25', '22']))).toBe(3)
  })
  it('4.ª fila con 2-1 tras 3 sets y 5.ª con 2-2 tras 4', () => {
    expect(setsToShow(R(['25', '20'], ['20', '25'], ['25', '22']))).toBe(4)
    expect(setsToShow(R(['25', '20'], ['20', '25'], ['25', '22'], ['19', '25']))).toBe(5)
    expect(setsToShow(R(['25', '20'], ['20', '25'], ['25', '22'], ['25', '19']))).toBe(4)
  })
})

describe('parseSetRows', () => {
  it('todo vacío = sin resultado', () => {
    expect(parseSetRows(R(['', ''], ['', ''], ['', ''], ['', ''], ['', '']))).toEqual({ ok: true, sets: null })
  })
  it('ignora filas ocultas y valida', () => {
    const r = parseSetRows(R(['25', '20'], ['25', '18'], ['25', '22'], ['9', '9'], ['', '']))
    expect(r).toEqual({ ok: true, sets: S([25, 20], [25, 18], [25, 22]) })
    expect(parseSetRows(R(['25', '20'], ['', ''], ['', '']))).toMatchObject({ ok: false })
    expect(parseSetRows(R(['25', '20'], ['20', '25'], ['25', '22'], ['', '']))).toMatchObject({ ok: false, error: /set 4/ })
  })
})

describe('parseSets / formatSets', () => {
  it('lee el jsonb y lo formatea', () => {
    expect(parseSets([{ for: 25, against: 20 }])).toEqual(S([25, 20]))
    expect(parseSets(null)).toBeNull()
    expect(parseSets([{ a: 1 }])).toBeNull()
    expect(formatSets(S([25, 20], [18, 25]))).toBe('25-20, 18-25')
  })
})
