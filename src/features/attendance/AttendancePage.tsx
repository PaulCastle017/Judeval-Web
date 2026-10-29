import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories, useCoachCategories, usePlayers } from '../../lib/queries'
import { ATTENDANCE_LABELS, formatLongDate, formatTime, isoWeekday, playerName, todayISO } from '../../lib/format'
import { parseForm, sessionSchema } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { ConfirmButton, EmptyState, ErrorMessage, Field, PageHeader, Spinner, SuccessMessage } from '../../components/ui'
import type { Enums, Tables } from '../../types/database'

type Status = Enums<'attendance_status'>
type Mark = { status: Status | null; comment: string }

const STATUSES: Status[] = ['presente', 'ausente', 'justificado', 'lesionado']
const SHORT: Record<Status, string> = { presente: 'P', ausente: 'A', justificado: 'J', lesionado: 'L' }

// Hábito 2.5 de la guía: cerrar con una pregunta breve
const CLOSING_QUESTIONS = [
  '¿Qué ha hecho hoy el equipo para ayudarse?',
  '¿Qué podemos mejorar en la forma de tratarnos?',
  '¿Qué ha salido mejor como grupo?',
]

export function AttendancePage() {
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const categories = useCategories()
  const coachCategories = useCoachCategories()

  const myFirstCategory = coachCategories.data?.find((cc) => cc.coach_id === profile?.id)?.category_id
  const categoryId = params.get('categoria') || myFirstCategory || categories.data?.[0]?.id || ''
  const date = params.get('fecha') || todayISO()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set('categoria', categoryId)
    next.set('fecha', date)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  const category = categories.data?.find((c) => c.id === categoryId)
  const isTrainingDay = category ? category.training_weekdays.includes(isoWeekday(date)) : true

  return (
    <div className="stack">
      <PageHeader
        title="Pasar lista"
        actions={
          <Link to="/asistencia/historial" className="btn btn-ghost">
            Historial
          </Link>
        }
      />
      <div className="filters">
        <select value={categoryId} onChange={(e) => setParam('categoria', e.target.value)} aria-label="Categoría">
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setParam('fecha', e.target.value)} aria-label="Fecha" />
      </div>
      {categories.isPending && <Spinner />}
      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}
      {category && (
        <p className="muted">
          {formatLongDate(date)} · {category.name}
          {category.start_time && ` · ${formatTime(category.start_time)}–${formatTime(category.end_time)}`}
          {!isTrainingDay && ' · ⚠ No es un día habitual de entrenamiento de esta categoría'}
        </p>
      )}
      {category && <SessionLoader category={category} date={date} />}
    </div>
  )
}

function SessionLoader({ category, date }: { category: Tables<'categories'>; date: string }) {
  const players = usePlayers()
  // Se guarda aquí porque la hoja se vuelve a montar al recargar los datos tras guardar.
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const sheetKey = `${category.id}-${date}`
  const session = useQuery({
    queryKey: ['sessions', category.id, date],
    queryFn: async () =>
      unwrapMaybe(
        await supabase
          .from('training_sessions')
          .select('*, attendance(*)')
          .eq('category_id', category.id)
          .eq('session_date', date)
          .maybeSingle(),
      ),
  })

  if (players.isPending || session.isPending) return <Spinner />
  if (players.isError) return <ErrorMessage error={players.error} onRetry={players.refetch} />
  if (session.isError) return <ErrorMessage error={session.error} onRetry={session.refetch} />

  const saved = session.data?.attendance ?? []
  const savedIds = new Set(saved.map((a) => a.player_id))
  // Jugadores de la categoría (sin bajas) + cualquiera que ya figure en la lista guardada
  const roster = players.data.filter((p) => (p.category_id === category.id && p.status !== 'baja' && p.active) || savedIds.has(p.id))

  return (
    <AttendanceSheet
      key={`${sheetKey}-${session.dataUpdatedAt}`}
      categoryId={category.id}
      date={date}
      session={session.data}
      roster={roster}
      savedOk={savedKey === sheetKey}
      onSaved={() => setSavedKey(sheetKey)}
    />
  )
}

type SessionWithAttendance = Tables<'training_sessions'> & { attendance: Tables<'attendance'>[] }

function AttendanceSheet({
  categoryId,
  date,
  session,
  roster,
  savedOk,
  onSaved,
}: {
  categoryId: string
  date: string
  session: SessionWithAttendance | null
  roster: Tables<'players'>[]
  savedOk: boolean
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const { profile, isAdmin } = useAuth()
  const initialMarks = useMemo(() => {
    const m: Record<string, Mark> = {}
    for (const p of roster) m[p.id] = { status: null, comment: '' }
    for (const a of session?.attendance ?? []) m[a.player_id] = { status: a.status, comment: a.comment }
    return m
  }, [roster, session])

  const [marks, setMarks] = useState(initialMarks)
  const [fields, setFields] = useState({
    notes: session?.notes ?? '',
    closing_question: session?.closing_question ?? '',
    closing_summary: session?.closing_summary ?? '',
  })
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const marked = Object.values(marks).filter((m) => m.status).length
  const present = Object.values(marks).filter((m) => m.status === 'presente').length

  function setMark(playerId: string, patch: Partial<Mark>) {
    setDirty(true)
    setMarks((m) => ({ ...m, [playerId]: { ...m[playerId], ...patch } }))
  }

  function markAllUnsetPresent() {
    setDirty(true)
    setMarks((m) => {
      const next = { ...m }
      for (const p of roster) {
        if (!next[p.id].status) next[p.id] = { ...next[p.id], status: p.status === 'lesionado' ? 'lesionado' : 'presente' }
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof sessionSchema.parse>) => {
      const s = unwrap(
        await supabase
          .from('training_sessions')
          .upsert({ category_id: categoryId, session_date: date, ...values }, { onConflict: 'category_id,session_date' })
          .select('id')
          .single(),
      )
      const rows = Object.entries(marks)
        .filter(([, m]) => m.status)
        .map(([player_id, m]) => ({ session_id: s.id, player_id, status: m.status as Status, comment: m.comment.trim().slice(0, 300) }))
      if (rows.length) unwrap(await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,player_id' }))

      const removed = (session?.attendance ?? []).filter((a) => !marks[a.player_id]?.status).map((a) => a.player_id)
      if (removed.length) unwrap(await supabase.from('attendance').delete().eq('session_id', s.id).in('player_id', removed))
    },
    onSuccess: async () => {
      onSaved()
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  const removeSession = useMutation({
    mutationFn: async () => unwrap(await supabase.from('training_sessions').delete().eq('id', session!.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  function onSave() {
    setFormError(null)
    const parsed = parseForm(sessionSchema, fields)
    if (!parsed.ok) return setFormError(Object.values(parsed.errors)[0] ?? 'Datos no válidos')
    if (marked === 0 && !session) return setFormError('Marca la asistencia de al menos un jugador.')
    save.mutate(parsed.data)
  }

  if (roster.length === 0) {
    return (
      <EmptyState>
        No hay jugadores en esta categoría. <Link to="/jugadores">Añade jugadores</Link> primero.
      </EmptyState>
    )
  }

  return (
    <div className="stack">
      <div className="row space-between">
        <span>
          <strong>{present}</strong> presentes · {marked}/{roster.length} marcados
          {session && <span className="muted small"> · lista guardada</span>}
        </span>
        <button type="button" className="btn btn-small" onClick={markAllUnsetPresent}>
          Marcar resto como presentes
        </button>
      </div>

      <ul className="card list attendance-list">
        {roster.map((p) => {
          const m = marks[p.id]
          return (
            <li key={p.id} className="attendance-row">
              <div className="attendance-name">
                <Link to={`/jugadores/${p.id}`}>{playerName(p)}</Link>
                {p.status === 'lesionado' && <span className="muted small"> · lesionado</span>}
                {p.availability_notes && <span className="muted small block">{p.availability_notes}</span>}
              </div>
              <div className="toggle-group" role="radiogroup" aria-label={`Asistencia de ${playerName(p)}`}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={m.status === s}
                    title={ATTENDANCE_LABELS[s]}
                    className={`toggle toggle-${s}${m.status === s ? ' on' : ''}`}
                    onClick={() => setMark(p.id, { status: m.status === s ? null : s })}
                  >
                    {SHORT[s]}
                    <span className="sr-only"> {ATTENDANCE_LABELS[s]}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`toggle toggle-comment${m.comment ? ' on' : ''}`}
                  title="Comentario"
                  aria-label="Comentario"
                  onClick={() => setOpenComment(openComment === p.id ? null : p.id)}
                >
                  ✎
                </button>
              </div>
              {openComment === p.id && (
                <input
                  className="attendance-comment"
                  placeholder="Comentario (p. ej. motivo de la ausencia)"
                  maxLength={300}
                  value={m.comment}
                  onChange={(e) => setMark(p.id, { comment: e.target.value })}
                  autoFocus
                />
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted small">P = presente · A = ausente · J = justificado · L = lesionado. Pulsa de nuevo para desmarcar.</p>

      <section className="card stack">
        <h2>Cierre del entrenamiento</h2>
        <Field label="Pregunta de cierre" hint="Respuestas voluntarias. Los asuntos delicados, en privado.">
          <input
            list="closing-questions"
            value={fields.closing_question}
            maxLength={300}
            onChange={(e) => setFields({ ...fields, closing_question: e.target.value })}
          />
          <datalist id="closing-questions">
            {CLOSING_QUESTIONS.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </Field>
        <Field label="¿Qué respondió el grupo?">
          <textarea
            rows={2}
            maxLength={2000}
            value={fields.closing_summary}
            onChange={(e) => setFields({ ...fields, closing_summary: e.target.value })}
          />
        </Field>
        <Field label="Notas de la sesión">
          <textarea rows={2} maxLength={2000} value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} />
        </Field>
      </section>

      {formError && <ErrorMessage message={formError} />}
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {removeSession.isError && <ErrorMessage message={toMessage(removeSession.error)} />}
      {savedOk && !dirty && <SuccessMessage>Lista guardada correctamente.</SuccessMessage>}

      <div className="row sticky-actions">
        <button className="btn btn-primary btn-large" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar lista'}
        </button>
        {session && (isAdmin || session.created_by === profile?.id) && (
          <ConfirmButton onConfirm={() => removeSession.mutate()} confirmText="Eliminar esta sesión" disabled={removeSession.isPending}>
            Eliminar sesión
          </ConfirmButton>
        )}
      </div>
    </div>
  )
}
