import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, useCategories } from '../../lib/queries'
import { addDays, formatTime, relativeDayLabel } from '../../lib/format'
import { useWords } from '../../i18n/useWords'
import type { Sport } from '../../sport/storage'
import { EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import { MATCH_SELECT, type MatchRow } from '../matches/MatchesPage'

const UPCOMING_DAYS = 14

export function UpcomingMatches({ sport, today }: { sport: Sport; today: string }) {
  const w = useWords()
  const categories = useCategories(sport)
  const ids = categories.data?.map((c) => c.id) ?? []
  const matches = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['matches', 'dashboard', sport, today],
    queryFn: async (): Promise<MatchRow[]> =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('matches')
              .select(MATCH_SELECT)
              .in('category_id', ids)
              .gte('match_date', today)
              .lte('match_date', addDays(today, UPCOMING_DAYS))
              .order('match_date')
              .order('start_time', { nullsFirst: false })
              .limit(5),
          ),
  })
  const catName = new Map(categories.data?.map((c) => [c.id, c.name]))

  return (
    <section className="card">
      <div className="card-head">
        <h2>🏆 Próximos partidos</h2>
        <Link to="/partidos" className="btn btn-ghost btn-small">
          Ver todos
        </Link>
      </div>
      {(categories.isPending || matches.isPending) && <Spinner />}
      {matches.isError && <ErrorMessage error={matches.error} onRetry={matches.refetch} />}
      {matches.isSuccess && matches.data.length === 0 && (
        <EmptyState>No hay partidos en los próximos {UPCOMING_DAYS} días.</EmptyState>
      )}
      <ul className="list">
        {matches.data?.map((m) => {
          const calledUp = m.match_players[0]?.count ?? 0
          return (
            <li key={m.id} className="today-row">
              <span className="list-main">
                <span>
                  <strong className={m.match_date === today ? 'text-accent' : ''}>{relativeDayLabel(m.match_date, today)}</strong>
                  {m.start_time && <span className="muted"> · {formatTime(m.start_time)}</span>}
                  <span>
                    {' '}
                    · {catName.get(m.category_id)} vs <strong>{m.opponent}</strong>
                  </span>
                </span>
                <span className="muted small">
                  {m.venue === 'local' ? '🏠 Local' : '✈️ Visitante'}
                  {m.location && ` · ${m.location}`} ·{' '}
                  {calledUp > 0 ? `${calledUp} ${calledUp === 1 ? w.calledUp : w.calledUpPl}` : 'sin convocatoria'}
                </span>
              </span>
              <Link className="btn btn-small" to={`/partidos/${m.id}`}>
                Ver
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
