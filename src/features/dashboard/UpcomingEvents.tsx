import { Link } from 'react-router-dom'
import { addDays, formatTime, relativeDayLabel } from '../../lib/format'
import { KIND_LABELS, sportTag } from '../../lib/calendar'
import { wordsForSport } from '../../i18n/useWords'
import { EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import { useCalendar } from '../calendar/useCalendar'

const UPCOMING_DAYS = 14
const MAX_ROWS = 6

/**
 * Inicio · «📅 Próximos eventos» del calendario compartido (sustituye a «Próximos partidos»):
 * partidos de los dos deportes, reuniones y otros eventos de los próximos 14 días.
 */
export function UpcomingEvents({ today }: { today: string }) {
  const calendar = useCalendar(today, addDays(today, UPCOMING_DAYS))
  // Un partido de hoy ya jugado o finalizado deja de ser «próximo»
  const items = (calendar.data ?? []).filter((i) => i.matchStatus !== 'jugado' && i.matchStatus !== 'finalizado').slice(0, MAX_ROWS)

  return (
    <section className="card">
      <div className="card-head">
        <h2>📅 Próximos eventos</h2>
        <Link to="/calendario" className="btn btn-ghost btn-small">
          Ver calendario
        </Link>
      </div>
      {calendar.isPending && <Spinner />}
      {calendar.isError && <ErrorMessage error={calendar.error} onRetry={calendar.refetch} />}
      {calendar.isSuccess && items.length === 0 && <EmptyState>No hay eventos en los próximos {UPCOMING_DAYS} días.</EmptyState>}
      <ul className="list">
        {items.map((i) => {
          const w = i.sport ? wordsForSport(i.sport) : null
          const extra =
            i.kind === 'partido' && w && i.calledUp !== undefined
              ? i.calledUp > 0
                ? `${i.calledUp} ${i.calledUp === 1 ? w.calledUp : w.calledUpPl}`
                : 'sin convocatoria'
              : null
          return (
            <li key={i.key} className={`today-row cal-row cal-${i.kind}`}>
              <span className="list-main">
                <span>
                  <strong className={i.date === today ? 'text-accent' : ''}>{relativeDayLabel(i.date, today)}</strong>
                  {i.time && <span className="muted"> · {formatTime(i.time)}</span>}
                  <span>
                    {' '}
                    · <span aria-hidden="true">{KIND_LABELS[i.kind].icon}</span> <strong>{i.title}</strong>
                  </span>
                </span>
                <span className="muted small">{[sportTag(i.sport), i.detail, extra].filter(Boolean).join(' · ')}</span>
              </span>
              <Link className="btn btn-small" to={i.link}>
                Ver
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
