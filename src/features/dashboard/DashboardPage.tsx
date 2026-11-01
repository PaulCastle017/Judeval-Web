import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useCategories, usePlayers, useStaff } from '../../lib/queries'
import {
  addDays,
  daysBetween,
  endTime,
  formatDate,
  formatLongDate,
  formatTime,
  playerName,
  relativeDayLabel,
  SPORT_EMOJI,
  SPORT_LABELS,
  todayISO,
} from '../../lib/format'
import { parseExercises } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { useWords } from '../../i18n/useWords'
import { readNumberPref, writeNumberPref, type Sport } from '../../sport/storage'
import { EmptyState, ErrorMessage, Spinner } from '../../components/ui'
import { NoteForm } from '../players/Notes'
import { PollReminder } from './PollReminder'
import { UpcomingMatches } from './UpcomingMatches'

const UPCOMING_DAYS = 14
const NO_NEWS_DEFAULT = 14
const NO_NEWS_MIN = 1
const NO_NEWS_MAX = 90

export function DashboardPage() {
  const { profile } = useAuth()
  const sport = useSport()
  const today = todayISO()

  return (
    <div className="stack">
      <header className="dash-hello">
        <h1>Hola{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="muted">
          {formatLongDate(today)} · {SPORT_EMOJI[sport]} {SPORT_LABELS[sport]}
        </p>
      </header>

      <PollReminder sport={sport} />
      <UpcomingTrainings sport={sport} today={today} />
      <UpcomingMatches sport={sport} today={today} />
      <PendingFollowUps sport={sport} />
      <NoRecentNews sport={sport} today={today} userId={profile?.id ?? 'anon'} />
    </div>
  )
}

function UpcomingTrainings({ sport, today }: { sport: Sport; today: string }) {
  const categories = useCategories(sport)
  const ids = categories.data?.map((c) => c.id) ?? []
  const until = addDays(today, UPCOMING_DAYS)
  const trainings = useQuery({
    enabled: categories.isSuccess,
    queryKey: ['sessions', 'upcoming', sport, today],
    queryFn: async () =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('training_sessions')
              .select('id, category_id, session_date, start_time, duration_minutes, exercises, attendance(count)')
              .in('category_id', ids)
              .gte('session_date', today)
              .lte('session_date', until)
              .order('session_date')
              .order('start_time', { nullsFirst: false })
              .limit(8),
          ),
  })
  const catName = new Map(categories.data?.map((c) => [c.id, c.name]))

  return (
    <section className="card">
      <div className="card-head">
        <h2>📅 Entrenamientos programados</h2>
        <Link to="/entrenamientos" className="btn btn-ghost btn-small">
          Ver todos
        </Link>
      </div>
      {(categories.isPending || trainings.isPending) && <Spinner />}
      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}
      {trainings.isError && <ErrorMessage error={trainings.error} onRetry={trainings.refetch} />}
      {trainings.isSuccess && trainings.data.length === 0 && (
        <div className="empty-cta">
          <EmptyState>No hay entrenamientos programados en los próximos {UPCOMING_DAYS} días.</EmptyState>
          <Link to="/entrenamientos/nuevo" className="btn btn-primary btn-small">
            + Crear entrenamiento
          </Link>
        </div>
      )}
      <ul className="list">
        {trainings.data?.map((t) => {
          const isToday = t.session_date === today
          const listTaken = (t.attendance[0]?.count ?? 0) > 0
          const exercises = parseExercises(t.exercises).length
          return (
            <li key={t.id} className="today-row">
              <span className="list-main">
                <span>
                  <strong className={isToday ? 'text-accent' : ''}>{relativeDayLabel(t.session_date, today)}</strong>
                  {t.start_time && (
                    <span className="muted">
                      {' '}
                      · {formatTime(t.start_time)}
                      {t.duration_minutes && `–${endTime(t.start_time, t.duration_minutes)}`}
                    </span>
                  )}
                </span>
                <span className="muted small">
                  {catName.get(t.category_id)}
                  {exercises > 0 && ` · ${exercises} ejercicio${exercises === 1 ? '' : 's'}`}
                  {listTaken && ' · lista pasada ✓'}
                </span>
              </span>
              {isToday ? (
                <Link className="btn btn-primary btn-small" to={`/asistencia?categoria=${t.category_id}&fecha=${t.session_date}`}>
                  {listTaken ? 'Ver lista' : 'Pasar lista'}
                </Link>
              ) : (
                <Link className="btn btn-small" to={`/entrenamientos/${t.id}`}>
                  Ver
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PendingFollowUps({ sport }: { sport: Sport }) {
  const queryClient = useQueryClient()
  const w = useWords()
  const staff = useStaff()
  const players = usePlayers(sport)
  const [adding, setAdding] = useState(false)
  const ids = players.data?.map((p) => p.id) ?? []

  const notes = useQuery({
    enabled: players.isSuccess,
    queryKey: ['notes', 'pending', sport],
    queryFn: async () =>
      ids.length === 0
        ? []
        : unwrap(
            await supabase
              .from('player_notes')
              .select('id, body, note_date, type, author_id, player_id')
              .eq('follow_up', true)
              .eq('follow_up_done', false)
              .in('player_id', ids)
              .order('note_date')
              .limit(30),
          ),
  })
  const resolve = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('set_note_follow_up_done', { p_note_id: id, p_done: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })
  const playerById = new Map(players.data?.map((p) => [p.id, p]))

  return (
    <section className="card">
      <div className="card-head">
        <h2>🔔 Seguimientos pendientes</h2>
        {!adding && (
          <button className="btn btn-primary btn-small" onClick={() => setAdding(true)} aria-label="Nuevo seguimiento" title="Nuevo seguimiento">
            ➕ <span className="hide-xs">Nuevo</span>
          </button>
        )}
      </div>
      {adding && (
        <NoteForm playerOptions={players.data ?? []} initialType="observacion" initialFollowUp onDone={() => setAdding(false)} />
      )}
      {(players.isPending || notes.isPending) && <Spinner />}
      {players.isError && <ErrorMessage error={players.error} onRetry={players.refetch} />}
      {notes.isError && <ErrorMessage error={notes.error} onRetry={notes.refetch} />}
      {resolve.isError && <ErrorMessage message={toMessage(resolve.error)} />}
      {notes.isSuccess && notes.data.length === 0 && !adding && <EmptyState>No hay seguimientos pendientes.</EmptyState>}
      <ul className="list">
        {notes.data?.map((n) => {
          const player = playerById.get(n.player_id)
          return (
            <li key={n.id} className="followup-row">
              <div>
                <Link to={`/jugadores/${n.player_id}`}>
                  <strong>{player ? playerName(player) : w.Player}</strong>
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
          )
        })}
      </ul>
    </section>
  )
}

function NoRecentNews({ sport, today, userId }: { sport: Sport; today: string; userId: string }) {
  const w = useWords()
  const prefKey = `judeval.noNewsDays.${userId}`
  const [days, setDays] = useState(() => readNumberPref(prefKey, NO_NEWS_DEFAULT, NO_NEWS_MIN, NO_NEWS_MAX))
  const [draft, setDraft] = useState(String(days))
  const categories = useCategories(sport)
  const players = usePlayers(sport)
  const news = useQuery({
    queryKey: ['notes', 'last-news', sport],
    queryFn: async () => unwrap(await supabase.rpc('player_last_news', { p_sport: sport })),
  })

  function commitDays(value: string) {
    const n = Math.round(Number(value))
    const clamped = Number.isFinite(n) ? Math.min(NO_NEWS_MAX, Math.max(NO_NEWS_MIN, n)) : days
    setDays(clamped)
    setDraft(String(clamped))
    writeNumberPref(prefKey, clamped)
  }

  const catName = new Map(categories.data?.map((c) => [c.id, c.name]))
  const playerById = new Map(players.data?.map((p) => [p.id, p]))
  const stale = (news.data ?? [])
    .map((r) => ({ ...r, ago: r.last_news_date ? daysBetween(r.last_news_date, today) : null }))
    .filter((r) => r.ago === null || r.ago >= days)
    .sort((a, b) => (b.ago ?? Infinity) - (a.ago ?? Infinity))

  return (
    <section className="card">
      <div className="card-head">
        <h2>🕒 Sin noticias individuales en {days} días</h2>
        <label className="inline-field small">
          Días
          <input
            type="number"
            min={NO_NEWS_MIN}
            max={NO_NEWS_MAX}
            className="input-narrow"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitDays(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitDays((e.target as HTMLInputElement).value)}
            aria-label="Número de días sin noticias"
          />
        </label>
      </div>
      <p className="muted small">
        {w.Players} sin ninguna nota nueva ni actualizada en su seguimiento. La guía propone dos conversaciones de 5–10 minutos por semana.
      </p>
      {(news.isPending || players.isPending) && <Spinner />}
      {news.isError && <ErrorMessage error={news.error} onRetry={news.refetch} />}
      {news.isSuccess && players.isSuccess && stale.length === 0 && (
        <EmptyState>
          {w.All} {w.thePl} {w.players} tienen noticias recientes. 👏
        </EmptyState>
      )}
      {stale.length > 0 && (
        <ul className="chips">
          {stale.map((r) => {
            const p = playerById.get(r.player_id)
            if (!p) return null
            return (
              <li key={r.player_id}>
                <Link className="chip" to={`/jugadores/${p.id}`}>
                  {playerName(p)}
                  <span className="muted small">
                    · {catName.get(p.category_id)} · {r.ago === null ? 'sin notas' : `hace ${r.ago} d`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
