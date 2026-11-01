import { useMemo, useState } from 'react'
import { useExercises } from '../../lib/queries'
import type { ExerciseTag } from '../../lib/validation'
import type { Sport } from '../../sport/storage'
import { EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import type { Tables } from '../../types/database'
import { ExerciseCard } from './ExerciseCard'
import { ExerciseForm } from './ExerciseForm'
import { TagFilter } from './ExerciseLibrary'
import { filterExercises } from './exerciseFilters'

/**
 * Desplegable de «+ Añadir ejercicio»: elegir de la biblioteca (con buscador y etiquetas),
 * crear uno nuevo (se guarda en la biblioteca y se añade) o añadir uno rápido sin guardar.
 */
export function ExercisePicker({
  sport,
  onPick,
  onQuick,
  onClose,
}: {
  sport: Sport
  onPick: (exercise: Tables<'exercises'>) => void
  onQuick: () => void
  onClose: () => void
}) {
  const exercises = useExercises(sport)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<ExerciseTag | ''>('')
  const [creating, setCreating] = useState(false)
  const visible = useMemo(() => filterExercises(exercises.data ?? [], search, tag), [exercises.data, search, tag])

  if (creating) {
    return <ExerciseForm sport={sport} compact onSaved={onPick} onCancel={() => setCreating(false)} />
  }

  return (
    <div className="card stack-sm ex-picker" role="dialog" aria-label="Añadir ejercicio">
      <div className="row space-between">
        <strong>Añadir ejercicio</strong>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="row">
        <button type="button" className="btn btn-small" onClick={() => setCreating(true)}>
          ＋ Crear ejercicio nuevo
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onQuick}>
          ⚡ Ejercicio rápido (sin guardar)
        </button>
      </div>
      <input
        type="search"
        placeholder="Buscar en la biblioteca…"
        value={search}
        autoFocus
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      />
      <TagFilter value={tag} onChange={setTag} />
      {exercises.isPending && <Spinner />}
      {exercises.isError && <ErrorMessage error={exercises.error} onRetry={exercises.refetch} />}
      {exercises.isSuccess && exercises.data.length === 0 && (
        <EmptyState>La biblioteca está vacía: crea el primer ejercicio o añade uno rápido.</EmptyState>
      )}
      {exercises.isSuccess && exercises.data.length > 0 && visible.length === 0 && <EmptyState>Ningún ejercicio coincide.</EmptyState>}
      <div className="ex-picker-list">
        {visible.map((e) => (
          <ExerciseCard key={e.id} exercise={e} onClick={() => onPick(e)} />
        ))}
      </div>
    </div>
  )
}
