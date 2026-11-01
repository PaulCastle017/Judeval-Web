import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories } from '../../lib/queries'
import { formatDate, playerName, seasonStart, SPORT_EMOJI, SPORT_LABELS, todayISO } from '../../lib/format'
import { labelsForSport, useWords, wordsForSport } from '../../i18n/useWords'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, ConfirmButton, EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import { PlayerForm } from './PlayerForm'
import { NoteForm, NoteList } from './Notes'
import { MatchResultBadge } from '../matches/MatchResultBadge'
import { useSport } from '../../sport/SportProvider'

const ATTENDANCE_TONE = { presente: 'success', ausente: 'danger', justificado: 'info', lesionado: 'warn' } as const

export function PlayerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const sport = useSport()
  const activeWords = useWords()
  const categories = useCategories()
  const [editing, setEditing] = useState(false)
  const [addingNote, setAddingNote] = useState(false)

  const player = useQuery({
    queryKey: ['players', id],
    queryFn: async () => unwrapMaybe(await supabase.from('players').select('*').eq('id', id).maybeSingle()),
  })
  const notes = useQuery({
    queryKey: ['notes', id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('player_notes')
          .select('*')
          .eq('player_id', id)
          .order('note_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
  const from = seasonStart(todayISO())
  const attendance = useQuery({
    queryKey: ['attendance', 'player', id, from],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('attendance')
          .select('status, comment, session:training_sessions!inner(session_date)')
          .eq('player_id', id)
          .gte('session.session_date', from),
      ).sort((a, b) => b.session.session_date.localeCompare(a.session.session_date)),
  })

  const matches = useQuery({
    queryKey: ['matches', 'player', id, from],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('match_players')
          .select('status, match:matches!inner(id, match_date, opponent, goals_for, goals_against)')
          .eq('player_id', id)
          .gte('match.match_date', from),
      ).sort((a, b) => b.match.match_date.localeCompare(a.match.match_date)),
  })

  const mentions = useQuery({
    queryKey: ['reviews', 'player', id],
    queryFn: async () =>
      unwrap(
        await supabase.from('review_players').select('review:staff_reviews!inner(id, review_date, body)').eq('player_id', id),
      ).sort((a, b) => b.review.review_date.localeCompare(a.review.review_date)),
  })

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('players').delete().eq('id', id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['players'] })
      navigate('/jugadores', { replace: true })
    },
  })

  if (player.isPending) return <Spinner />
  if (player.isError) return <ErrorMessage error={player.error} onRetry={player.refetch} />
  if (!player.data) return <ErrorMessage message="No se ha encontrado la ficha." />
  const p = player.data

  if (editing) {
    return <PlayerForm player={p} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
  }

  const category = categories.data?.find((c) => c.id === p.category_id)
  // La ficha concuerda con el deporte del propio jugador (puede abrirse por enlace desde el otro deporte)
  const playerSport = category?.sport ?? sport
  const w = wordsForSport(playerSport)
  const labels = labelsForSport(playerSport)
  const records = attendance.data ?? []
  const counted = records.filter((r) => r.status !== 'lesionado')
  const rate = counted.length ? Math.round((100 * counted.filter((r) => r.status === 'presente').length) / counted.length) : null

  return (
    <div className="stack">
      <Link to="/jugadores" className="back-link">
        ← {activeWords.Players}
      </Link>
      <header className="page-header">
        <div>
          <h1>{playerName(p)}</h1>
          <div className="row-tight">
            {category && <Badge>{category.name}</Badge>}
            {(playerSport === 'futsal' || p.position === 'portero') && (
              <Badge tone={p.position === 'portero' ? 'info' : 'neutral'}>{labels.position[p.position]}</Badge>
            )}
            <Badge tone={p.status === 'activo' ? 'success' : p.status === 'lesionado' ? 'warn' : 'neutral'}>
              {labels.status[p.status]}
            </Badge>
            {p.birth_year && (
              <span className="muted small">
                {w.Born} en {p.birth_year}
              </span>
            )}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}>
            Editar
          </button>
          {isAdmin && (
            <ConfirmButton onConfirm={() => remove.mutate()} confirmText={`Borrar ${w.player} y su historial`} disabled={remove.isPending}>
              Borrar
            </ConfirmButton>
          )}
        </div>
      </header>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      {category && category.sport !== sport && (
        <div className="alert alert-info" role="status">
          {w.This} {w.player} es de {SPORT_EMOJI[category.sport]} {SPORT_LABELS[category.sport]}. Estás trabajando en{' '}
          {SPORT_LABELS[sport]}.
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <h2>Disponibilidad</h2>
          <p className="pre">{p.availability_notes || <span className="muted">Sin indicaciones.</span>}</p>
        </section>
        <section className="card">
          <h2>Consideraciones físicas</h2>
          <p className="pre">{p.physical_considerations || <span className="muted">Ninguna registrada.</span>}</p>
        </section>
      </div>

      <section className="card">
        <h2>
          Asistencia esta temporada{' '}
          {rate !== null && <span className={`rate ${rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low'}`}>{rate}%</span>}
        </h2>
        {attendance.isPending && <Spinner />}
        {attendance.isError && <ErrorMessage error={attendance.error} onRetry={attendance.refetch} />}
        {attendance.isSuccess && records.length === 0 && <EmptyState>Aún no hay asistencia registrada.</EmptyState>}
        {records.length > 0 && (
          <ul className="attendance-dots">
            {records.slice(0, 20).map((r, i) => (
              <li key={i} title={`${formatDate(r.session.session_date)} · ${labels.attendance[r.status]}${r.comment ? ` · ${r.comment}` : ''}`}>
                <Badge tone={ATTENDANCE_TONE[r.status]}>
                  {formatDate(r.session.session_date).replace(/ \d{4}$/, '')} · {labels.attendance[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>🏆 Partidos esta temporada</h2>
        {matches.isPending && <Spinner />}
        {matches.isError && <ErrorMessage error={matches.error} onRetry={matches.refetch} />}
        {matches.isSuccess && matches.data.length === 0 && <EmptyState>Sin convocatorias todavía.</EmptyState>}
        {matches.isSuccess && matches.data.length > 0 && (
          <>
            <p>
              <strong>{matches.data.length}</strong> {matches.data.length === 1 ? 'convocatoria' : 'convocatorias'} ·{' '}
              <strong>{matches.data.filter((r) => r.status === 'presente').length}</strong> con asistencia
            </p>
            <ul className="list">
              {matches.data.slice(0, 5).map(({ match, status }) => (
                <li key={match.id}>
                  <Link to={`/partidos/${match.id}`} className="list-link">
                    <span className="list-main">
                      <strong>
                        {formatDate(match.match_date)} · vs {match.opponent}
                      </strong>
                      {status && <span className="muted small">{labels.attendance[status]}</span>}
                    </span>
                    <MatchResultBadge goalsFor={match.goals_for} goalsAgainst={match.goals_against} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {mentions.isError && <ErrorMessage error={mentions.error} onRetry={mentions.refetch} />}
      {mentions.data && mentions.data.length > 0 && (
        <section className="card">
          <h2>📝 {w.Mentioned} en revisiones</h2>
          <ul className="list">
            {mentions.data.map(({ review }) => (
              <li key={review.id}>
                <Link to={`/revisiones/${review.id}`} className="list-link">
                  <span className="list-main">
                    <strong>{formatDate(review.review_date)}</strong>
                    <span className="clamp">{review.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack-sm">
        <div className="page-header">
          <h2>Seguimiento</h2>
          {!addingNote && (
            <button className="btn btn-primary" onClick={() => setAddingNote(true)}>
              + Añadir nota
            </button>
          )}
        </div>
        {addingNote && <NoteForm playerId={p.id} onDone={() => setAddingNote(false)} />}
        {notes.isPending && <Spinner />}
        {notes.isError && <ErrorMessage error={notes.error} onRetry={notes.refetch} />}
        {notes.isSuccess && <NoteList notes={notes.data} playerId={p.id} />}
      </section>
    </div>
  )
}
