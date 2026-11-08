import { useState, type ReactNode } from 'react'
import { toMessage } from '../lib/errors'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function FullPageSpinner() {
  return (
    <div className="center-page">
      <Spinner />
    </div>
  )
}

export function ErrorMessage({ message, error, onRetry }: { message?: string; error?: unknown; onRetry?: () => unknown }) {
  return (
    <div className="alert alert-error" role="alert">
      <span>{message ?? toMessage(error)}</span>
      {onRetry && (
        <button className="btn btn-small" onClick={() => void onRetry()}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert-success" role="status">
      {children}
    </div>
  )
}

/**
 * Estado vacío. Con icono o acción se muestra como bloque (qué pasa + qué hacer);
 * sin ellos, como una línea discreta dentro de una tarjeta.
 */
export function EmptyState({ children, icon, action }: { children: ReactNode; icon?: string; action?: ReactNode }) {
  if (!icon && !action) return <p className="empty">{children}</p>
  return (
    <div className="empty-state">
      {icon && (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p>{children}</p>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  )
}

/** Envuelve un campo de formulario con su etiqueta, ayuda y mensaje de error (fuera del label para no alterar su nombre accesible). */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label>
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Botón que pide confirmación en un segundo clic antes de ejecutar una acción destructiva.
 * `question` (opcional) se muestra encima de los botones al pedir la confirmación; en el móvil
 * pregunta y botones se apilan a todo el ancho (los textos largos ya no desbordan la pantalla).
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText = '¿Seguro? Pulsa para confirmar',
  question,
  className = 'btn btn-danger btn-small',
  disabled,
}: {
  onConfirm: () => unknown
  children: ReactNode
  confirmText?: string
  question?: ReactNode
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  if (armed) {
    return (
      <span className="confirm-group">
        {question && (
          <span className="confirm-question" role="alert">
            {question}
          </span>
        )}
        <button
          type="button"
          className={className}
          disabled={disabled}
          onClick={() => {
            setArmed(false)
            void onConfirm()
          }}
        >
          {confirmText}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setArmed(false)}>
          Cancelar
        </button>
      </span>
    )
  }
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
