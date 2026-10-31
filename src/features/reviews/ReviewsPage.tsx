import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { staffName, unwrap, usePlayers, useStaff } from '../../lib/queries'
import { formatDate, playerName, SPORT_EMOJI } from '../../lib/format'
import { useSport } from '../../sport/SportProvider'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'

export function ReviewsPage() {
  const sport = useSport()
  const staff = useStaff()
  const players = usePlayers(sport)
  const reviews = useQuery({
    queryKey: ['reviews', sport],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('staff_reviews')
          .select('id, review_date, body, created_by, review_players(player_id)')
          .eq('sport', sport)
          .order('review_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
  const playerById = new Map(players.data?.map((p) => [p.id, p]))

  return (
    <div className="stack">
      <PageHeader
        title={`${SPORT_EMOJI[sport]} Revisiones`}
        subtitle="Lo que hemos visto y queremos resaltar del grupo o de jugadores concretos."
        actions={
          <Link to="/revisiones/nueva" className="btn btn-primary">
            + Nueva revisión
          </Link>
        }
      />
      {reviews.isPending && <Spinner />}
      {reviews.isError && <ErrorMessage error={reviews.error} onRetry={reviews.refetch} />}
      {reviews.isSuccess && reviews.data.length === 0 && <EmptyState>Todavía no hay revisiones. Crea la primera.</EmptyState>}
      {reviews.data?.map((r) => (
        <Link key={r.id} to={`/revisiones/${r.id}`} className="card review-card">
          <header className="row space-between">
            <strong>{formatDate(r.review_date)}</strong>
            <span className="muted small">{staffName(staff.data, r.created_by)}</span>
          </header>
          <p className="clamp review-excerpt">{r.body || <span className="muted">(sin texto)</span>}</p>
          {r.review_players.length > 0 && (
            <ul className="chips">
              {r.review_players.map(({ player_id }) => {
                const p = playerById.get(player_id)
                return p ? (
                  <li key={player_id} className="chip chip-static">
                    {playerName(p)}
                  </li>
                ) : null
              })}
            </ul>
          )}
        </Link>
      ))}
    </div>
  )
}
