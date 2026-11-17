import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, unwrapMaybe, useStaff } from '../../lib/queries'
import { addDays, formatLongDate, formatTime, SPORT_LABELS, todayISO } from '../../lib/format'
import { calendarEventSchema, parseForm } from '../../lib/validation'
import { useFieldErrors } from '../../lib/useFieldErrors'
import { KIND_LABELS, monthOf, sportTag } from '../../lib/calendar'
import { upcomingWeekend } from '../../lib/defaults'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { ConfirmButton, ErrorMessage, Field, Spinner, SuccessMessage } from '../../components/ui'
import { DateChips, Segmented } from '../../components/pickers'
import type { Tables } from '../../types/database'

type EventRow = Tables<'calendar_events'>
type Kind = 'reunion' | 'otro' | 'partido'

/** /calendario/nuevo?fecha=AAAA-MM-DD&tipo=reunion|otro|partido */
export function NewEventPage() {
  const [params] = useSearchParams()
  const date = params.get('fecha') ?? todayISO()
  const tipo = params.get('tipo')
  return (
    <div className="stack">
      <Link to={`/calendario?mes=${monthOf(date)}&dia=${date}`} className="back-link">
        ← Calendario
      </Link>
      <h1>Nuevo evento</h1>
      <EventForm event={null} initialDate={date} initialKind={tipo === 'otro' || tipo === 'partido' ? tipo : 'reunion'} />
    </div>
  )
}

/** /calendario/evento/:id · detalle, edición (todo el staff), borrar (autor o admin) y acta si es una reunión. */
export function EventDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  const [editing, setEditing] = useState(false)
  const justSaved = Boolean((location.state as { justSaved?: boolean } | null)?.justSaved)

  const event = useQuery({
    queryKey: ['calendar', 'event', id],
    queryFn: async () => unwrapMaybe(await supabase.from('calendar_events').select('*, meetings(id, title)').eq('id', id).maybeSingle()),
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('calendar_events').delete().eq('id', id).select('id')),
    onSuccess: async (rows) => {
      if (!rows.length) throw new Error('Solo quien creó el evento (o un admin) puede borrarlo.')
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate(`/calendario?mes=${monthOf(event.data!.event_date)}`, { replace: true })
    },
  })

  if (event.isPending) return <Spinner />
  if (event.isError) return <ErrorMessage error={event.error} onRetry={event.refetch} />
  if (!event.data) return <ErrorMessage message="Evento no encontrado." />
  const e = event.data
  const acta = e.meetings ?? null // event_id es único: como mucho un acta por evento
  const canDelete = isAdmin || e.created_by === profile?.id

  return (
    <div className="stack">
      <Link to={`/calendario?mes=${monthOf(e.event_date)}&dia=${e.event_date}`} className="back-link">
        ← Calendario
      </Link>
      {editing ? (
        <>
          <h1>Editar evento</h1>
          <EventForm event={e} initialDate={e.event_date} initialKind={e.kind} onDone={() => setEditing(false)} />
        </>
      ) : (
        <article className={`card stack-sm cal-event-card cal-${e.kind}`}>
          <header className="page-header">
            <div>
              <p className="muted small">
                {KIND_LABELS[e.kind].icon} {KIND_LABELS[e.kind].label} · {e.sport ? `${sportTag(e.sport)} ${SPORT_LABELS[e.sport]}` : 'Club (los dos deportes)'}
              </p>
              <h1>{e.title}</h1>
              <p className="muted">
                {formatLongDate(e.event_date)}
                {e.start_time && ` · ${formatTime(e.start_time)}`}
                {e.end_time && `–${formatTime(e.end_time)}`}
                {e.location && ` · ${e.location}`}
              </p>
            </div>
            <span className="row">
              <button type="button" className="btn btn-small" onClick={() => setEditing(true)}>
                ✏️ Editar
              </button>
              {canDelete && (
                <ConfirmButton onConfirm={() => remove.mutate()} confirmText={acta ? 'Borrar (el acta se conserva)' : 'Borrar evento'} disabled={remove.isPending}>
                  Borrar
                </ConfirmButton>
              )}
            </span>
          </header>
          {justSaved && <SuccessMessage>Evento guardado.</SuccessMessage>}
          {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
          {e.notes && <p className="pre">{e.notes}</p>}
          <p className="muted small">
            Creado por {staffName(staff.data, e.created_by)}
            {e.updated_by && e.updated_by !== e.created_by && ` · editado por ${staffName(staff.data, e.updated_by)}`}
          </p>
          {e.kind === 'reunion' && (
            <div className="row">
              {acta ? (
                <Link to={`/reuniones/${acta.id}`} className="btn btn-primary">
                  📝 Ver acta
                </Link>
              ) : (
                <Link to={`/reuniones/nueva?evento=${e.id}`} className="btn btn-primary">
                  📝 Redactar acta
                </Link>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  )
}

function EventForm({
  event,
  initialDate,
  initialKind,
  onDone,
}: {
  event: EventRow | null
  initialDate: string
  initialKind: Kind
  onDone?: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeSport = useSport()
  const today = todayISO()
  const [kind, setKind] = useState<Kind>(initialKind)
  const [form, setForm] = useState({
    title: event?.title ?? '',
    sport: (event?.sport ?? '') as '' | 'futsal' | 'voley',
    event_date: event?.event_date ?? initialDate,
    start_time: event?.start_time?.slice(0, 5) ?? '',
    end_time: event?.end_time?.slice(0, 5) ?? '',
    location: event?.location ?? '',
    notes: event?.notes ?? '',
  })
  const { errors, setErrors, clearError } = useFieldErrors()

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    clearError(String(key))
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof calendarEventSchema.parse>) => {
      if (event) return unwrap(await supabase.from('calendar_events').update(values).eq('id', event.id).select('id').single())
      return unwrap(await supabase.from('calendar_events').insert(values).select('id').single())
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      if (event) onDone?.()
      else navigate(`/calendario/evento/${row.id}`, { replace: true, state: { justSaved: true } })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (kind === 'partido') return
    const parsed = parseForm(calendarEventSchema, { ...form, kind })
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  const dateOptions = [today, addDays(today, 1), ...upcomingWeekend(today)].filter((d, i, all) => all.indexOf(d) === i)
  if (!dateOptions.includes(form.event_date)) dateOptions.push(form.event_date)

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      {!event && (
        <Segmented
          label="Tipo de evento"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'reunion', label: '👥 Reunión' },
            { value: 'otro', label: '📌 Otro' },
            { value: 'partido', label: '🏆 Partido' },
          ]}
        />
      )}

      {kind === 'partido' ? (
        <div className="stack-sm">
          <p>
            Los partidos tienen su propia ficha (convocatoria, alineación y resultado) y aparecen solos en el calendario. Se crea en{' '}
            <strong>{SPORT_LABELS[activeSport]}</strong>; si es del otro deporte, cámbialo antes con la pastilla de arriba.
          </p>
          <div>
            <Link to={`/partidos/nuevo?fecha=${form.event_date}`} className="btn btn-primary btn-touch">
              🏆 Crear partido el {formatLongDate(form.event_date).toLowerCase()}
            </Link>
          </div>
          <DateChips value={form.event_date} onChange={(d) => set('event_date', d)} suggestions={dateOptions} label="Fecha" />
        </div>
      ) : (
        <>
          <Field label="Título *" error={errors.title}>
            <input
              value={form.title}
              maxLength={120}
              placeholder={kind === 'reunion' ? 'p. ej. Reunión de la Estructura' : 'p. ej. Torneo de Navidad, fiesta fin de temporada…'}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <DateChips value={form.event_date} onChange={(d) => set('event_date', d)} suggestions={dateOptions} label="Fecha *" error={errors.event_date} />
          <div className="grid-2">
            <Field label="Hora de inicio" error={errors.start_time}>
              <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
            </Field>
            <Field label="Hora de fin" error={errors.end_time}>
              <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
            </Field>
          </div>
          <Field label="Lugar" error={errors.location}>
            <input value={form.location} maxLength={200} placeholder="Sede, pabellón, online…" onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Segmented
            label="Deporte"
            value={form.sport}
            onChange={(v) => set('sport', v)}
            options={[
              { value: '', label: 'Club (los dos)' },
              { value: 'futsal', label: '⚽ Fútbol sala' },
              { value: 'voley', label: '🏐 Voley' },
            ]}
          />
          <Field label="Notas" error={errors.notes} hint="Orden del día, qué llevar, a quién avisar…">
            <textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          {save.isError && <ErrorMessage message={toMessage(save.error)} />}
          <div className="row sticky-actions">
            <button className="btn btn-primary btn-large" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear evento'}
            </button>
            {event ? (
              <button type="button" className="btn btn-ghost" onClick={onDone}>
                Cancelar
              </button>
            ) : (
              <Link to={`/calendario?mes=${monthOf(form.event_date)}&dia=${form.event_date}`} className="btn btn-ghost">
                Cancelar
              </Link>
            )}
          </div>
        </>
      )}
    </form>
  )
}
