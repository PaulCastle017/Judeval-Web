import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, unwrapMaybe, usePlayers, useStaff } from '../../lib/queries'
import { formatDate, playerName, todayISO } from '../../lib/format'
import { parseForm, reviewActionSchema, reviewSchema, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { ConfirmButton, EmptyState, ErrorMessage, Field, Spinner, SuccessMessage } from '../../components/ui'
import type { Tables } from '../../types/database'

// Preguntas de la sección 8 de la guía
const QUESTIONS = [
  { key: 'integration', label: '¿Quién parece más integrado y quién está quedando al margen?' },
  { key: 'coherence', label: '¿Estamos corrigiendo de forma coherente entre entrenadores?' },
  { key: 'positive_behaviors', label: '¿Qué comportamientos positivos hemos reconocido últimamente?' },
  { key: 'conflicts', label: '¿Hay algún conflicto que requiera seguimiento o coordinación?' },
  { key: 'privacy', label: '¿Estamos respetando la privacidad y los protocolos de protección?' },
  { key: 'next_change', label: '¿Qué pequeño cambio podemos probar durante las próximas dos semanas?' },
] as const

type Review = Tables<'staff_reviews'>

export function ReviewDetailPage() {
  const { id = '' } = useParams()
  const review = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => unwrapMaybe(await supabase.from('staff_reviews').select('*').eq('id', id).maybeSingle()),
  })

  if (review.isPending) return <Spinner />
  if (review.isError) return <ErrorMessage error={review.error} onRetry={review.refetch} />
  if (!review.data) return <ErrorMessage message="Revisión no encontrada." />

  return (
    <div className="stack">
      <Link to="/revisiones" className="back-link">
        ← Revisiones
      </Link>
      <ReviewForm key={review.data.id} review={review.data} />
      <ReviewActions reviewId={review.data.id} />
    </div>
  )
}

function ReviewForm({ review }: { review: Review }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  const [form, setForm] = useState({
    review_date: review.review_date,
    integration: review.integration,
    coherence: review.coherence,
    positive_behaviors: review.positive_behaviors,
    conflicts: review.conflicts,
    privacy: review.privacy,
    next_change: review.next_change,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof reviewSchema.parse>) =>
      unwrap(await supabase.from('staff_reviews').update(values).eq('id', review.id).select('id').single()),
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('staff_reviews').delete().eq('id', review.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      navigate('/revisiones', { replace: true })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const parsed = parseForm(reviewSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <div>
          <h1>Revisión del {formatDate(review.review_date)}</h1>
          <p className="muted small">Creada por {staffName(staff.data, review.created_by)}</p>
        </div>
        {(isAdmin || review.created_by === profile?.id) && (
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar revisión y acciones" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        )}
      </header>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      <Field label="Fecha" error={errors.review_date}>
        <input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} />
      </Field>
      {QUESTIONS.map((q) => (
        <Field key={q.key} label={q.label} error={errors[q.key]}>
          <textarea
            rows={3}
            maxLength={4000}
            value={form[q.key]}
            onChange={(e) => {
              setSaved(false)
              setForm({ ...form, [q.key]: e.target.value })
            }}
          />
        </Field>
      ))}
      <p className="muted small">
        Las observaciones deben tratarse con discreción. No incluir diagnósticos no confirmados ni información personal innecesaria.
      </p>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {saved && <SuccessMessage>Revisión guardada.</SuccessMessage>}
      <div>
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar revisión'}
        </button>
      </div>
    </form>
  )
}

function ReviewActions({ reviewId }: { reviewId: string }) {
  const queryClient = useQueryClient()
  const staff = useStaff()
  const players = usePlayers()
  const [form, setForm] = useState({ description: '', player_id: '', owner_id: '', due_date: '' })
  const [errors, setErrors] = useState<FieldErrors>({})

  const actions = useQuery({
    queryKey: ['review_actions', reviewId],
    queryFn: async () =>
      unwrap(await supabase.from('review_actions').select('*').eq('review_id', reviewId).order('done').order('due_date', { nullsFirst: false })),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['review_actions'] })
    await queryClient.invalidateQueries({ queryKey: ['reviews'] })
  }

  const add = useMutation({
    mutationFn: async (values: ReturnType<typeof reviewActionSchema.parse>) =>
      unwrap(await supabase.from('review_actions').insert({ ...values, review_id: reviewId }).select('id').single()),
    onSuccess: async () => {
      setForm({ description: '', player_id: '', owner_id: '', due_date: '' })
      await invalidate()
    },
  })
  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await supabase.from('review_actions').update({ done }).eq('id', id).select('id').single()),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('review_actions').delete().eq('id', id).select('id')),
    onSuccess: invalidate,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(reviewActionSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    add.mutate(parsed.data)
  }

  const activeStaff = staff.data?.filter((s) => s.active) ?? []
  const activePlayers = players.data?.filter((p) => p.status !== 'baja') ?? []
  const playerById = new Map(players.data?.map((p) => [p.id, p]))

  return (
    <section className="card stack">
      <h2>Acciones acordadas</h2>
      {actions.isPending && <Spinner />}
      {actions.isError && <ErrorMessage error={actions.error} onRetry={actions.refetch} />}
      {toggle.isError && <ErrorMessage message={toMessage(toggle.error)} />}
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      {actions.isSuccess && actions.data.length === 0 && <EmptyState>Sin acciones todavía.</EmptyState>}
      {actions.isSuccess && actions.data.length > 0 && (
        <ul className="list">
          {actions.data.map((a) => {
            const player = a.player_id ? playerById.get(a.player_id) : undefined
            const overdue = !a.done && a.due_date && a.due_date < todayISO()
            return (
              <li key={a.id} className="action-row">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={a.done}
                    disabled={toggle.isPending}
                    onChange={(e) => toggle.mutate({ id: a.id, done: e.target.checked })}
                  />
                  <span className={a.done ? 'done' : ''}>{a.description}</span>
                </label>
                <span className="muted small">
                  {player && (
                    <>
                      <Link to={`/jugadores/${player.id}`}>{playerName(player)}</Link> ·{' '}
                    </>
                  )}
                  {a.owner_id ? staffName(staff.data, a.owner_id) : 'Sin responsable'}
                  {a.due_date && <span className={overdue ? 'text-danger' : ''}> · antes del {formatDate(a.due_date)}</span>}
                </span>
                <ConfirmButton onConfirm={() => remove.mutate(a.id)} className="btn btn-ghost btn-small" confirmText="Borrar">
                  ✕
                </ConfirmButton>
              </li>
            )
          })}
        </ul>
      )}

      <form className="stack-sm add-action" onSubmit={onSubmit} noValidate>
        <h3>Nueva acción</h3>
        {add.isError && <ErrorMessage message={toMessage(add.error)} />}
        <Field label="Descripción" error={errors.description}>
          <input
            value={form.description}
            maxLength={500}
            placeholder="p. ej. Hablar en privado con… / Probar parejas variadas"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid-3">
          <Field label="Jugador (opcional)" error={errors.player_id}>
            <select value={form.player_id} onChange={(e) => setForm({ ...form, player_id: e.target.value })}>
              <option value="">—</option>
              {activePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable" error={errors.owner_id}>
            <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
              <option value="">—</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha límite" error={errors.due_date}>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
        </div>
        <div>
          <button className="btn" disabled={add.isPending}>
            {add.isPending ? 'Añadiendo…' : 'Añadir acción'}
          </button>
        </div>
      </form>
    </section>
  )
}
