import { describe, expect, it } from 'vitest'
import {
  categorySchema,
  changePasswordSchema,
  commitmentSchema,
  matchResultSchema,
  matchSchema,
  newUserSchema,
  noteSchema,
  parseExercises,
  parseForm,
  playerSchema,
  reviewSchema,
  trainingSchema,
} from './validation'
import { addDays, daysBetween, endTime, isoWeekday, matchOutcome, minutesBetween, playerName, relativeDayLabel, seasonStart } from './format'

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
  it('revisión libre: exige texto y acepta jugadores etiquetados', () => {
    expect(parseForm(reviewSchema, { review_date: '2026-10-31', body: '   ', player_ids: [] }).ok).toBe(false)
    const r = parseForm(reviewSchema, { review_date: '2026-10-31', body: ' Buen ambiente. ', player_ids: [CAT] })
    expect(r.ok && r.data).toEqual({ review_date: '2026-10-31', body: 'Buen ambiente.', player_ids: [CAT] })
    expect(parseForm(reviewSchema, { review_date: '2026-10-31', body: 'x', player_ids: ['no-uuid'] }).ok).toBe(false)
  })
  it('compromiso: estado obligatorio y válido', () => {
    const base = { title: 'Nos respetamos', description: '', category_id: '', sort_order: '1' }
    expect(parseForm(commitmentSchema, { ...base, status: 'cumplido' }).ok).toBe(true)
    expect(parseForm(commitmentSchema, { ...base, status: 'quizas' }).ok).toBe(false)
  })
  it('categoría: fin posterior al inicio', () => {
    const base = { sport: 'voley', name: 'Cadetes', schedule_text: '', training_weekdays: [1, 3], season: '2026/27', sort_order: 1 }
    expect(parseForm(categorySchema, { ...base, start_time: '18:30', end_time: '17:00' }).ok).toBe(false)
    expect(parseForm(categorySchema, { ...base, start_time: '17:00', end_time: '18:30' }).ok).toBe(true)
  })
})

describe('entrenamientos', () => {
  const base = { category_id: CAT, session_date: '2026-11-02', start_time: '17:00', duration_minutes: '90', notes: '' }
  it('normaliza campos vacíos y ejercicios', () => {
    const r = parseForm(trainingSchema, {
      ...base,
      start_time: '',
      duration_minutes: '',
      exercises: [{ name: ' Rondo 4x2 ', minutes: '15', notes: '' }, { name: 'Partido', minutes: '', notes: 'Final' }],
    })
    expect(r.ok && r.data).toEqual({
      category_id: CAT,
      session_date: '2026-11-02',
      start_time: null,
      duration_minutes: null,
      notes: '',
      exercises: [
        { name: 'Rondo 4x2', minutes: 15, notes: '' },
        { name: 'Partido', minutes: null, notes: 'Final' },
      ],
    })
  })
  it('valida duración y nombre de ejercicio', () => {
    expect(parseForm(trainingSchema, { ...base, duration_minutes: '5', exercises: [] }).ok).toBe(false)
    const r = parseForm(trainingSchema, { ...base, exercises: [{ name: '', minutes: '', notes: '' }] })
    expect(!r.ok && r.errors['exercises.0.name']).toBeTruthy()
  })
  it('parseExercises tolera datos guardados y basura', () => {
    expect(parseExercises([{ name: 'Rondo', minutes: null, notes: '' }])).toEqual([{ name: 'Rondo', minutes: null, notes: '' }])
    expect(parseExercises({ no: 'array' })).toEqual([])
    expect(parseExercises(null)).toEqual([])
  })
})

describe('format', () => {
  it('horas y duraciones', () => {
    expect(endTime('17:00', 90)).toBe('18:30')
    expect(endTime('17:00:00', null)).toBe('')
    expect(minutesBetween('18:30:00', '20:00:00')).toBe(90)
    expect(minutesBetween('20:00', '18:30')).toBeNull()
  })
  it('días relativos y diferencias', () => {
    expect(relativeDayLabel('2026-10-31', '2026-10-31')).toBe('Hoy')
    expect(relativeDayLabel('2026-11-01', '2026-10-31')).toBe('Mañana')
    expect(daysBetween('2026-10-17', '2026-10-31')).toBe(14)
  })
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

describe('partidos', () => {
  const base = { category_id: CAT, match_date: '2026-11-07', start_time: '', opponent: ' CD Rival ', location: '', venue: 'visitante', competition: 'Liga · J5', notes: '' }
  it('valida y normaliza el partido', () => {
    const r = parseForm(matchSchema, base)
    expect(r.ok && r.data.opponent).toBe('CD Rival')
    expect(r.ok && r.data.start_time).toBeNull()
    expect(parseForm(matchSchema, { ...base, opponent: '  ' }).ok).toBe(false)
    expect(parseForm(matchSchema, { ...base, venue: 'neutral' }).ok).toBe(false)
  })
  it('el resultado va completo o vacío', () => {
    expect(parseForm(matchResultSchema, { goals_for: '', goals_against: '' }).ok).toBe(true)
    expect(parseForm(matchResultSchema, { goals_for: '3', goals_against: '1' }).ok).toBe(true)
    const r = parseForm(matchResultSchema, { goals_for: '3', goals_against: '' })
    expect(!r.ok && r.errors.goals_against).toBeTruthy()
  })
  it('victoria, empate y derrota', () => {
    expect(matchOutcome(3, 1)).toBe('victoria')
    expect(matchOutcome(2, 2)).toBe('empate')
    expect(matchOutcome(0, 1)).toBe('derrota')
    expect(matchOutcome(null, null)).toBeNull()
  })
})
