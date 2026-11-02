import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export type WizardStep = {
  id: string
  title: string
  content: ReactNode
  /** Comprobación pura (sin efectos): ¿se puede llegar más allá de este paso? Se usa al pintar. */
  isComplete?: () => boolean
  /** Valida al pulsar «Siguiente»: puede marcar errores en el formulario y devuelve el mensaje. */
  validate?: () => string | null
}

/**
 * Asistente por pasos para el móvil: progreso arriba, un paso por pantalla y barra
 * inferior con «Atrás» / «Siguiente». El paso va en la URL (?paso=) para que el botón
 * «atrás» del móvil retroceda de paso en vez de salir del formulario.
 */
export function Wizard({
  steps,
  finishLabel,
  finishing,
  onFinish,
  onCancel,
  footerExtra,
}: {
  steps: WizardStep[]
  finishLabel: string
  finishing?: boolean
  onFinish: () => void
  onCancel: () => void
  footerExtra?: ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const requested = Math.min(Math.max(Number(params.get('paso') ?? 1) || 1, 1), steps.length) - 1
  // No se puede saltar a un paso posterior si alguno anterior no está completo (p. ej. al recargar)
  const firstInvalid = steps.slice(0, requested).findIndex((s) => s.isComplete && !s.isComplete())
  const index = firstInvalid === -1 ? requested : firstInvalid
  const step = steps[index]
  const isLast = index === steps.length - 1

  function goTo(i: number) {
    setError(null)
    const next = new URLSearchParams(params)
    if (i === 0) next.delete('paso')
    else next.set('paso', String(i + 1))
    setParams(next) // entrada nueva en el historial: «atrás» del móvil vuelve al paso anterior
    window.scrollTo({ top: 0 })
  }

  function next() {
    const message = step.validate?.() ?? null
    if (message) return setError(message)
    if (isLast) return onFinish()
    goTo(index + 1)
  }

  return (
    <div className="wizard">
      <div className="wizard-progress" aria-label={`Paso ${index + 1} de ${steps.length}`}>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id} className={i < index ? 'step-done' : i === index ? 'current' : ''} aria-current={i === index ? 'step' : undefined}>
              <span className="wizard-dot" aria-hidden="true">
                {i < index ? '✓' : i + 1}
              </span>
              <span className="wizard-step-name">{s.title}</span>
            </li>
          ))}
        </ol>
      </div>
      <h2 className="wizard-title">
        <span className="muted small">
          Paso {index + 1} de {steps.length} ·{' '}
        </span>
        {step.title}
      </h2>
      <div className="wizard-body stack">{step.content}</div>
      {error && (
        <p className="field-error wizard-error" role="alert">
          {error}
        </p>
      )}
      <div className="wizard-bar">
        {index === 0 ? (
          <button type="button" className="btn btn-ghost btn-touch" onClick={onCancel}>
            Cancelar
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-touch" onClick={() => goTo(index - 1)}>
            ← Atrás
          </button>
        )}
        {footerExtra}
        <button type="button" className="btn btn-primary btn-touch wizard-next" onClick={next} disabled={finishing}>
          {isLast ? (finishing ? 'Guardando…' : finishLabel) : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}
