import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCategories, usePlayers } from '../../lib/queries'
import { playerName, POSITION_LABELS, SPORT_EMOJI, STATUS_LABELS } from '../../lib/format'
import { Badge, EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'
import { PlayerForm } from './PlayerForm'
import { useSport } from '../../sport/SportProvider'

const STATUS_FILTERS = [
  { value: 'vigentes', label: 'Activos y lesionados' },
  { value: 'activo', label: 'Solo activos' },
  { value: 'lesionado', label: 'Lesionados' },
  { value: 'baja', label: 'Bajas' },
  { value: 'todos', label: 'Todos' },
]

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function PlayersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sport = useSport()
  const statusFilter = params.get('estado') ?? 'vigentes'
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const categories = useCategories(sport)
  const players = usePlayers(sport)
  // Una categoría de otro deporte en la URL se ignora
  const requestedCategory = params.get('categoria') ?? ''
  const categoryFilter = categories.data?.some((c) => c.id === requestedCategory) ? requestedCategory : ''

  const grouped = useMemo(() => {
    const term = normalize(search.trim())
    const list = (players.data ?? []).filter((p) => {
      if (categoryFilter && p.category_id !== categoryFilter) return false
      if (statusFilter === 'vigentes' && p.status === 'baja') return false
      if (!['vigentes', 'todos'].includes(statusFilter) && p.status !== statusFilter) return false
      if (term && !normalize(`${p.first_name} ${p.last_name} ${p.display_name}`).includes(term)) return false
      return true
    })
    return (categories.data ?? [])
      .map((c) => ({ category: c, players: list.filter((p) => p.category_id === c.id) }))
      .filter((g) => g.players.length > 0)
  }, [players.data, categories.data, categoryFilter, statusFilter, search])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  if (creating) {
    return (
      <PlayerForm
        defaultCategoryId={categoryFilter || undefined}
        onSaved={(id) => navigate(`/jugadores/${id}`)}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="stack">
      <PageHeader
        title={`${SPORT_EMOJI[sport]} Jugadores`}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nuevo jugador
          </button>
        }
      />

      <div className="filters">
        <input type="search" placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoryFilter} onChange={(e) => setParam('categoria', e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setParam('estado', e.target.value)} aria-label="Estado">
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {(players.isPending || categories.isPending) && <Spinner />}
      {players.isError && <ErrorMessage error={players.error} onRetry={players.refetch} />}
      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}

      {players.isSuccess && categories.isSuccess && grouped.length === 0 && (
        <EmptyState>No hay jugadores que coincidan con los filtros.</EmptyState>
      )}

      {grouped.map(({ category, players: list }) => (
        <section key={category.id} className="stack-sm">
          <h2>
            {category.name} <span className="muted small">({list.length})</span>
          </h2>
          <ul className="card list">
            {list.map((p) => (
              <li key={p.id}>
                <Link to={`/jugadores/${p.id}`} className="list-link">
                  <span className="list-main">
                    <strong>{playerName(p)}</strong>
                    {p.availability_notes && <span className="muted small">{p.availability_notes}</span>}
                  </span>
                  <span className="row-tight">
                    {p.position === 'portero' && <Badge tone="info">{POSITION_LABELS.portero}</Badge>}
                    {p.status !== 'activo' && <Badge tone={p.status === 'lesionado' ? 'warn' : 'neutral'}>{STATUS_LABELS[p.status]}</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
