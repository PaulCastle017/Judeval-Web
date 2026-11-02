import { Link } from 'react-router-dom'
import { useEventContext, newReviewLink, type EventKind } from './eventContext'

/** Acceso «📝 Revisión» en la ficha de un entrenamiento o partido (una revisión por evento). */
export function EventReviewLink({ kind, eventId }: { kind: EventKind; eventId: string }) {
  const ctx = useEventContext(kind, eventId)
  if (!ctx.data) return null
  const reviewId = ctx.data.existingReviewId
  return (
    <div className="card event-review-link">
      <span>
        📝 <strong>Revisión</strong>{' '}
        <span className="muted small">{reviewId ? 'ya escrita' : `sin revisión de este ${kind === 'training' ? 'entrenamiento' : 'partido'}`}</span>
      </span>
      <Link className={`btn btn-small${reviewId ? '' : ' btn-primary'}`} to={reviewId ? `/revisiones/${reviewId}` : newReviewLink(kind, eventId)}>
        {reviewId ? 'Ver revisión' : 'Añadir revisión'}
      </Link>
    </div>
  )
}
