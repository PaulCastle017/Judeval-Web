import { toMessage } from '../../lib/errors'
import { ConfirmButton, ErrorMessage } from '../../components/ui'
import { useSetFinished } from './useSetFinished'
import type { EventKind } from './eventContext'

/**
 * Bloqueo suave tras «Finalizar»: avisa de que lo de debajo es de solo lectura y permite
 * reabrir para editar (sin borrar la revisión vinculada).
 */
export function LockedNotice({ kind, eventId, what }: { kind: EventKind; eventId: string; what: string }) {
  const reopen = useSetFinished(kind, eventId)
  return (
    <div className="alert alert-info locked-notice" role="status">
      <span>
        🔒 <strong>{kind === 'training' ? 'Entrenamiento finalizado' : 'Partido finalizado'}</strong>: {what} en solo lectura.
      </span>
      {reopen.isError && <ErrorMessage message={toMessage(reopen.error)} />}
      <ConfirmButton className="btn btn-small" confirmText="Sí, reabrir" onConfirm={() => reopen.mutate(false)} disabled={reopen.isPending}>
        Reabrir para editar
      </ConfirmButton>
    </div>
  )
}
