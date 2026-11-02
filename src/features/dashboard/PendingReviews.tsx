import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, useCategories } from '../../lib/queries'
import { addDays, formatDate } from '../../lib/format'
import type { Sport } from '../../sport/storage'
import { ErrorMessage } from '../../components/ui'
import { newReviewLink } from '../reviews/eventContext'

const DAYS = 7

/** «Más tarde»: entrenamientos y partidos finalizados en los últimos 7 días sin revisión. */
export function PendingReviews({ sport, today }: { sport: Sport; today: string }) {
  const categories = useCategories(sport)
  const ids = categories.data?.map((c) => c.id) ?? []
  const since = addDays(today, -DAYS)
  const catName = new Map(categories.data?.map((c) => [c.id, c.name]))

  const pending = useQuery({
    enabled: categories.isSuccess && ids.length > 0,
    queryKey: ['reviews', 'pending', sport, since],
    queryFn: async () => {
      const [trainings, matches] = await Promise.all([
        supabase
          .from('training_sessions')
          .select('id, category_id, session_date, staff_reviews(id)')
          .in('category_id', ids)
          .not('finished_at', 'is', null)
          .gte('session_date', since),
        supabase
          .from('matches')
          .select('id, category_id, match_date, opponent, staff_reviews(id)')
          .in('category_id', ids)
          .not('finished_at', 'is', null)
          .gte('match_date', since),
      ])
      return [
        ...unwrap(trainings)
          .filter((t) => t.staff_reviews.length === 0)
          .map((t) => ({ key: `t-${t.id}`, date: t.session_date, label: `📋 Entreno ${catName.get(t.category_id) ?? ''}`, link: newReviewLink('training', t.id) })),
        ...unwrap(matches)
          .filter((m) => m.staff_reviews.length === 0)
          .map((m) => ({ key: `m-${m.id}`, date: m.match_date, label: `🏆 ${catName.get(m.category_id) ?? ''} vs ${m.opponent}`, link: newReviewLink('match', m.id) })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    },
  })

  if (pending.isError) return <ErrorMessage error={pending.error} onRetry={pending.refetch} />
  if (!pending.data?.length) return null

  return (
    <section className="card">
      <div className="card-head">
        <h2>📝 Pendientes de revisión</h2>
      </div>
      <p className="muted small">Finalizados en los últimos {DAYS} días que todavía no tienen revisión.</p>
      <ul className="list">
        {pending.data.map((e) => (
          <li key={e.key} className="today-row">
            <span className="list-main">
              <strong>{e.label}</strong>
              <span className="muted small">{formatDate(e.date)}</span>
            </span>
            <Link to={e.link} className="btn btn-small btn-primary">
              Añadir revisión
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
