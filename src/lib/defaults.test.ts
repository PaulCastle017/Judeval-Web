import { beforeEach, describe, expect, it } from 'vitest'
import { defaultCategoryId, pushRecent, readLast, readRecent, upcomingTrainingDays, upcomingWeekend } from './defaults'

describe('defaultCategoryId', () => {
  const ids = ['cad', 'juv']
  it('prioriza la asignada, luego la última usada y luego la primera', () => {
    expect(defaultCategoryId(ids, ['juv'], 'cad')).toBe('juv')
    expect(defaultCategoryId(ids, [], 'juv')).toBe('juv')
    expect(defaultCategoryId(ids, [], 'otra')).toBe('cad')
    expect(defaultCategoryId([], [], null)).toBe('')
  })
})

describe('fechas sugeridas', () => {
  it('próximos días de entreno (lunes y miércoles), incluido hoy', () => {
    expect(upcomingTrainingDays('2026-11-02', [1, 3])).toEqual(['2026-11-02', '2026-11-04', '2026-11-09'])
    expect(upcomingTrainingDays('2026-11-03', [1, 3], 2)).toEqual(['2026-11-04', '2026-11-09'])
    expect(upcomingTrainingDays('2026-11-03', [])).toEqual([])
  })
  it('próximo fin de semana', () => {
    expect(upcomingWeekend('2026-11-02')).toEqual(['2026-11-07', '2026-11-08']) // lunes
    expect(upcomingWeekend('2026-11-07')).toEqual(['2026-11-07', '2026-11-08']) // sábado
    expect(upcomingWeekend('2026-11-08')).toEqual(['2026-11-08', '2026-11-14']) // domingo
  })
})

// En Node no hay localStorage: sustituto mínimo en memoria
class MemoryStorage {
  private data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, String(v))
  removeItem = (k: string) => void this.data.delete(k)
  clear = () => this.data.clear()
}

describe('recientes', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage() as unknown as Storage
  })
  it('guarda sin duplicados y con el más nuevo primero', () => {
    pushRecent('rival', 'CD Uno')
    pushRecent('rival', 'CD Dos')
    pushRecent('rival', 'cd uno')
    expect(readRecent('rival')).toEqual(['cd uno', 'CD Dos'])
    expect(readLast('rival')).toBe('cd uno')
    pushRecent('rival', '   ')
    expect(readRecent('rival')).toHaveLength(2)
  })
})
