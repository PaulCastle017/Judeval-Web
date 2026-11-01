import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useExercises, useStaff } from '../../lib/queries'
import { EXERCISE_TAG_LABELS } from '../../lib/format'
import { EXERCISE_TAGS, type ExerciseTag } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import type { Sport } from '../../sport/storage'
import { ConfirmButton, EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import type { Tables } from '../../types/database'
import { ExerciseCard, TagChips, VideoPreview } from './ExerciseCard'
import { ExerciseForm } from './ExerciseForm'
import { filterExercises } from './exerciseFilters'


export function TagFilter({ value, onChange }: { value: ExerciseTag | ''; onChange: (t: ExerciseTag | '') => void }) {
  return (
    <div className="chips" role="group" aria-label="Filtrar por etiqueta">
      <button type="button" className={`chip${value === '' ? ' chip-on' : ''}`} onClick={() => onChange('')}>
        Todas
      </button>
      {EXERCISE_TAGS.map((t) => (
        <button key={t} type="button" className={`chip${value === t ? ' chip-on' : ''}`} onClick={() => onChange(value === t ? '' : t)}>
          {EXERCISE_TAG_LABELS[t].icon} {EXERCISE_TAG_LABELS[t].label}
        </button>
      ))}
    </div>
  )
}

/** Pestaña «Biblioteca de ejercicios»: compartida por el equipo técnico del deporte. */
export function ExerciseLibrary({ sport }: { sport: Sport }) {
  const exercises = useExercises(sport)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<ExerciseTag | ''>('')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const visible = useMemo(() => filterExercises(exercises.data ?? [], search, tag), [exercises.data, search, tag])
  const open = exercises.data?.find((e) => e.id === openId)

  return (
    <div className="stack">
      <div className="row space-between">
        <p className="muted small">Guarda vídeos de YouTube o Instagram, o explicaciones escritas, y reutilízalos al preparar entrenamientos.</p>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nuevo ejercicio
          </button>
        )}
      </div>
      {creating && <ExerciseForm sport={sport} onSaved={(e) => (setCreating(false), setOpenId(e.id))} onCancel={() => setCreating(false)} />}

      <input type="search" placeholder="Buscar ejercicio…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <TagFilter value={tag} onChange={setTag} />

      {exercises.isPending && <Spinner />}
      {exercises.isError && <ErrorMessage error={exercises.error} onRetry={exercises.refetch} />}
      {exercises.isSuccess && exercises.data.length === 0 && !creating && (
        <EmptyState>La biblioteca está vacía. Añade el primer ejercicio.</EmptyState>
      )}
      {exercises.isSuccess && exercises.data.length > 0 && visible.length === 0 && <EmptyState>Ningún ejercicio coincide con la búsqueda.</EmptyState>}

      {open && <ExerciseDetail key={open.id} exercise={open} sport={sport} onClose={() => setOpenId(null)} />}

      <div className="ex-grid">
        {visible.map((e) => (
          <ExerciseCard key={e.id} exercise={e} selected={e.id === openId} onClick={() => setOpenId(e.id === openId ? null : e.id)} />
        ))}
      </div>
    </div>
  )
}

function ExerciseDetail({ exercise, sport, onClose }: { exercise: Tables<'exercises'>; sport: Sport; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  const [editing, setEditing] = useState(false)
  const canEdit = isAdmin || exercise.created_by === profile?.id

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('exercises').delete().eq('id', exercise.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onClose()
    },
  })

  if (editing) return <ExerciseForm sport={sport} exercise={exercise} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />

  return (
    <article className="card stack-sm ex-detail" aria-label={exercise.title}>
      <header className="row space-between">
        <h2>{exercise.title}</h2>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <TagChips tags={exercise.tags} />
      <VideoPreview url={exercise.url} />
      {exercise.description && <p className="pre">{exercise.description}</p>}
      <p className="muted small">
        {exercise.default_minutes ? `${exercise.default_minutes} min habituales · ` : ''}Añadido por {staffName(staff.data, exercise.created_by)}
      </p>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      {canEdit && (
        <div className="row">
          <button type="button" className="btn btn-small" onClick={() => setEditing(true)}>
            Editar
          </button>
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar de la biblioteca" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        </div>
      )}
      <p className="muted small">Editar o borrar un ejercicio no cambia los entrenamientos en los que ya se usó.</p>
    </article>
  )
}
