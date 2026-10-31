import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, useCategories } from '../../lib/queries'
import { endTime, formatTime, relativeDayLabel, SPORT_EMOJI, todayISO } from '../../lib/format'
import { parseExercises } from '../../lib/validation'
import { useSport } from '../../sport/SportProvider'
import { Badge, EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'
import type { Json, Tables } from '../../types/database'

type TrainingRow = {
  id: string
  category_id: string
  session_date: string
  start_time: string | null
  duration_minutes: number | null
  exercises: Json
  notes: string
  attendance: { count: number }[]
}

const SELECT = 'id, category_id, session_date, start_time, duration_minutes, exercises, notes, attendance(count)'

export function TrainingsPage() {
  const sport = useSport()
  const [params, setParams] = useSearchParams()
  const categories = useCategories(sport)
  const requested = params.get('categoria') ?? ''
  const categoryFilter = categories.data?.some((c) => c.id === requested) ? requested : ''
  const ids = categoryFilter ? [categoryFilter] : (categories.data?.map((c) => c.id) ?? [])
  const today = todayISO()

  const upcoming = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['sessions', 'trainings', 'upcoming', sport, categoryFilter, today],
    queryFn: async (): Promise<TrainingRow[]> =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('training_sessions')
              .select(SELECT)
              .in('category_id', ids)
              .gte('session_date', today)
              .order('session_date')
              .order('start_time', { nullsFirst: false }),
          ),
  })
  const past = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['sessions', 'trainings', 'past', sport, categoryFilter, today],
    queryFn: async (): Promise<TrainingRow[]> =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('training_sessions')
              .select(SELECT)
              .in('category_id', ids)
              .lt('session_date', today)
              .order('session_date', { ascending: false })
              .limit(20),
          ),
  })

  const newLink = `/entrenamientos/nuevo${categoryFilter ? `?categoria=${categoryFilter}` : ''}`

  return (
    <div className="stack">
      <PageHeader
        title={`${SPORT_EMOJI[sport]} Entrenamientos`}
        subtitle="Planifica cada sesión: fecha, hora, duración y ejercicios. Después, pasa lista sobre ella."
        actions={
          <Link to={newLink} className="btn btn-primary">
            + Nuevo entrenamiento
          </Link>
        }
      />

      <div className="filters">
        <select
          value={categoryFilter}
          onChange={(e) => setParams(e.target.value ? { categoria: e.target.value } : {}, { replace: true })}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}

      <section className="stack-sm">
        <h2>Próximos</h2>
        {upcoming.isPending && <Spinner />}
        {upcoming.isError && <ErrorMessage error={upcoming.error} onRetry={upcoming.refetch} />}
        {upcoming.isSuccess && upcoming.data.length === 0 && (
          <EmptyState>
            No hay entrenamientos programados. <Link to={newLink}>Crea el primero</Link>.
          </EmptyState>
        )}
        <div className="training-grid">
          {upcoming.data?.map((t) => (
            <TrainingCard key={t.id} training={t} categories={categories.data ?? []} today={today} />
          ))}
        </div>
      </section>

      <section className="stack-sm">
        <h2>Anteriores</h2>
        {past.isPending && <Spinner />}
        {past.isError && <ErrorMessage error={past.error} onRetry={past.refetch} />}
        {past.isSuccess && past.data.length === 0 && <EmptyState>Todavía no hay entrenamientos anteriores.</EmptyState>}
        <div className="training-grid">
          {past.data?.map((t) => (
            <TrainingCard key={t.id} training={t} categories={categories.data ?? []} today={today} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TrainingCard({ training: t, categories, today }: { training: TrainingRow; categories: Tables<'categories'>[]; today: string }) {
  const category = categories.find((c) => c.id === t.category_id)
  const exercises = parseExercises(t.exercises)
  const listTaken = (t.attendance[0]?.count ?? 0) > 0
  const canTakeList = t.session_date <= today

  return (
    <article className="card training-card">
      <header className="training-card-head">
        <span className="training-day">{relativeDayLabel(t.session_date, today)}</span>
        {listTaken && <Badge tone="success">Lista pasada ✓</Badge>}
      </header>
      <p className="training-meta">
        <strong>{category?.name ?? '—'}</strong>
        {t.start_time && (
          <span>
            {' '}
            · {formatTime(t.start_time)}
            {t.duration_minutes && `–${endTime(t.start_time, t.duration_minutes)}`}
          </span>
        )}
        {t.duration_minutes && <span className="muted"> · {t.duration_minutes} min</span>}
      </p>
      {exercises.length > 0 && (
        <p className="muted small">
          {exercises.length} ejercicio{exercises.length === 1 ? '' : 's'}: {exercises.map((e) => e.name).join(' · ')}
        </p>
      )}
      {t.notes && <p className="clamp">{t.notes}</p>}
      <footer className="row">
        <Link to={`/entrenamientos/${t.id}`} className="btn btn-small">
          Editar
        </Link>
        {canTakeList && (
          <Link to={`/asistencia?categoria=${t.category_id}&fecha=${t.session_date}`} className="btn btn-primary btn-small">
            {listTaken ? 'Ver lista' : 'Pasar lista'}
          </Link>
        )}
      </footer>
    </article>
  )
}
