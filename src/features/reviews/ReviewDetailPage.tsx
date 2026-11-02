import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, unwrapMaybe, usePlayers, useStaff } from '../../lib/queries'
import { formatDate, playerName, todayISO } from '../../lib/format'
import { parseForm, reviewSchema, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { wordsForSport } from '../../i18n/useWords'
import { ConfirmButton, ErrorMessage, Field, Spinner, SuccessMessage } from '../../components/ui'
import type { Tables } from '../../types/database'
import { useEventContext, type EventContext, type EventKind } from './eventContext'

const MAX_BODY = 8000
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type ReviewWithPlayers = Tables<'staff_reviews'> & { review_players: { player_id: string }[] }

/** /revisiones/nueva (alta) o /revisiones/:id (edición). */
export function ReviewDetailPage() {
  const { id = '' } = useParams()
  const isNew = id === 'nueva'
  const [params] = useSearchParams()
  const review = useQuery({
    enabled: !isNew,
    queryKey: ['reviews', 'detail', id],
    queryFn: async () =>
      unwrapMaybe(await supabase.from('staff_reviews').select('*, review_players(player_id)').eq('id', id).maybeSingle()),
  })

  // Evento vinculado: el de la revisión guardada o el que llega en la URL (?entrenamiento= / ?partido=)
  const linked: [EventKind, string] | null = review.data?.training_session_id
    ? ['training', review.data.training_session_id]
    : review.data?.match_id
      ? ['match', review.data.match_id]
      : isNew && params.get('entrenamiento')
        ? ['training', params.get('entrenamiento')!]
        : isNew && params.get('partido')
          ? ['match', params.get('partido')!]
          : null
  const event = useEventContext(linked?.[0] ?? null, linked?.[1] ?? null)

  if (!isNew && review.isPending) return <Spinner />
  if (linked && event.isPending) return <Spinner />
  if (review.isError) return <ErrorMessage error={review.error} onRetry={review.refetch} />
  if (event.isError) return <ErrorMessage error={event.error} onRetry={event.refetch} />
  if (!isNew && !review.data) return <ErrorMessage message="Revisión no encontrada." />
  // Una revisión por evento: si ya existe, se abre esa
  if (isNew && event.data?.existingReviewId) return <Navigate to={`/revisiones/${event.data.existingReviewId}`} replace />

  return (
    <div className="stack">
      <Link to="/revisiones" className="back-link">
        ← Revisiones
      </Link>
      <ReviewForm key={review.data?.id ?? `nueva-${linked?.[1] ?? ''}`} review={isNew ? null : review.data!} event={event.data ?? null} />
    </div>
  )
}

function ReviewForm({ review, event }: { review: ReviewWithPlayers | null; event: EventContext | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeSport = useSport()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  // Deporte: el de la revisión, o el del evento al que se vincula, o el activo
  const sport = review?.sport ?? event?.sport ?? activeSport
  const players = usePlayers(sport)
  const w = wordsForSport(sport)

  const [reviewDate, setReviewDate] = useState(review?.review_date ?? event?.date ?? todayISO())
  const [body, setBody] = useState(review?.body ?? '')
  const [selected, setSelected] = useState<string[]>(review?.review_players.map((r) => r.player_id) ?? [])
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const location = useLocation()
  const [saved, setSaved] = useState(() => !!(location.state as { justSaved?: boolean } | null)?.justSaved)

  const candidates = useMemo(() => {
    const term = normalize(search.trim())
    return (players.data ?? []).filter(
      (p) => p.status !== 'baja' && !selected.includes(p.id) && (!term || normalize(`${p.first_name} ${p.last_name} ${p.display_name}`).includes(term)),
    )
  }, [players.data, selected, search])
  const playerById = new Map(players.data?.map((p) => [p.id, p]))
  // Sugerencias del evento: participantes aún sin etiquetar (no se etiquetan solos)
  const suggested = (event?.participantIds ?? []).filter((pid) => !selected.includes(pid) && playerById.has(pid))

  const save = useMutation({
    // RPC: guarda la revisión y sus jugadores etiquetados en una sola transacción
    mutationFn: async (values: ReturnType<typeof reviewSchema.parse>) =>
      unwrap(
        await supabase.rpc('save_review', {
          // null explícito en un alta: si se omitiera, PostgREST no encontraría la función
          p_id: (review?.id ?? null) as string,
          p_sport: sport,
          p_review_date: values.review_date,
          p_body: values.body,
          p_player_ids: values.player_ids,
          // Vínculo al entrenamiento o partido de origen (solo al crearla)
          ...(!review && event?.kind === 'training' ? { p_training_session_id: event.id } : {}),
          ...(!review && event?.kind === 'match' ? { p_match_id: event.id } : {}),
        }),
      ),
    onSuccess: async (id) => {
      setSaved(true)
      // Al crear, la página se vuelve a montar con el id nuevo: el aviso viaja en el estado de navegación.
      // Se navega ANTES de invalidar: si no, el contexto del evento se recarga con esta revisión como
      // «existente» y la redirección de «una por evento» se adelanta y pierde el aviso.
      if (!review) navigate(`/revisiones/${id}`, { replace: true, state: { justSaved: true } })
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
    },
    onError: async (err: { code?: string }) => {
      // Otra persona acaba de escribir la revisión de este evento: se abre esa
      if (err.code === '23505' && event) await queryClient.invalidateQueries({ queryKey: ['reviews', 'event'] })
    },
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('staff_reviews').delete().eq('id', review!.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      navigate('/revisiones', { replace: true })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const parsed = parseForm(reviewSchema, { review_date: reviewDate, body, player_ids: selected })
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  function toggle(id: string) {
    setSaved(false)
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <div>
          <h1>{review ? `Revisión del ${formatDate(review.review_date)}` : 'Nueva revisión'}</h1>
          {review && <p className="muted small">Escrita por {staffName(staff.data, review.created_by)}</p>}
          {event && (
            <Link to={event.link} className="chip chip-static event-chip">
              {event.label}
            </Link>
          )}
        </div>
        {review && (isAdmin || review.created_by === profile?.id) && (
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar revisión" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        )}
      </header>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}

      <section className="card stack">
        <Field label="Fecha" error={errors.review_date}>
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="input-auto" />
        </Field>
        <Field
          label="¿Qué has visto? ¿Qué quieres resaltar?"
          error={errors.body}
          hint={`${body.length}/${MAX_BODY} · Describe conductas, no etiquetas. Sin diagnósticos no confirmados.`}
        >
          <textarea
            rows={10}
            maxLength={MAX_BODY}
            value={body}
            placeholder="Escribe libremente: cómo ha ido el grupo, avances, preocupaciones, ideas para las próximas semanas…"
            onChange={(e) => {
              setSaved(false)
              setBody(e.target.value)
            }}
          />
        </Field>
      </section>

      <section className="card stack-sm">
        <h2>
          👥 {w.Players} {w.mentionedPl} (opcional)
        </h2>
        {suggested.length > 0 && (
          <div className="stack-sm suggestions">
            <div className="row space-between">
              <span className="small muted">
                {event?.kind === 'training' ? `Presentes en el entrenamiento` : `En el partido`} · toca para etiquetar
              </span>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setSelected((list) => [...list, ...suggested])}>
                Etiquetar a {w.all}
              </button>
            </div>
            <ul className="chips">
              {suggested.map((pid) => {
                const p = playerById.get(pid)
                return p ? (
                  <li key={pid}>
                    <button type="button" className="chip chip-touch chip-suggest" onClick={() => toggle(pid)}>
                      + {playerName(p)}
                    </button>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        )}
        {selected.length > 0 ? (
          <ul className="chips">
            {selected.map((id) => {
              const p = playerById.get(id)
              return (
                <li key={id}>
                  <button type="button" className="chip chip-on" onClick={() => toggle(id)} aria-label={`Quitar ${p ? playerName(p) : w.player}`}>
                    {p ? playerName(p) : '…'} ✕
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted small">Ninguno seleccionado.</p>
        )}
        <input type="search" placeholder={`Buscar ${w.player} para etiquetar…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        {players.isPending && <Spinner />}
        {players.isError && <ErrorMessage error={players.error} onRetry={players.refetch} />}
        <ul className="chips">
          {candidates.map((p) => (
            <li key={p.id}>
              <button type="button" className="chip" onClick={() => toggle(p.id)}>
                + {playerName(p)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {saved && <SuccessMessage>Revisión guardada.</SuccessMessage>}
      <div className="row sticky-actions">
        <button className="btn btn-primary btn-large" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar revisión'}
        </button>
        <Link to="/revisiones" className="btn btn-ghost">
          Volver
        </Link>
      </div>
    </form>
  )
}
