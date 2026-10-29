import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { loginSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorMessage, Field } from '../../components/ui'

export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const parsed = parseForm(loginSchema, { email, password })
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword(parsed.data)
    setSubmitting(false)
    if (error) setSubmitError(toMessage(error))
  }

  return (
    <div className="center-page login-page">
      <form className="card narrow stack" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <span className="brand-big">JUDEVAL</span>
          <span className="muted">Acompañar, unir y hacer equipo</span>
        </div>
        <h1>Acceso entrenadores</h1>
        {submitError && <ErrorMessage message={submitError} />}
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Contraseña" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted small">¿No tienes cuenta o has olvidado la contraseña? Pídesela al coordinador de JUDEVAL.</p>
      </form>
    </div>
  )
}
