import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories } from '../../lib/queries'
import { endTime, minutesBetween, todayISO } from '../../lib/format'
import { parseExercises, parseForm, trainingSchema, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { ConfirmButton, ErrorMessage, Field, Spinner } from '../../components/ui'
import type { Tables } from '../../types/database'

const DURATION_PRESETS = [60, 75, 90, 120]

/** /entrenamientos/nuevo (alta) o /entrenamientos/:id (edición). */
export function TrainingEditPage() {
  const { id = '' } = useParams()
  const isNew = id === 'nuevo'
  const sport = useSport()
  const categories = useCategories(sport)
  const session = useQuery({
    enabled: !isNew,
    queryKey: ['sessions', 'training', id],
    queryFn: async () => unwrapMaybe(await supabase.from('training_sessions').select('*').eq('id', id).maybeSingle()),
  })

  if (categories.isPending || (!isNew && session.isPending)) return <Spinner />
  if (categories.isError) return <ErrorMessage error={categories.error} onRetry={categories.refetch} />
  if (session.isError) return <ErrorMessage error={session.error} onRetry={session.refetch} />
  if (!isNew && !session.data) return <ErrorMessage message="Entrenamiento no encontrado." />

  return <TrainingForm key={session.data?.id ?? 'nuevo'} session={isNew ? null : session.data!} categories={categories.data} />
}

type ExerciseRow = { key: number; name: string; minutes: string; notes: string }
let exerciseKey = 0
const newExercise = (name = '', minutes = '', notes = ''): ExerciseRow => ({ key: ++exerciseKey, name, minutes, notes })

function TrainingForm({ session, categories }: { session: Tables<'training_sessions'> | null; categories: Tables<'categories'>[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { profile, isAdmin } = useAuth()

  // Valores iniciales: los de la sesión o, en un alta, los de la categoría (su horario habitual).
  const initialCategory =
    categories.find((c) => c.id === (session?.category_id ?? params.get('categoria'))) ?? categories[0] ?? null
  const [form, setForm] = useState({
    category_id: initialCategory?.id ?? '',
    session_date: session?.session_date ?? params.get('fecha') ?? todayISO(),
    start_time: session ? (session.start_time?.slice(0, 5) ?? '') : (initialCategory?.start_time?.slice(0, 5) ?? ''),
    duration_minutes: String(
      session ? (session.duration_minutes ?? '') : (minutesBetween(initialCategory?.start_time, initialCategory?.end_time) ?? ''),
    ),
    notes: session?.notes ?? '',
  })
  const [exercises, setExercises] = useState<ExerciseRow[]>(() =>
    parseExercises(session?.exercises).map((e) => newExercise(e.name, e.minutes?.toString() ?? '', e.notes)),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [conflictId, setConflictId] = useState<string | null>(null)

  function changeCategory(id: string) {
    const c = categories.find((x) => x.id === id)
    // En un alta, si no se ha tocado la hora/duración, se proponen las de la nueva categoría
    setForm((f) => ({
      ...f,
      category_id: id,
      start_time: !session && c?.start_time ? c.start_time.slice(0, 5) : f.start_time,
      duration_minutes: !session && minutesBetween(c?.start_time, c?.end_time) ? String(minutesBetween(c?.start_time, c?.end_time)) : f.duration_minutes,
    }))
  }

  function updateExercise(key: number, patch: Partial<ExerciseRow>) {
    setExercises((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }
  function moveExercise(index: number, delta: number) {
    setExercises((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof trainingSchema.parse>) => {
      if (session) {
        return unwrap(await supabase.from('training_sessions').update(values).eq('id', session.id).select('id').single())
      }
      return unwrap(await supabase.from('training_sessions').insert(values).select('id').single())
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      navigate('/entrenamientos')
    },
    onError: async (err: { code?: string }, values) => {
      // Ya existe una sesión (entrenamiento o lista) para esa categoría y fecha
      if (err.code === '23505') {
        const existing = await supabase
          .from('training_sessions')
          .select('id')
          .eq('category_id', values.category_id)
          .eq('session_date', values.session_date)
          .maybeSingle()
        setConflictId(existing.data?.id ?? null)
      }
    },
  })

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('training_sessions').delete().eq('id', session!.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance'] })
      navigate('/entrenamientos', { replace: true })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setConflictId(null)
    const parsed = parseForm(trainingSchema, {
      ...form,
      exercises: exercises.map(({ name, minutes, notes }) => ({ name, minutes, notes })),
    })
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  const totalMinutes = exercises.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0)
  const duration = Number(form.duration_minutes) || 0
  const end = endTime(form.start_time, duration)

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Link to="/entrenamientos" className="back-link">
        ← Entrenamientos
      </Link>
      <header className="page-header">
        <h1>{session ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}</h1>
        {session && (
          <Link to={`/asistencia?categoria=${session.category_id}&fecha=${session.session_date}`} className="btn">
            ✅ Pasar lista
          </Link>
        )}
      </header>

      <section className="card stack">
        <div className="grid-3">
          <Field label="Categoría *" error={errors.category_id}>
            <select value={form.category_id} onChange={(e) => changeCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha *" error={errors.session_date}>
            <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
          </Field>
          <Field label="Hora de inicio" error={errors.start_time} hint={end ? `Termina a las ${end}` : undefined}>
            <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </Field>
        </div>
        {/* Grupo propio (no <label>): un label con botones dentro activaría el primero al pulsar el texto */}
        <div className={`field${errors.duration_minutes ? ' has-error' : ''}`}>
          <span className="field-label" id="duration-label">
            Duración (minutos)
          </span>
          <div className="row-tight" role="group" aria-labelledby="duration-label">
            {DURATION_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip${duration === m ? ' chip-on' : ''}`}
                aria-pressed={duration === m}
                onClick={() => setForm({ ...form, duration_minutes: String(m) })}
              >
                {m}′
              </button>
            ))}
            <input
              className="input-narrow"
              inputMode="numeric"
              aria-label="Duración en minutos"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            />
          </div>
          {errors.duration_minutes && (
            <span className="field-error" role="alert">
              {errors.duration_minutes}
            </span>
          )}
        </div>
        <Field label="Notas" error={errors.notes} hint="Objetivo de la sesión, material, recordatorios…">
          <textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </section>

      <section className="card stack-sm">
        <div className="row space-between">
          <h2>Ejercicios (opcional)</h2>
          {exercises.length > 0 && (
            <span className={`small ${duration && totalMinutes > duration ? 'text-danger' : 'muted'}`}>
              {totalMinutes} min{duration ? ` de ${duration}` : ''}
            </span>
          )}
        </div>
        {errors.exercises && <ErrorMessage message={errors.exercises} />}
        {exercises.length === 0 && <p className="muted small">Añade los ejercicios en el orden en que los haréis.</p>}
        <ol className="exercise-list">
          {exercises.map((ex, i) => (
            <li key={ex.key} className="exercise-row">
              <span className="exercise-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="exercise-fields">
                <input
                  aria-label={`Ejercicio ${i + 1}: nombre`}
                  placeholder="Nombre del ejercicio (p. ej. Rondo 4×2)"
                  maxLength={120}
                  value={ex.name}
                  onChange={(e) => updateExercise(ex.key, { name: e.target.value })}
                  className={errors[`exercises.${i}.name`] ? 'input-error' : ''}
                />
                <input
                  aria-label={`Ejercicio ${i + 1}: minutos`}
                  placeholder="min"
                  inputMode="numeric"
                  className="input-narrow"
                  value={ex.minutes}
                  onChange={(e) => updateExercise(ex.key, { minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                />
                <input
                  aria-label={`Ejercicio ${i + 1}: notas`}
                  placeholder="Notas (opcional)"
                  maxLength={300}
                  value={ex.notes}
                  onChange={(e) => updateExercise(ex.key, { notes: e.target.value })}
                  className="exercise-notes"
                />
                {(errors[`exercises.${i}.name`] || errors[`exercises.${i}.minutes`]) && (
                  <span className="field-error exercise-error">{errors[`exercises.${i}.name`] ?? errors[`exercises.${i}.minutes`]}</span>
                )}
              </div>
              <div className="exercise-actions">
                <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => moveExercise(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Bajar"
                  disabled={i === exercises.length - 1}
                  onClick={() => moveExercise(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label="Quitar ejercicio"
                  onClick={() => setExercises((list) => list.filter((e) => e.key !== ex.key))}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <button
            type="button"
            className="btn btn-small"
            disabled={exercises.length >= 30}
            onClick={() => setExercises((list) => [...list, newExercise()])}
          >
            + Añadir ejercicio
          </button>
        </div>
      </section>

      {conflictId && (
        <div className="alert alert-error" role="alert">
          <span>Ya hay un entrenamiento o una lista para esa categoría en esa fecha.</span>
          <Link to={`/entrenamientos/${conflictId}`} className="btn btn-small">
            Abrirlo
          </Link>
        </div>
      )}
      {save.isError && !conflictId && (save.error as { code?: string }).code !== '23505' && (
        <ErrorMessage message={toMessage(save.error)} />
      )}
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}

      <div className="row sticky-actions">
        <button className="btn btn-primary btn-large" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : session ? 'Guardar cambios' : 'Crear entrenamiento'}
        </button>
        <Link to="/entrenamientos" className="btn btn-ghost">
          Cancelar
        </Link>
        {session && (isAdmin || session.created_by === profile?.id) && (
          <ConfirmButton
            onConfirm={() => remove.mutate()}
            confirmText="Borrar (también su lista de asistencia)"
            disabled={remove.isPending}
          >
            Borrar
          </ConfirmButton>
        )}
      </div>
    </form>
  )
}
