import { describe, expect, it } from 'vitest'
import { categorySchema, changePasswordSchema, newUserSchema, noteSchema, parseForm, playerSchema, reviewActionSchema } from './validation'
import { addDays, isoWeekday, playerName, seasonStart } from './format'

const CAT = '7d9f0e3a-1b2c-4d5e-8f90-123456789abc'

describe('playerSchema', () => {
  it('acepta un jugador válido y normaliza campos', () => {
    const r = parseForm(playerSchema, {
      category_id: CAT, first_name: '  Ramón ', last_name: '', display_name: 'Ramón (Portero)',
      position: 'portero', status: 'activo', birth_year: '', availability_notes: '', physical_considerations: 'Asma',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.first_name).toBe('Ramón')
      expect(r.data.birth_year).toBeNull()
    }
  })

  it('exige nombre y categoría', () => {
    const r = parseForm(playerSchema, {
      category_id: '', first_name: '  ', last_name: '', display_name: '', position: 'jugador',
      status: 'activo', birth_year: '', availability_notes: '', physical_considerations: '',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.first_name).toBeDefined()
      expect(r.errors.category_id).toBeDefined()
    }
  })

  it('rechaza años de nacimiento fuera de rango', () => {
    const r = parseForm(playerSchema, {
      category_id: CAT, first_name: 'A', last_name: '', display_name: '', position: 'jugador',
      status: 'activo', birth_year: '1800', availability_notes: '', physical_considerations: '',
    })
    expect(r.ok).toBe(false)
  })
})

describe('noteSchema', () => {
  it('rechaza notas vacías', () => {
    const r = parseForm(noteSchema, { type: 'observacion', topic: '', body: '   ', note_date: '2026-10-29', follow_up: false })
    expect(r.ok).toBe(false)
  })
  it('convierte el tema vacío en null', () => {
    const r = parseForm(noteSchema, { type: 'conversacion', topic: '', body: 'Hola', note_date: '2026-10-29', follow_up: true })
    expect(r.ok && r.data.topic).toBeNull()
  })
})

describe('contraseñas y usuarios', () => {
  it('exige letras y números', () => {
    expect(parseForm(changePasswordSchema, { password: 'abcdefgh', confirm: 'abcdefgh' }).ok).toBe(false)
    expect(parseForm(changePasswordSchema, { password: 'abcd1234', confirm: 'abcd1234' }).ok).toBe(true)
  })
  it('detecta confirmación distinta', () => {
    const r = parseForm(changePasswordSchema, { password: 'abcd1234', confirm: 'abcd12345' })
    expect(!r.ok && r.errors.confirm).toBeTruthy()
  })
  it('normaliza el email del nuevo usuario', () => {
    const r = parseForm(newUserSchema, { full_name: 'Ana', email: ' Ana@Judeval.ES ', role: 'coach', password: 'abcd1234' })
    expect(r.ok && r.data.email).toBe('ana@judeval.es')
  })
})

describe('otros esquemas', () => {
  it('acción de revisión: campos opcionales vacíos → null', () => {
    const r = parseForm(reviewActionSchema, { description: 'Hablar con Aitor', player_id: '', owner_id: '', due_date: '' })
    expect(r.ok && r.data).toEqual({ description: 'Hablar con Aitor', player_id: null, owner_id: null, due_date: null })
  })
  it('categoría: fin posterior al inicio', () => {
    const base = { name: 'Cadetes', schedule_text: '', training_weekdays: [1, 3], season: '2026/27', sort_order: 1 }
    expect(parseForm(categorySchema, { ...base, start_time: '18:30', end_time: '17:00' }).ok).toBe(false)
    expect(parseForm(categorySchema, { ...base, start_time: '17:00', end_time: '18:30' }).ok).toBe(true)
  })
})

describe('format', () => {
  it('día ISO de la semana', () => {
    expect(isoWeekday('2026-10-26')).toBe(1) // lunes
    expect(isoWeekday('2026-11-01')).toBe(7) // domingo
  })
  it('suma días y calcula la temporada', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(seasonStart('2027-03-10')).toBe('2026-09-01')
    expect(seasonStart('2026-10-29')).toBe('2026-09-01')
  })
  it('nombre visible del jugador', () => {
    expect(playerName({ first_name: 'David', last_name: '', display_name: 'David (Portero)' })).toBe('David (Portero)')
    expect(playerName({ first_name: 'Iván', last_name: 'Pérez', display_name: '' })).toBe('Iván Pérez')
  })
})
