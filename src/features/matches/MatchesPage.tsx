import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, useCategories } from '../../lib/queries'
import { formatTime, relativeDayLabel, SPORT_EMOJI, todayISO } from '../../lib/format'
import { useSport } from '../../sport/SportProvider'
import { useWords } from '../../i18n/useWords'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'
import { MatchResultBadge } from './MatchResultBadge'
import type { Tables } from '../../types/database'

export type MatchRow = Pick<
  Tables<'matches'>,
  'id' | 'category_id' | 'match_date' | 'start_time' | 'opponent' | 'location' | 'venue' | 'competition' | 'goals_for' | 'goals_against'
> & { match_players: { count: number }[] }

export const MATCH_SELECT = 'id, category_id, match_date, start_time, opponent, location, venue, competition, goals_for, goals_against, match_players(count)'

export function MatchesPage() {
  const sport = useSport()
  const [params, setParams] = useSearchParams()
  const categories = useCategories(sport)
  const requested = params.get('categoria') ?? ''
  const categoryFilter = categories.data?.some((c) => c.id === requested) ? requested : ''
  const ids = categoryFilter ? [categoryFilter] : (categories.data?.map((c) => c.id) ?? [])
  const today = todayISO()

  const upcoming = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['matches', 'upcoming', sport, categoryFilter, today],
    queryFn: async (): Promise<MatchRow[]> =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('matches')
              .select(MATCH_SELECT)
              .in('category_id', ids)
              .gte('match_date', today)
              .order('match_date')
              .order('start_time', { nullsFirst: false }),
          ),
  })
  const past = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['matches', 'past', sport, categoryFilter, today],
    queryFn: async (): Promise<MatchRow[]> =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('matches')
              .select(MATCH_SELECT)
              .in('category_id', ids)
              .lt('match_date', today)
              .order('match_date', { ascending: false })
              .limit(30),
          ),
  })

  const newLink = `/partidos/nuevo${categoryFilter ? `?categoria=${categoryFilter}` : ''}`

  return (
    <div className="stack">
      <PageHeader
        title={`${SPORT_EMOJI[sport]} Partidos`}
        subtitle="Calendario de partidos, convocatoria, asistencia y resultados."
        actions={
          <Link to={newLink} className="btn btn-primary">
            + Nuevo partido
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
            No hay partidos programados. <Link to={newLink}>Añade el próximo</Link>.
          </EmptyState>
        )}
        <div className="training-grid">
          {upcoming.data?.map((m) => (
            <MatchCard key={m.id} match={m} categories={categories.data ?? []} today={today} />
          ))}
        </div>
      </section>

      <section className="stack-sm">
        <h2>Jugados</h2>
        {past.isPending && <Spinner />}
        {past.isError && <ErrorMessage error={past.error} onRetry={past.refetch} />}
        {past.isSuccess && past.data.length === 0 && <EmptyState>Todavía no hay partidos jugados.</EmptyState>}
        <div className="training-grid">
          {past.data?.map((m) => (
            <MatchCard key={m.id} match={m} categories={categories.data ?? []} today={today} />
          ))}
        </div>
      </section>
    </div>
  )
}

export function MatchCard({ match: m, categories, today }: { match: MatchRow; categories: Tables<'categories'>[]; today: string }) {
  const w = useWords()
  const category = categories.find((c) => c.id === m.category_id)
  const calledUp = m.match_players[0]?.count ?? 0

  return (
    <Link to={`/partidos/${m.id}`} className={`card training-card match-card match-${m.venue}`}>
      <header className="training-card-head">
        <span className="training-day">
          {relativeDayLabel(m.match_date, today)}
          {m.start_time && <span className="muted"> · {formatTime(m.start_time)}</span>}
        </span>
        <MatchResultBadge goalsFor={m.goals_for} goalsAgainst={m.goals_against} />
      </header>
      <p className="match-teams">
        <strong>{category?.name ?? '—'}</strong> <span className="muted">vs</span> <strong>{m.opponent}</strong>
      </p>
      <p className="muted small">
        {m.venue === 'local' ? '🏠 Local' : '✈️ Visitante'}
        {m.location && ` · ${m.location}`}
        {m.competition && ` · ${m.competition}`}
      </p>
      <p className="small">
        {calledUp > 0 ? `${calledUp} ${calledUp === 1 ? w.calledUp : w.calledUpPl}` : <span className="muted">Sin convocatoria</span>}
      </p>
    </Link>
  )
}
