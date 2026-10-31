import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useStaff } from '../../lib/queries'
import { formatDate, NOTE_TOPIC_LABELS, NOTE_TYPE_LABELS, playerName, todayISO } from '../../lib/format'
import { noteSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, ConfirmButton, EmptyState, ErrorMessage, Field } from '../../components/ui'
import type { Enums, Tables } from '../../types/database'

type Note = Tables<'player_notes'>

const TYPE_TONE: Record<Enums<'note_type'>, string> = {
  observacion: 'neutral',
  conversacion: 'info',
  reconocimiento: 'success',
  incidencia: 'warn',
}

const TYPE_HINTS: Record<Enums<'note_type'>, string> = {
  observacion: 'Describe conductas observadas, no etiquetas. Evita diagnósticos no confirmados.',
  conversacion: 'Conversación individual (5–10 min). Anota lo relevante para retomarlo otro día.',
  reconocimiento: 'Avance concreto: escuchar, animar a un compañero, volver a intentarlo, mantener la calma…',
  incidencia: 'Qué ocurrió, cómo afecta al grupo, qué se espera y cómo se repara.',
}

type NoteFormProps = {
  /** Jugador fijo (desde su ficha). Si se omite, se muestra un selector con `playerOptions`. */
  playerId?: string
  playerOptions?: (Tables<'players'> & { category?: unknown })[]
  note?: Note
  initialType?: Enums<'note_type'>
  initialFollowUp?: boolean
  onDone: () => void
}

export function NoteForm({ playerId, playerOptions, note, initialType, initialFollowUp, onDone }: NoteFormProps) {
  const queryClient = useQueryClient()
  const [selectedPlayer, setSelectedPlayer] = useState(playerId ?? '')
  const [form, setForm] = useState({
    type: note?.type ?? initialType ?? ('conversacion' as Enums<'note_type'>),
    topic: (note?.topic ?? '') as Enums<'note_topic'> | '',
    body: note?.body ?? '',
    note_date: note?.note_date ?? todayISO(),
    follow_up: note?.follow_up ?? initialFollowUp ?? false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof noteSchema.parse>) => {
      if (note) {
        unwrap(await supabase.from('player_notes').update(values).eq('id', note.id).select('id').single())
      } else {
        unwrap(await supabase.from('player_notes').insert({ ...values, player_id: selectedPlayer }).select('id').single())
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
      onDone()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(noteSchema, { ...form, topic: form.type === 'conversacion' ? form.topic : '' })
    if (!note && !selectedPlayer) return setErrors({ ...(parsed.ok ? {} : parsed.errors), player: 'Elige un jugador' })
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack note-form" onSubmit={onSubmit} noValidate>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {!note && !playerId && (
        <Field label="Jugador *" error={errors.player}>
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} autoFocus>
            <option value="">— Elige jugador —</option>
            {playerOptions
              ?.filter((p) => p.status !== 'baja')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
          </select>
        </Field>
      )}
      <div className="chips" role="radiogroup" aria-label="Tipo de nota">
        {(Object.keys(NOTE_TYPE_LABELS) as Enums<'note_type'>[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={form.type === t}
            className={`chip${form.type === t ? ' chip-on' : ''}`}
            onClick={() => setForm({ ...form, type: t })}
          >
            {NOTE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="muted small">{TYPE_HINTS[form.type]}</p>
      <div className="grid-2">
        <Field label="Fecha" error={errors.note_date}>
          <input type="date" value={form.note_date} max={todayISO()} onChange={(e) => setForm({ ...form, note_date: e.target.value })} />
        </Field>
        {form.type === 'conversacion' && (
          <Field label="Tema" error={errors.topic}>
            <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value as Enums<'note_topic'> | '' })}>
              <option value="">— Sin tema concreto —</option>
              {Object.entries(NOTE_TOPIC_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Nota" error={errors.body}>
        <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={4000} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" checked={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.checked })} />
        Requiere seguimiento (aparecerá en Inicio hasta marcarlo como resuelto)
      </label>
      <div className="row">
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : note ? 'Guardar cambios' : 'Añadir nota'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function NoteList({ notes, playerId }: { notes: Note[]; playerId: string }) {
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Enums<'note_type'> | ''>('')
  const [editing, setEditing] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('player_notes').delete().eq('id', id).select('id')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })
  const toggleFollowUp = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await supabase.rpc('set_note_follow_up_done', { p_note_id: id, p_done: done })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  const visible = filter ? notes.filter((n) => n.type === filter) : notes

  return (
    <div className="stack-sm">
      <div className="chips">
        <button className={`chip${filter === '' ? ' chip-on' : ''}`} onClick={() => setFilter('')}>
          Todas ({notes.length})
        </button>
        {(Object.keys(NOTE_TYPE_LABELS) as Enums<'note_type'>[]).map((t) => {
          const n = notes.filter((x) => x.type === t).length
          return n ? (
            <button key={t} className={`chip${filter === t ? ' chip-on' : ''}`} onClick={() => setFilter(t)}>
              {NOTE_TYPE_LABELS[t]} ({n})
            </button>
          ) : null
        })}
      </div>
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      {toggleFollowUp.isError && <ErrorMessage message={toMessage(toggleFollowUp.error)} />}
      {visible.length === 0 && <EmptyState>No hay notas todavía.</EmptyState>}
      {visible.map((n) =>
        editing === n.id ? (
          <NoteForm key={n.id} playerId={playerId} note={n} onDone={() => setEditing(null)} />
        ) : (
          <article key={n.id} className="card note">
            <header className="note-head">
              <span className="row-tight">
                <Badge tone={TYPE_TONE[n.type]}>{NOTE_TYPE_LABELS[n.type]}</Badge>
                {n.topic && <span className="muted small">{NOTE_TOPIC_LABELS[n.topic]}</span>}
              </span>
              <span className="muted small">
                {formatDate(n.note_date)} · {staffName(staff.data, n.author_id)}
              </span>
            </header>
            <p className="note-body">{n.body}</p>
            <footer className="row">
              {n.follow_up && (
                <label className="checkbox small">
                  <input
                    type="checkbox"
                    checked={n.follow_up_done}
                    disabled={toggleFollowUp.isPending}
                    onChange={(e) => toggleFollowUp.mutate({ id: n.id, done: e.target.checked })}
                  />
                  {n.follow_up_done ? 'Seguimiento resuelto' : 'Seguimiento pendiente'}
                </label>
              )}
              {(isAdmin || n.author_id === profile?.id) && (
                <span className="row-tight push-right">
                  <button className="btn btn-ghost btn-small" onClick={() => setEditing(n.id)}>
                    Editar
                  </button>
                  <ConfirmButton onConfirm={() => remove.mutate(n.id)} disabled={remove.isPending}>
                    Borrar
                  </ConfirmButton>
                </span>
              )}
            </footer>
          </article>
        ),
      )}
    </div>
  )
}
