import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import { ROLE_LABELS, SPORT_EMOJI, SPORT_LABELS } from '../../lib/format'
import { useSport } from '../../sport/SportProvider'
import { changePasswordSchema, parseForm, profileSchema, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorMessage, Field, PageHeader, SuccessMessage } from '../../components/ui'

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const sport = useSport()
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [nameErrors, setNameErrors] = useState<FieldErrors>({})
  const [nameState, setNameState] = useState<{ saving: boolean; error?: string; ok?: boolean }>({ saving: false })

  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState<FieldErrors>({})
  const [pwState, setPwState] = useState<{ saving: boolean; error?: string; ok?: boolean }>({ saving: false })

  if (!profile) return null

  async function saveName(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(profileSchema, { full_name: fullName })
    if (!parsed.ok) return setNameErrors(parsed.errors)
    setNameErrors({})
    setNameState({ saving: true })
    const { error } = await supabase.from('profiles').update(parsed.data).eq('id', profile!.id)
    if (error) return setNameState({ saving: false, error: toMessage(error) })
    await refreshProfile()
    await queryClient.invalidateQueries({ queryKey: ['profiles'] })
    setNameState({ saving: false, ok: true })
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(changePasswordSchema, pw)
    if (!parsed.ok) return setPwErrors(parsed.errors)
    setPwErrors({})
    setPwState({ saving: true })
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) return setPwState({ saving: false, error: toMessage(error) })
    setPw({ password: '', confirm: '' })
    setPwState({ saving: false, ok: true })
  }

  return (
    <div className="stack">
      <PageHeader title="Mi perfil" subtitle={`${profile.email} · ${ROLE_LABELS[profile.role]}`} />

      <section className="card row space-between">
        <div>
          <h2>Deporte</h2>
          <p className="muted">
            Estás trabajando en {SPORT_EMOJI[sport]} {SPORT_LABELS[sport]}.
          </p>
        </div>
        <Link to="/deporte" state={{ from: '/perfil' }} className="btn">
          Cambiar de deporte
        </Link>
      </section>

      <form className="card stack" onSubmit={saveName} noValidate>
        <h2>Datos</h2>
        {nameState.error && <ErrorMessage message={nameState.error} />}
        {nameState.ok && <SuccessMessage>Nombre actualizado.</SuccessMessage>}
        <Field label="Nombre completo" error={nameErrors.full_name}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </Field>
        <div>
          <button className="btn btn-primary" disabled={nameState.saving}>
            {nameState.saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      <form className="card stack" onSubmit={savePassword} noValidate>
        <h2>Cambiar contraseña</h2>
        <p className="muted small">Si te han dado una contraseña temporal, cámbiala aquí.</p>
        {pwState.error && <ErrorMessage message={pwState.error} />}
        {pwState.ok && <SuccessMessage>Contraseña cambiada correctamente.</SuccessMessage>}
        <Field label="Nueva contraseña" error={pwErrors.password} hint="Mínimo 8 caracteres, con letras y números.">
          <input
            type="password"
            autoComplete="new-password"
            value={pw.password}
            onChange={(e) => setPw({ ...pw, password: e.target.value })}
          />
        </Field>
        <Field label="Repite la contraseña" error={pwErrors.confirm}>
          <input
            type="password"
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </Field>
        <div>
          <button className="btn btn-primary" disabled={pwState.saving}>
            {pwState.saving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}
