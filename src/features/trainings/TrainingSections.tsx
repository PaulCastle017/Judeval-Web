import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { endTime, EXERCISE_TAG_LABELS, formatLongDate, formatTime, todayISO } from '../../lib/format'
import { upcomingTrainingDays } from '../../lib/defaults'
import { useSport } from '../../sport/SportProvider'
import { CategoryCards, DateChips, DurationChips, TimeChips } from '../../components/pickers'
import { ErrorMessage, Field } from '../../components/ui'
import { ExerciseThumb, TagChips, VideoPreview } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'
import { exerciseFromLibrary, newExercise, type ExerciseRow, type TrainingFormApi } from './useTrainingForm'

const MINUTE_PRESETS = [5, 10, 15, 20]

/** Aviso temprano: ya hay un entrenamiento (o una lista) de esa categoría ese día. */
export function ConflictWarning({ t }: { t: TrainingFormApi }) {
  if (!t.conflictId) return null
  return (
    <div className="alert alert-error" role="alert">
      <span>Ya hay un entrenamiento o una lista para esa categoría en esa fecha.</span>
      <Link to={`/entrenamientos/${t.conflictId}`} className="btn btn-small">
        Abrirlo
      </Link>
    </div>
  )
}

/** ¿Cuándo? Categoría, fecha, hora y duración con selectores táctiles. */
export function WhenSection({ t }: { t: TrainingFormApi }) {
  const today = todayISO()
  const weekdays = t.category?.training_weekdays ?? []
  const dateOptions = [today, ...upcomingTrainingDays(today, weekdays, 3)]
  if (t.session && !dateOptions.includes(t.form.session_date)) dateOptions.push(t.form.session_date)
  const end = endTime(t.form.start_time, t.duration)

  return (
    <div className="stack">
      <CategoryCards categories={t.categories} value={t.form.category_id} onChange={t.changeCategory} label="Categoría *" />
      {t.errors.category_id && <span className="field-error">{t.errors.category_id}</span>}
      <DateChips value={t.form.session_date} onChange={(d) => t.setField('session_date', d)} suggestions={dateOptions} label="Fecha *" error={t.errors.session_date} />
      <TimeChips
        value={t.form.start_time}
        onChange={(v) => t.setField('start_time', v)}
        suggestions={[t.category?.start_time ?? '']}
        label={end ? `Hora de inicio · termina a las ${end}` : 'Hora de inicio'}
      />
      <DurationChips value={t.form.duration_minutes} onChange={(v) => t.setField('duration_minutes', v)} error={t.errors.duration_minutes} />
      <ConflictWarning t={t} />
    </div>
  )
}

export function NotesField({ t }: { t: TrainingFormApi }) {
  return (
    <Field label="Notas de la sesión" error={t.errors.notes} hint="Objetivo, material, recordatorios…">
      <textarea rows={3} maxLength={2000} value={t.form.notes} onChange={(e) => t.setField('notes', e.target.value)} />
    </Field>
  )
}

/** Ejercicios: tarjetas con miniatura, minutos (chips), notas y orden; «＋ Añadir» abre la biblioteca. */
export function ExercisesSection({ t }: { t: TrainingFormApi }) {
  const sport = useSport()
  const [picking, setPicking] = useState(false)
  // Reordenar arrastrando el asa ⠿ (además de ↑↓)
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const { exercises, errors } = t

  return (
    <div className="stack-sm">
      <div className="row space-between">
        <span className="field-label">Ejercicios</span>
        {exercises.length > 0 && (
          <span className={`small ${t.duration && t.totalMinutes > t.duration ? 'text-danger' : 'muted'}`}>
            {t.totalMinutes} min{t.duration ? ` de ${t.duration}` : ''}
          </span>
        )}
      </div>
      {exercises.length > 0 && <TimeBar exercises={exercises} duration={t.duration} />}
      {errors.exercises && <ErrorMessage message={errors.exercises} />}
      {exercises.length === 0 && !picking && (
        <p className="muted small">Añade los ejercicios en el orden en que los haréis: desde la biblioteca, uno nuevo o uno rápido.</p>
      )}
      <ol className="exercise-list">
        {exercises.map((ex, i) => (
          <li key={ex.key} data-ex-index={i} className={`exercise-row${dragOver === i ? ' exercise-drop' : ''}`}>
            <span
              className="exercise-drag"
              title="Arrastra para reordenar"
              aria-hidden="true"
              onPointerDown={(e) => {
                dragFrom.current = i
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (dragFrom.current === null) return
                const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-ex-index]')
                setDragOver(over ? Number(over.dataset.exIndex) : null)
              }}
              onPointerUp={() => {
                const from = dragFrom.current
                dragFrom.current = null
                if (from !== null && dragOver !== null && dragOver !== from) t.moveExercise(from, dragOver - from)
                setDragOver(null)
              }}
              onPointerCancel={() => {
                dragFrom.current = null
                setDragOver(null)
              }}
            >
              ⠿
            </span>
            <span className="exercise-num" aria-hidden="true">
              {i + 1}
            </span>
            <ExerciseThumb url={ex.url} size="sm" />
            <div className="exercise-fields">
              <input
                aria-label={`Ejercicio ${i + 1}: nombre`}
                placeholder="Nombre del ejercicio (p. ej. Rondo 4×2)"
                maxLength={120}
                value={ex.name}
                onChange={(e) => t.updateExercise(ex.key, { name: e.target.value })}
                className={errors[`exercises.${i}.name`] ? 'input-error' : ''}
              />
              <div className="row-tight" role="group" aria-label={`Duración del ejercicio ${i + 1}`}>
                {MINUTE_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chip chip-sm${Number(ex.minutes) === m ? ' chip-on' : ''}`}
                    aria-pressed={Number(ex.minutes) === m}
                    onClick={() => t.updateExercise(ex.key, { minutes: String(m) })}
                  >
                    {m}′
                  </button>
                ))}
                <input
                  aria-label={`Ejercicio ${i + 1}: minutos`}
                  placeholder="min"
                  inputMode="numeric"
                  className="input-narrow"
                  value={ex.minutes}
                  onChange={(e) => t.updateExercise(ex.key, { minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                />
              </div>
              <input
                aria-label={`Ejercicio ${i + 1}: notas`}
                placeholder="Notas para este entrenamiento (opcional)"
                maxLength={300}
                value={ex.notes}
                onChange={(e) => t.updateExercise(ex.key, { notes: e.target.value })}
                className="exercise-notes"
              />
              <TagChips tags={ex.tags} />
              {(ex.url || ex.description) && (
                <details className="exercise-more">
                  <summary>{ex.url ? 'Ver vídeo' : 'Ver explicación'}</summary>
                  <VideoPreview url={ex.url} />
                  {ex.description && <p className="pre small">{ex.description}</p>}
                </details>
              )}
              {(errors[`exercises.${i}.name`] || errors[`exercises.${i}.minutes`]) && (
                <span className="field-error exercise-error">{errors[`exercises.${i}.name`] ?? errors[`exercises.${i}.minutes`]}</span>
              )}
            </div>
            <div className="exercise-actions">
              <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => t.moveExercise(i, -1)}>
                ↑
              </button>
              <button type="button" className="icon-btn" aria-label="Bajar" disabled={i === exercises.length - 1} onClick={() => t.moveExercise(i, 1)}>
                ↓
              </button>
              <button type="button" className="icon-btn icon-btn-danger" aria-label="Quitar ejercicio" onClick={() => t.removeExercise(ex.key)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      {picking ? (
        <ExercisePicker
          sport={sport}
          onClose={() => setPicking(false)}
          onQuick={() => {
            t.addExercise(newExercise())
            setPicking(false)
          }}
          onPick={(e) => {
            t.addExercise(exerciseFromLibrary(e))
            setPicking(false)
          }}
        />
      ) : (
        <button type="button" className="btn btn-touch add-exercise-btn" disabled={exercises.length >= 30} onClick={() => setPicking(true)}>
          + Añadir ejercicio
        </button>
      )}
    </div>
  )
}

/** Vista previa de cómo quedará el entrenamiento (paso «Resumen» del asistente). */
export function TrainingSummary({ t }: { t: TrainingFormApi }) {
  return (
    <article className="card training-card summary-card">
      <header className="training-card-head">
        <span className="training-day">{formatLongDate(t.form.session_date)}</span>
      </header>
      <p className="training-meta">
        <strong>{t.category?.name ?? '—'}</strong>
        {t.form.start_time && (
          <span>
            {' '}
            · {formatTime(t.form.start_time)}
            {t.duration ? `–${endTime(t.form.start_time, t.duration)}` : ''}
          </span>
        )}
        {t.duration > 0 && <span className="muted"> · {t.duration} min</span>}
      </p>
      {t.exercises.length > 0 ? (
        <ol className="exercise-summary">
          {t.exercises.map((ex) => (
            <li key={ex.key} className="exercise-summary-row">
              <ExerciseThumb url={ex.url} size="sm" />
              <strong>{ex.name || 'Ejercicio sin nombre'}</strong>
              {ex.minutes && <span className="muted"> · {ex.minutes} min</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">Sin ejercicios: podrás añadirlos después.</p>
      )}
      {t.exercises.length > 0 && <TimeBar exercises={t.exercises} duration={t.duration} />}
    </article>
  )
}

/** Barra de tiempo: cada ejercicio ocupa su parte de la duración, coloreado por su primera etiqueta. */
export function TimeBar({ exercises, duration }: { exercises: ExerciseRow[]; duration: number }) {
  const total = exercises.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0)
  const scale = Math.max(total, duration, 1)
  return (
    <div className="time-bar" role="img" aria-label={`${total} minutos planificados${duration ? ` de ${duration}` : ''}`}>
      {exercises
        .filter((e) => Number(e.minutes) > 0)
        .map((e) => (
          <span
            key={e.key}
            className={`time-seg tag-bg-${e.tags[0] ?? 'none'}`}
            style={{ width: `${(Number(e.minutes) / scale) * 100}%` }}
            title={`${e.name || 'Ejercicio'} · ${e.minutes} min${e.tags[0] ? ` · ${EXERCISE_TAG_LABELS[e.tags[0]].label}` : ''}`}
          />
        ))}
      {duration > total && <span className="time-seg time-free" style={{ width: `${((duration - total) / scale) * 100}%` }} />}
    </div>
  )
}
