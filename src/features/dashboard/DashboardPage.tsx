import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useCategories, usePlayers, useStaff } from '../../lib/queries'
import { addDays, formatDate, formatLongDate, formatTime, isoWeekday, playerName, todayISO } from '../../lib/format'
import { useAuth } from '../../auth/AuthProvider'
import { EmptyState, ErrorMessage, Spinner } from '../../components/ui'

const CONVERSATION_WINDOW_DAYS = 14

export function DashboardPage() {
  const { profile } = useAuth()
  const today = todayISO()
  const weekday = isoWeekday(today)
  const categories = useCategories()
  const players = usePlayers()

  const todaysCategories = categories.data?.filter((c) => c.training_weekdays.includes(weekday)) ?? []

  return (
    <div className="stack">
      <header>
        <h1>Hola{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="muted">{formatLongDate(today)}</p>
      </header>

      <section className="card">
        <h2>Entrenamientos de hoy</h2>
        {categories.isPending && <Spinner />}
        {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}
        {categories.isSuccess && todaysCategories.length === 0 && <EmptyState>Hoy no hay entrenamientos programados.</EmptyState>}
        <TodaySessions categoryIds={todaysCategories.map((c) => c.id)} date={today}>
          {(done) =>
            todaysCategories.map((c) => (
              <div key={c.id} className="today-row">
                <span>
                  <strong>{c.name}</strong>{' '}
                  <span className="muted small">
                    {formatTime(c.start_time)}–{formatTime(c.end_time)}
                  </span>
                  {done.has(c.id) && <span className="small text-success"> · lista pasada ✓</span>}
                </span>
                <Link className="btn btn-primary btn-small" to={`/asistencia?categoria=${c.id}&fecha=${today}`}>
                  {done.has(c.id) ? 'Ver lista' : 'Pasar lista'}
                </Link>
              </div>
            ))
          }
        </TodaySessions>
      </section>

      <PendingFollowUps />
      <OpenActions />
      <NoRecentConversation players={players.data} categories={categories.data} />
      <RecentRecognitions />
    </div>
  )
}

function TodaySessions({
  categoryIds,
  date,
  children,
}: {
  categoryIds: string[]
  date: string
  children: (done: Set<string>) => ReactNode
}) {
  const sessions = useQuery({
    enabled: categoryIds.length > 0,
    queryKey: ['sessions', 'today', date, categoryIds],
    queryFn: async () =>
      unwrap(await supabase.from('training_sessions').select('category_id').eq('session_date', date).in('category_id', categoryIds)),
  })
  return <>{children(new Set(sessions.data?.map((s) => s.category_id)))}</>
}

function PendingFollowUps() {
  const queryClient = useQueryClient()
  const notes = useQuery({
    queryKey: ['notes', 'pending'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('player_notes')
          .select('id, body, note_date, type, author_id, player:players(id, first_name, last_name, display_name)')
          .eq('follow_up', true)
          .eq('follow_up_done', false)
          .order('note_date')
          .limit(20),
      ),
  })
  const staff = useStaff()
  const resolve = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('set_note_follow_up_done', { p_note_id: id, p_done: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  return (
    <section className="card">
      <h2>Seguimientos pendientes</h2>
      {notes.isPending && <Spinner />}
      {notes.isError && <ErrorMessage error={notes.error} onRetry={notes.refetch} />}
      {resolve.isError && <ErrorMessage message={toMessage(resolve.error)} />}
      {notes.isSuccess && notes.data.length === 0 && <EmptyState>No hay seguimientos pendientes.</EmptyState>}
      <ul className="list">
        {notes.data?.map((n) => (
          <li key={n.id} className="followup-row">
            <div>
              <Link to={`/jugadores/${n.player.id}`}>
                <strong>{playerName(n.player)}</strong>
              </Link>{' '}
              <span className="muted small">
                {formatDate(n.note_date)} · {staffName(staff.data, n.author_id)}
              </span>
              <p className="clamp">{n.body}</p>
            </div>
            <button className="btn btn-small" onClick={() => resolve.mutate(n.id)} disabled={resolve.isPending}>
              Resuelto
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OpenActions() {
  const { profile } = useAuth()
  const staff = useStaff()
  const actions = useQuery({
    queryKey: ['review_actions', 'open'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('review_actions')
          .select('id, description, due_date, owner_id, review_id')
          .eq('done', false)
          .order('due_date', { nullsFirst: false })
          .limit(20),
      ),
  })
  const today = todayISO()

  return (
    <section className="card">
      <h2>Acciones abiertas del equipo técnico</h2>
      {actions.isPending && <Spinner />}
      {actions.isError && <ErrorMessage error={actions.error} onRetry={actions.refetch} />}
      {actions.isSuccess && actions.data.length === 0 && <EmptyState>No hay acciones pendientes.</EmptyState>}
      <ul className="list">
        {actions.data?.map((a) => (
          <li key={a.id}>
            <Link to={`/revisiones/${a.review_id}`} className="list-link">
              <span className="list-main">
                <span>{a.description}</span>
                <span className="muted small">
                  {a.owner_id === profile?.id ? 'Tú' : a.owner_id ? staffName(staff.data, a.owner_id) : 'Sin responsable'}
                </span>
              </span>
              {a.due_date && (
                <span className={`small ${a.due_date < today ? 'text-danger' : 'muted'}`}>{formatDate(a.due_date)}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NoRecentConversation({
  players,
  categories,
}: {
  players: ReturnType<typeof usePlayers>['data']
  categories: ReturnType<typeof useCategories>['data']
}) {
  const since = addDays(todayISO(), -CONVERSATION_WINDOW_DAYS)
  const recent = useQuery({
    queryKey: ['notes', 'conversations-since', since],
    queryFn: async () =>
      unwrap(await supabase.from('player_notes').select('player_id').eq('type', 'conversacion').gte('note_date', since)),
  })

  const talked = new Set(recent.data?.map((n) => n.player_id))
  const pending = (players ?? []).filter((p) => p.active && p.status !== 'baja' && !talked.has(p.id))
  const catName = new Map(categories?.map((c) => [c.id, c.name]))

  return (
    <section className="card">
      <h2>Sin conversación individual en {CONVERSATION_WINDOW_DAYS} días</h2>
      <p className="muted small">Propuesta de la guía: dos conversaciones de 5–10 minutos por semana.</p>
      {recent.isPending && <Spinner />}
      {recent.isError && <ErrorMessage error={recent.error} onRetry={recent.refetch} />}
      {recent.isSuccess && pending.length === 0 && <EmptyState>¡Habéis hablado con todos recientemente!</EmptyState>}
      {recent.isSuccess && pending.length > 0 && (
        <ul className="chips">
          {pending.map((p) => (
            <li key={p.id}>
              <Link className="chip" to={`/jugadores/${p.id}`} title={catName.get(p.category_id)}>
                {playerName(p)} <span className="muted small">· {catName.get(p.category_id)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentRecognitions() {
  const notes = useQuery({
    queryKey: ['notes', 'recognitions'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('player_notes')
          .select('id, body, note_date, player:players(id, first_name, last_name, display_name)')
          .eq('type', 'reconocimiento')
          .order('note_date', { ascending: false })
          .limit(5),
      ),
  })

  return (
    <section className="card">
      <h2>Últimos reconocimientos</h2>
      {notes.isPending && <Spinner />}
      {notes.isError && <ErrorMessage error={notes.error} onRetry={notes.refetch} />}
      {notes.isSuccess && notes.data.length === 0 && (
        <EmptyState>Aún no hay reconocimientos. Señalemos conductas concretas: escuchar, animar, volver a intentarlo…</EmptyState>
      )}
      <ul className="list">
        {notes.data?.map((n) => (
          <li key={n.id}>
            <Link to={`/jugadores/${n.player.id}`}>
              <strong>{playerName(n.player)}</strong>
            </Link>{' '}
            <span className="muted small">{formatDate(n.note_date)}</span>
            <p className="clamp">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
