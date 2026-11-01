import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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

const MAX_BODY = 8000
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type ReviewWithPlayers = Tables<'staff_reviews'> & { review_players: { player_id: string }[] }

/** /revisiones/nueva (alta) o /revisiones/:id (edición). */
export function ReviewDetailPage() {
  const { id = '' } = useParams()
  const isNew = id === 'nueva'
  const review = useQuery({
    enabled: !isNew,
    queryKey: ['reviews', 'detail', id],
    queryFn: async () =>
      unwrapMaybe(await supabase.from('staff_reviews').select('*, review_players(player_id)').eq('id', id).maybeSingle()),
  })

  if (!isNew && review.isPending) return <Spinner />
  if (review.isError) return <ErrorMessage error={review.error} onRetry={review.refetch} />
  if (!isNew && !review.data) return <ErrorMessage message="Revisión no encontrada." />

  return (
    <div className="stack">
      <Link to="/revisiones" className="back-link">
        ← Revisiones
      </Link>
      <ReviewForm key={review.data?.id ?? 'nueva'} review={isNew ? null : review.data!} />
    </div>
  )
}

function ReviewForm({ review }: { review: ReviewWithPlayers | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sport = useSport()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  // Jugadores del deporte de la revisión (normalmente el activo)
  const players = usePlayers(review?.sport ?? sport)
  const w = wordsForSport(review?.sport ?? sport)

  const [reviewDate, setReviewDate] = useState(review?.review_date ?? todayISO())
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

  const save = useMutation({
    // RPC: guarda la revisión y sus jugadores etiquetados en una sola transacción
    mutationFn: async (values: ReturnType<typeof reviewSchema.parse>) =>
      unwrap(
        await supabase.rpc('save_review', {
          // null explícito en un alta: si se omitiera, PostgREST no encontraría la función
          p_id: (review?.id ?? null) as string,
          p_sport: review?.sport ?? sport,
          p_review_date: values.review_date,
          p_body: values.body,
          p_player_ids: values.player_ids,
        }),
      ),
    onSuccess: async (id) => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      // Al crear, la página se vuelve a montar con el id nuevo: el aviso viaja en el estado de navegación
      if (!review) navigate(`/revisiones/${id}`, { replace: true, state: { justSaved: true } })
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
