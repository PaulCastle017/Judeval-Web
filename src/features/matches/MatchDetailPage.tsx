import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories, usePlayers } from '../../lib/queries'
import { formatLongDate, playerName, SPORT_EMOJI, todayISO } from '../../lib/format'
import { matchResultSchema, matchSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { labelsForSport, wordsForSport } from '../../i18n/useWords'
import { ConfirmButton, ErrorMessage, Field, Spinner, SuccessMessage } from '../../components/ui'
import { MatchResultBadge } from './MatchResultBadge'
import type { Enums, Tables, TablesUpdate } from '../../types/database'
import { parseSetRows, parseSets, type SetRow } from '../../lib/volley'
import { VolleySetsEditor } from './VolleySetsEditor'
import { Lineup } from './Lineup'

type MatchPlayer = Pick<Tables<'match_players'>, 'player_id' | 'status' | 'comment' | 'lineup_slot'>
type MatchWithSquad = Tables<'matches'> & { match_players: MatchPlayer[] }
type Status = Enums<'attendance_status'>

const STATUSES: Status[] = ['presente', 'ausente', 'justificado', 'lesionado']
const SHORT: Record<Status, string> = { presente: 'P', ausente: 'A', justificado: 'J', lesionado: 'L' }
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Clave que solo cambia si cambia la convocatoria (no al recargar tras guardar). */
const squadKey = (m: MatchWithSquad) =>
  `${m.id}-${m.match_players
    .map((p) => p.player_id)
    .sort()
    .join(',')}`

// Aviso (no límite) de convocatoria numerosa
const SQUAD_WARNING: Record<Enums<'sport_type'>, number> = { futsal: 12, voley: 14 }

/** /partidos/nuevo (alta) o /partidos/:id (datos, convocatoria, alineación, asistencia y resultado). */
export function MatchDetailPage() {
  const { id = '' } = useParams()
  const isNew = id === 'nuevo'
  const sport = useSport()
  const categories = useCategories()
  const match = useQuery({
    enabled: !isNew,
    queryKey: ['matches', 'detail', id],
    queryFn: async (): Promise<MatchWithSquad | null> =>
      unwrapMaybe(await supabase.from('matches').select('*, match_players(player_id, status, comment, lineup_slot)').eq('id', id).maybeSingle()),
  })

  if (categories.isPending || (!isNew && match.isPending)) return <Spinner />
  if (categories.isError) return <ErrorMessage error={categories.error} onRetry={categories.refetch} />
  if (match.isError) return <ErrorMessage error={match.error} onRetry={match.refetch} />
  if (!isNew && !match.data) return <ErrorMessage message="Partido no encontrado." />

  const m = isNew ? null : match.data!
  // Deporte del partido (por su categoría); en un alta, el activo
  const matchSport = (m && categories.data.find((c) => c.id === m.category_id)?.sport) || sport
  const sportCategories = categories.data.filter((c) => c.sport === matchSport)

  return (
    <div className="stack">
      <Link to="/partidos" className="back-link">
        ← Partidos
      </Link>
      <MatchForm key={m?.id ?? 'nuevo'} match={m} categories={sportCategories} />
      {/* Claves estables: recargar tras guardar no debe remontar (se perdería el aviso de guardado).
          El día de partido solo se reinicia si cambia la convocatoria. */}
      {m && <MatchSquad key={`squad-${m.id}`} match={m} sport={matchSport} />}
      {m && <Lineup key={`lineup-${squadKey(m)}`} matchId={m.id} squad={m.match_players} sport={matchSport} />}
      {m && m.match_date <= todayISO() && <MatchDay key={`day-${squadKey(m)}`} match={m} sport={matchSport} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Datos del partido
// ---------------------------------------------------------------------------

function MatchForm({ match, categories }: { match: MatchWithSquad | null; categories: Tables<'categories'>[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [params] = useSearchParams()
  const { profile, isAdmin } = useAuth()

  const initialCategory = categories.find((c) => c.id === (match?.category_id ?? params.get('categoria'))) ?? categories[0]
  const [form, setForm] = useState({
    category_id: initialCategory?.id ?? '',
    match_date: match?.match_date ?? params.get('fecha') ?? todayISO(),
    start_time: match?.start_time?.slice(0, 5) ?? '',
    opponent: match?.opponent ?? '',
    location: match?.location ?? '',
    venue: match?.venue ?? ('local' as Enums<'match_venue'>),
    competition: match?.competition ?? '',
    notes: match?.notes ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState(() => !!(location.state as { justSaved?: boolean } | null)?.justSaved)

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof matchSchema.parse>) => {
      if (match) return unwrap(await supabase.from('matches').update(values).eq('id', match.id).select('id').single())
      return unwrap(await supabase.from('matches').insert(values).select('id').single())
    },
    onSuccess: async (row) => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      // Tras crearlo, se abre su ficha para poder hacer la convocatoria
      if (!match) navigate(`/partidos/${row.id}`, { replace: true, state: { justSaved: true } })
    },
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('matches').delete().eq('id', match!.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      navigate('/partidos', { replace: true })
    },
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(matchSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <div>
          <h1>{match ? `vs ${match.opponent}` : 'Nuevo partido'}</h1>
          {match && (
            <p className="muted">
              {formatLongDate(match.match_date)}{' '}
              <MatchResultBadge goalsFor={match.goals_for} goalsAgainst={match.goals_against} sets={parseSets(match.sets)} />
            </p>
          )}
        </div>
        {match && (isAdmin || match.created_by === profile?.id) && (
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar partido (y su convocatoria)" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        )}
      </header>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}

      <div className="grid-3">
        <Field label="Categoría *" error={errors.category_id}>
          <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha *" error={errors.match_date}>
          <input type="date" value={form.match_date} onChange={(e) => set('match_date', e.target.value)} />
        </Field>
        <Field label="Hora" error={errors.start_time}>
          <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
        </Field>
        <Field label="Rival *" error={errors.opponent}>
          <input value={form.opponent} maxLength={120} placeholder="p. ej. CD Ejemplo" onChange={(e) => set('opponent', e.target.value)} />
        </Field>
        <Field label="Lugar" error={errors.location}>
          <input value={form.location} maxLength={200} placeholder="Pabellón, dirección…" onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Competición / jornada" error={errors.competition}>
          <input value={form.competition} maxLength={120} placeholder="p. ej. Liga · J5" onChange={(e) => set('competition', e.target.value)} />
        </Field>
      </div>
      <div className="row-tight" role="radiogroup" aria-label="Local o visitante">
        {(['local', 'visitante'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={form.venue === v}
            className={`chip${form.venue === v ? ' chip-on' : ''}`}
            onClick={() => set('venue', v)}
          >
            {v === 'local' ? '🏠 Local' : '✈️ Visitante'}
          </button>
        ))}
      </div>
      <Field label="Notas" error={errors.notes} hint="Hora de quedada, desplazamiento, equipación…">
        <textarea rows={2} maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {saved && <SuccessMessage>{match ? 'Partido guardado.' : 'Partido creado.'}</SuccessMessage>}
      <div className="row">
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : match ? 'Guardar datos' : 'Crear partido'}
        </button>
        {!match && (
          <Link to="/partidos" className="btn btn-ghost">
            Cancelar
          </Link>
        )}
      </div>
      {!match && <p className="muted small">Después de crearlo podrás hacer la convocatoria.</p>}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Convocatoria
// ---------------------------------------------------------------------------

function MatchSquad({ match, sport }: { match: MatchWithSquad; sport: Enums<'sport_type'> }) {
  const queryClient = useQueryClient()
  const w = wordsForSport(sport)
  const labels = labelsForSport(sport)
  const players = usePlayers(sport)
  const [selected, setSelected] = useState<string[]>(match.match_players.map((p) => p.player_id))
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)

  const roster = useMemo(
    () => (players.data ?? []).filter((p) => p.category_id === match.category_id && p.status !== 'baja'),
    [players.data, match.category_id],
  )
  const term = normalize(search.trim())
  const visible = roster.filter((p) => !term || normalize(`${p.first_name} ${p.last_name} ${p.display_name}`).includes(term))
  const original = new Set(match.match_players.map((p) => p.player_id))
  const removingWithAttendance = match.match_players.filter((p) => p.status && !selected.includes(p.player_id)).length

  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('set_match_squad', { p_match_id: match.id, p_player_ids: selected })),
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  function toggle(id: string) {
    setSaved(false)
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  const dirty = selected.length !== original.size || selected.some((id) => !original.has(id))

  return (
    <section className="card stack-sm">
      <div className="card-head">
        <h2>
          📋 Convocatoria · {selected.length} {selected.length === 1 ? w.calledUp : w.calledUpPl}
        </h2>
        <span className="row-tight">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setSaved(false)
              setSelected(roster.filter((p) => p.status !== 'lesionado').map((p) => p.id))
            }}
          >
            Convocar a {w.all}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setSaved(false)
              setSelected([])
            }}
          >
            Quitar a {w.all}
          </button>
        </span>
      </div>
      <p className="muted small">
        «Convocar a {w.all}» no incluye a {w.thePl} {w.injuredPl}; puedes añadirlos a mano.
      </p>
      {roster.length > 8 && (
        <input type="search" placeholder={`Buscar ${w.player}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      )}
      {players.isPending && <Spinner />}
      {players.isError && <ErrorMessage error={players.error} onRetry={players.refetch} />}
      {players.isSuccess && roster.length === 0 && <p className="muted">No hay {w.players} en esta categoría.</p>}
      <ul className="chips">
        {visible.map((p) => {
          const on = selected.includes(p.id)
          return (
            <li key={p.id}>
              <button type="button" className={`chip${on ? ' chip-on' : ''}`} aria-pressed={on} onClick={() => toggle(p.id)}>
                {on ? '✓ ' : '+ '}
                {playerName(p)}
                {p.status === 'lesionado' && <span className={on ? '' : 'muted small'}> · {labels.status.lesionado.toLowerCase()}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {selected.length > SQUAD_WARNING[sport] && (
        <p className="small text-warn">
          Hay {selected.length} {w.calledUpPl}: más de lo habitual ({SQUAD_WARNING[sport]}). Revisa el máximo que permite la competición.
        </p>
      )}
      {removingWithAttendance > 0 && (
        <p className="small text-danger">
          Al guardar se borrará la asistencia ya marcada de {removingWithAttendance}{' '}
          {removingWithAttendance === 1 ? w.player : w.players} que quitas de la convocatoria (y su puesto en la alineación).
        </p>
      )}
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {saved && !dirty && <SuccessMessage>Convocatoria guardada.</SuccessMessage>}
      <div>
        <button type="button" className="btn btn-primary" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando…' : 'Guardar convocatoria'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Día de partido: asistencia de los convocados y resultado
// ---------------------------------------------------------------------------

function MatchDay({ match, sport }: { match: MatchWithSquad; sport: Enums<'sport_type'> }) {
  const queryClient = useQueryClient()
  const w = wordsForSport(sport)
  const labels = labelsForSport(sport)
  const players = usePlayers(sport)
  const playerById = new Map(players.data?.map((p) => [p.id, p]))
  const squad = [...match.match_players].sort((a, b) =>
    playerName(playerById.get(a.player_id) ?? { first_name: '', last_name: '', display_name: '' }).localeCompare(
      playerName(playerById.get(b.player_id) ?? { first_name: '', last_name: '', display_name: '' }),
    ),
  )

  const [marks, setMarks] = useState<Record<string, Status | null>>(() =>
    Object.fromEntries(match.match_players.map((p) => [p.player_id, p.status])),
  )
  const [score, setScore] = useState({ goals_for: match.goals_for?.toString() ?? '', goals_against: match.goals_against?.toString() ?? '' })
  // Voley: 5 filas (solo se muestran las que hacen falta), rellenas con los sets guardados
  const [setRows, setSetRows] = useState<SetRow[]>(() => {
    const saved = parseSets(match.sets) ?? []
    return Array.from({ length: 5 }, (_, i) => ({ for: saved[i]?.for.toString() ?? '', against: saved[i]?.against.toString() ?? '' }))
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: async (result: TablesUpdate<'matches'>) => {
      const rows = squad.map((p) => ({ match_id: match.id, player_id: p.player_id, status: marks[p.player_id] ?? null }))
      if (rows.length) unwrap(await supabase.from('match_players').upsert(rows, { onConflict: 'match_id,player_id' }))
      unwrap(await supabase.from('matches').update(result).eq('id', match.id).select('id').single())
    },
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  function onSave() {
    if (sport === 'voley') {
      const parsed = parseSetRows(setRows)
      if (!parsed.ok) return setErrors({ sets: parsed.error })
      setErrors({})
      // Los sets ganados (goals_for / goals_against) los calcula la base de datos
      return save.mutate(parsed.sets ? { sets: parsed.sets } : { sets: null, goals_for: null, goals_against: null })
    }
    const parsed = parseForm(matchResultSchema, score)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <section className="card stack">
      <h2>{SPORT_EMOJI[sport]} Día de partido</h2>

      <div className="stack-sm">
        <h3>Resultado</h3>
        {sport === 'voley' ? (
          <VolleySetsEditor
            rows={setRows}
            opponent={match.opponent}
            error={errors.sets}
            onChange={(rows) => {
              setSaved(false)
              setSetRows(rows)
            }}
          />
        ) : (
        <div className="score-row">
          <Field label="JUDEVAL" error={errors.goals_for}>
            <input
              inputMode="numeric"
              className="score-input"
              value={score.goals_for}
              onChange={(e) => {
                setSaved(false)
                setScore({ ...score, goals_for: e.target.value.replace(/\D/g, '').slice(0, 2) })
              }}
            />
          </Field>
          <span className="score-sep" aria-hidden="true">
            –
          </span>
          <Field label={match.opponent} error={errors.goals_against}>
            <input
              inputMode="numeric"
              className="score-input"
              value={score.goals_against}
              onChange={(e) => {
                setSaved(false)
                setScore({ ...score, goals_against: e.target.value.replace(/\D/g, '').slice(0, 2) })
              }}
            />
          </Field>
        </div>
        )}
      </div>

      <div className="stack-sm">
        <h3>Asistencia de {w.thePl} {w.calledUpPl}</h3>
        {squad.length === 0 ? (
          <p className="muted">Primero guarda la convocatoria.</p>
        ) : (
          <ul className="list attendance-list">
            {squad.map((p) => {
              const player = playerById.get(p.player_id)
              const name = player ? playerName(player) : '…'
              return (
                <li key={p.player_id} className="attendance-row">
                  <div className="attendance-name">
                    <Link to={`/jugadores/${p.player_id}`}>{name}</Link>
                  </div>
                  <div className="toggle-group" role="radiogroup" aria-label={`Asistencia de ${name}`}>
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={marks[p.player_id] === s}
                        title={labels.attendance[s]}
                        className={`toggle toggle-${s}${marks[p.player_id] === s ? ' on' : ''}`}
                        onClick={() => {
                          setSaved(false)
                          setMarks((m) => ({ ...m, [p.player_id]: m[p.player_id] === s ? null : s }))
                        }}
                      >
                        {SHORT[s]}
                        <span className="sr-only"> {labels.attendance[s]}</span>
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {saved && <SuccessMessage>Asistencia y resultado guardados.</SuccessMessage>}
      <div>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar asistencia y resultado'}
        </button>
      </div>
    </section>
  )
}
