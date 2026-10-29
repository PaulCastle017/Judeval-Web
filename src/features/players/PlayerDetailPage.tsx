import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories } from '../../lib/queries'
import { ATTENDANCE_LABELS, formatDate, playerName, POSITION_LABELS, seasonStart, STATUS_LABELS, todayISO } from '../../lib/format'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, ConfirmButton, EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import { PlayerForm } from './PlayerForm'
import { NoteForm, NoteList } from './Notes'

const ATTENDANCE_TONE = { presente: 'success', ausente: 'danger', justificado: 'info', lesionado: 'warn' } as const

export function PlayerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
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

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('players').delete().eq('id', id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['players'] })
      navigate('/jugadores', { replace: true })
    },
  })

  if (player.isPending) return <Spinner />
  if (player.isError) return <ErrorMessage error={player.error} onRetry={player.refetch} />
  if (!player.data) return <ErrorMessage message="Jugador no encontrado." />
  const p = player.data

  if (editing) {
    return <PlayerForm player={p} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
  }

  const category = categories.data?.find((c) => c.id === p.category_id)
  const records = attendance.data ?? []
  const counted = records.filter((r) => r.status !== 'lesionado')
  const rate = counted.length ? Math.round((100 * counted.filter((r) => r.status === 'presente').length) / counted.length) : null

  return (
    <div className="stack">
      <Link to="/jugadores" className="back-link">
        ← Jugadores
      </Link>
      <header className="page-header">
        <div>
          <h1>{playerName(p)}</h1>
          <div className="row-tight">
            {category && <Badge>{category.name}</Badge>}
            <Badge tone={p.position === 'portero' ? 'info' : 'neutral'}>{POSITION_LABELS[p.position]}</Badge>
            <Badge tone={p.status === 'activo' ? 'success' : p.status === 'lesionado' ? 'warn' : 'neutral'}>
              {STATUS_LABELS[p.status]}
            </Badge>
            {p.birth_year && <span className="muted small">Nacido en {p.birth_year}</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}>
            Editar
          </button>
          {isAdmin && (
            <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar jugador y su historial" disabled={remove.isPending}>
              Borrar
            </ConfirmButton>
          )}
        </div>
      </header>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}

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
              <li key={i} title={`${formatDate(r.session.session_date)} · ${ATTENDANCE_LABELS[r.status]}${r.comment ? ` · ${r.comment}` : ''}`}>
                <Badge tone={ATTENDANCE_TONE[r.status]}>
                  {formatDate(r.session.session_date).replace(/ \d{4}$/, '')} · {ATTENDANCE_LABELS[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

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
