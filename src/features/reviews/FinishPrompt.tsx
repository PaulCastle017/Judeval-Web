import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toMessage } from '../../lib/errors'
import { ConfirmButton, ErrorMessage } from '../../components/ui'
import { newReviewLink, useEventContext, type EventKind } from './eventContext'
import { useSetFinished } from './useSetFinished'

const NOUN: Record<EventKind, string> = { training: 'entrenamiento', match: 'partido' }

/**
 * Finalizar un entrenamiento o partido. Al hacerlo ofrece «Añadir revisión ahora / Más tarde»
 * (tarjeta en la propia página, sin modales). Si ya está finalizado, permite reabrirlo.
 * `incomplete`: aviso si falta algo (lista sin pasar, partido sin resultado); no bloquea.
 * `showReopen`: false cuando la página ya muestra el aviso de bloqueo con su propio «Reabrir para editar».
 */
export function FinishPrompt({
  kind,
  eventId,
  finishedAt,
  incomplete,
  showReopen = true,
}: {
  kind: EventKind
  eventId: string
  finishedAt: string | null
  incomplete?: string | null
  showReopen?: boolean
}) {
  const ctx = useEventContext(kind, eventId)
  const [justFinished, setJustFinished] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const mutation = useSetFinished(kind, eventId)
  const setFinished = {
    ...mutation,
    mutate: (finished: boolean) =>
      mutation.mutate(finished, {
        onSuccess: () => {
          setJustFinished(finished)
          setDismissed(false)
        },
      }),
  }

  const reviewId = ctx.data?.existingReviewId ?? null
  const isFinished = Boolean(finishedAt) || justFinished

  if (!isFinished) {
    const label = kind === 'training' ? '✅ Finalizar entrenamiento' : '🏁 Finalizar partido'
    return (
      <div className="finish-box">
        {setFinished.isError && <ErrorMessage message={toMessage(setFinished.error)} />}
        {incomplete ? (
          <ConfirmButton
            className="btn btn-touch finish-btn"
            question={`${incomplete} ¿Finalizar igualmente?`}
            confirmText="Sí, finalizar"
            onConfirm={() => setFinished.mutate(true)}
            disabled={setFinished.isPending}
          >
            {label}
          </ConfirmButton>
        ) : (
          <button type="button" className="btn btn-touch finish-btn" onClick={() => setFinished.mutate(true)} disabled={setFinished.isPending}>
            {label}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="stack-sm">
      {justFinished && !dismissed && (
        <section className="card finish-prompt" aria-live="polite">
          <h3>🎉 {NOUN[kind].charAt(0).toUpperCase() + NOUN[kind].slice(1)} finalizado</h3>
          {reviewId ? (
            <>
              <p>Este {NOUN[kind]} ya tiene revisión.</p>
              <div className="row">
                <Link to={`/revisiones/${reviewId}`} className="btn btn-primary btn-touch">
                  Ver revisión
                </Link>
                <button type="button" className="btn btn-ghost btn-touch" onClick={() => setDismissed(true)}>
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <p>¿Añades una revisión con lo que has visto? Puedes hacerlo también más tarde.</p>
              <div className="row">
                <Link to={newReviewLink(kind, eventId)} className="btn btn-primary btn-touch">
                  📝 Añadir revisión ahora
                </Link>
                <button type="button" className="btn btn-ghost btn-touch" onClick={() => setDismissed(true)}>
                  Más tarde
                </button>
              </div>
            </>
          )}
        </section>
      )}
      <div className="row finish-done">
        <span className="badge badge-success">Finalizado ✓</span>
        {setFinished.isError && <ErrorMessage message={toMessage(setFinished.error)} />}
        {showReopen && (
          <ConfirmButton className="btn btn-ghost btn-small" confirmText="Sí, reabrir" onConfirm={() => setFinished.mutate(false)} disabled={setFinished.isPending}>
            Reabrir
          </ConfirmButton>
        )}
      </div>
    </div>
  )
}
