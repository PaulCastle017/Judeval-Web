import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, useCategories, usePlayers } from '../../lib/queries'
import { formatDate, playerName, seasonStart, SPORT_EMOJI, todayISO } from '../../lib/format'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'
import { useSport } from '../../sport/SportProvider'

export function AttendanceHistoryPage() {
  const [params, setParams] = useSearchParams()
  const sport = useSport()
  const categories = useCategories(sport)
  const players = usePlayers(sport)

  const requestedCategory = params.get('categoria') ?? ''
  const categoryId = (categories.data?.some((c) => c.id === requestedCategory) ? requestedCategory : categories.data?.[0]?.id) ?? ''
  const to = params.get('hasta') || todayISO()
  const from = params.get('desde') || seasonStart(to)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  const stats = useQuery({
    enabled: !!categoryId,
    queryKey: ['attendance', 'stats', categoryId, from, to],
    queryFn: async () => unwrap(await supabase.rpc('player_attendance_stats', { p_category_id: categoryId, p_from: from, p_to: to })),
  })
  const sessions = useQuery({
    enabled: !!categoryId,
    queryKey: ['sessions', 'list', categoryId, from, to],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('training_sessions')
          .select('id, session_date, closing_question, attendance(status)')
          .eq('category_id', categoryId)
          .gte('session_date', from)
          .lte('session_date', to)
          .order('session_date', { ascending: false }),
      ),
  })

  const rows = useMemo(() => {
    const byId = new Map((stats.data ?? []).map((s) => [s.player_id, s]))
    return (players.data ?? [])
      .filter((p) => byId.has(p.id) || (p.category_id === categoryId && p.status !== 'baja'))
      .map((p) => ({ player: p, stat: byId.get(p.id) }))
      .sort((a, b) => (a.stat?.rate ?? -1) - (b.stat?.rate ?? -1))
  }, [stats.data, players.data, categoryId])

  const loading = stats.isPending || sessions.isPending || players.isPending

  return (
    <div className="stack">
      <Link to="/asistencia" className="back-link">
        ← Pasar lista
      </Link>
      <PageHeader title={`${SPORT_EMOJI[sport]} Historial de asistencia`} subtitle="El porcentaje no cuenta las sesiones en las que el jugador estaba lesionado." />
      <div className="filters">
        <select value={categoryId} onChange={(e) => setParam('categoria', e.target.value)} aria-label="Categoría">
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="inline-field">
          Desde <input type="date" value={from} onChange={(e) => e.target.value && setParam('desde', e.target.value)} />
        </label>
        <label className="inline-field">
          Hasta <input type="date" value={to} onChange={(e) => e.target.value && setParam('hasta', e.target.value)} />
        </label>
      </div>

      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}
      {stats.isError && <ErrorMessage error={stats.error} onRetry={stats.refetch} />}
      {sessions.isError && <ErrorMessage error={sessions.error} onRetry={sessions.refetch} />}
      {loading && categoryId && <Spinner />}

      {!loading && (
        <>
          <section className="card">
            <h2>Por jugador</h2>
            {rows.length === 0 ? (
              <EmptyState>Sin datos en este periodo.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th title="Presente">P</th>
                      <th title="Ausente">A</th>
                      <th title="Justificado">J</th>
                      <th title="Lesionado">L</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ player, stat }) => (
                      <tr key={player.id}>
                        <td>
                          <Link to={`/jugadores/${player.id}`}>{playerName(player)}</Link>
                        </td>
                        <td>{stat?.presente ?? 0}</td>
                        <td>{stat?.ausente ?? 0}</td>
                        <td>{stat?.justificado ?? 0}</td>
                        <td>{stat?.lesionado ?? 0}</td>
                        <td>
                          {stat?.rate != null ? (
                            <span className={`rate ${stat.rate >= 75 ? 'good' : stat.rate >= 50 ? 'mid' : 'low'}`}>{stat.rate}%</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Sesiones ({sessions.data?.length ?? 0})</h2>
            {sessions.data?.length === 0 && <EmptyState>No hay sesiones registradas en este periodo.</EmptyState>}
            <ul className="list">
              {sessions.data?.map((s) => (
                <li key={s.id}>
                  <Link to={`/asistencia?categoria=${categoryId}&fecha=${s.session_date}`} className="list-link">
                    <span className="list-main">
                      <strong>{formatDate(s.session_date)}</strong>
                      {s.closing_question && <span className="muted small">{s.closing_question}</span>}
                    </span>
                    <span className="muted small">
                      {s.attendance.filter((a) => a.status === 'presente').length}/{s.attendance.length} presentes
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
