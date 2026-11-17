import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, unwrapMaybe, useStaff } from '../../lib/queries'
import { addDays, formatDate, formatLongDate, todayISO } from '../../lib/format'
import { meetingSchema, parseForm, parseSections } from '../../lib/validation'
import { useFieldErrors } from '../../lib/useFieldErrors'
import { useAuth } from '../../auth/AuthProvider'
import { ConfirmButton, ErrorMessage, Field, Spinner, SuccessMessage } from '../../components/ui'
import { DateChips } from '../../components/pickers'
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from '../../components/icons'
import type { Tables } from '../../types/database'

type Meeting = Tables<'meetings'>

/** /reuniones/:id (acta) · /reuniones/:id/editar · /reuniones/nueva[?evento=<id del evento del calendario>] */
export function MeetingDetailPage({ mode }: { mode: 'ver' | 'editar' | 'nueva' }) {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const eventId = mode === 'nueva' ? params.get('evento') : null

  const meeting = useQuery({
    enabled: mode !== 'nueva',
    queryKey: ['meetings', 'detail', id],
    queryFn: async () => unwrapMaybe(await supabase.from('meetings').select('*').eq('id', id).maybeSingle()),
  })
  // Acta nueva desde un evento de reunión: título y fecha del evento, y queda vinculada a él
  const event = useQuery({
    enabled: Boolean(eventId),
    queryKey: ['calendar', 'event', eventId],
    queryFn: async () => unwrapMaybe(await supabase.from('calendar_events').select('id, title, event_date').eq('id', eventId!).maybeSingle()),
  })

  if (mode !== 'nueva' && meeting.isPending) return <Spinner />
  if (eventId && event.isPending) return <Spinner />
  if (meeting.isError) return <ErrorMessage error={meeting.error} onRetry={meeting.refetch} />
  if (mode !== 'nueva' && !meeting.data) return <ErrorMessage message="Acta no encontrada." />

  return (
    <div className="stack">
      <Link to="/reuniones" className="back-link">
        ← Reuniones
      </Link>
      {mode === 'ver' ? (
        <MeetingView meeting={meeting.data!} />
      ) : (
        <MeetingForm meeting={mode === 'editar' ? meeting.data! : null} event={event.data ?? null} />
      )}
    </div>
  )
}

function MeetingView({ meeting: m }: { meeting: Meeting }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { profile, isAdmin } = useAuth()
  const staff = useStaff()
  const sections = parseSections(m.sections)
  const justSaved = Boolean((location.state as { justSaved?: boolean } | null)?.justSaved)

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('meetings').delete().eq('id', m.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meetings'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate('/reuniones', { replace: true })
    },
  })

  return (
    <article className="card stack acta">
      <header className="page-header">
        <div>
          <p className="muted small">📝 Acta · {formatLongDate(m.meeting_date)}</p>
          <h1>{m.title}</h1>
          <p className="muted small">
            Escrita por {staffName(staff.data, m.created_by)}
            {m.updated_by && m.updated_at !== m.created_at && ` · editada por ${staffName(staff.data, m.updated_by)} el ${formatDate(m.updated_at)}`}
          </p>
        </div>
        <span className="row">
          <Link to={`/reuniones/${m.id}/editar`} className="btn btn-small">
            ✏️ Editar
          </Link>
          {(isAdmin || m.created_by === profile?.id) && (
            <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar acta" disabled={remove.isPending}>
              Borrar
            </ConfirmButton>
          )}
        </span>
      </header>
      {justSaved && <SuccessMessage>Acta guardada.</SuccessMessage>}
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      {m.event_id && (
        <Link to={`/calendario/evento/${m.event_id}`} className="chip chip-static event-chip">
          📅 Evento en el calendario
        </Link>
      )}

      {sections.length > 0 && (
        <nav className="acta-index" aria-label="Índice del acta">
          <h2>Índice</h2>
          <ol>
            {sections.map((s, i) => (
              <li key={i}>
                <a href={`#punto-${i + 1}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {sections.map((s, i) => (
        <section key={i} id={`punto-${i + 1}`} className="acta-section">
          <h2>
            {i + 1}. {s.title}
          </h2>
          {s.body ? <p className="pre">{s.body}</p> : <p className="muted small">Sin texto.</p>}
        </section>
      ))}
      {m.summary && (
        <section className="acta-section acta-summary">
          <h2>Resumen y acuerdos</h2>
          <p className="pre">{m.summary}</p>
        </section>
      )}
      {sections.length === 0 && !m.summary && <p className="empty">Esta acta todavía no tiene contenido.</p>}
    </article>
  )
}

type SectionRow = { key: number; title: string; body: string }
let sectionKey = 0
const newSection = (title = '', body = ''): SectionRow => ({ key: ++sectionKey, title, body })

function MeetingForm({ meeting, event }: { meeting: Meeting | null; event: { id: string; title: string; event_date: string } | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = todayISO()
  const [title, setTitle] = useState(meeting?.title ?? event?.title ?? '')
  const [date, setDate] = useState(meeting?.meeting_date ?? event?.event_date ?? today)
  const [summary, setSummary] = useState(meeting?.summary ?? '')
  const [sections, setSections] = useState<SectionRow[]>(() =>
    meeting ? parseSections(meeting.sections).map((s) => newSection(s.title, s.body)) : [newSection()],
  )
  const { errors, setErrors, clearError, clearErrorsWithPrefix } = useFieldErrors()

  function updateSection(key: number, patch: Partial<SectionRow>) {
    const index = sections.findIndex((s) => s.key === key)
    clearError(...Object.keys(patch).map((f) => `sections.${index}.${f}`))
    setSections((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }
  function moveSection(index: number, delta: number) {
    clearErrorsWithPrefix('sections')
    setSections((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }
  function removeSection(key: number) {
    clearErrorsWithPrefix('sections')
    setSections((list) => list.filter((s) => s.key !== key))
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof meetingSchema.parse>) => {
      if (meeting) return unwrap(await supabase.from('meetings').update(values).eq('id', meeting.id).select('id').single())
      return unwrap(await supabase.from('meetings').insert({ ...values, event_id: event?.id ?? null }).select('id').single())
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['meetings'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate(`/reuniones/${row.id}`, { replace: true, state: { justSaved: true } })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Los puntos totalmente vacíos (sin título ni texto) se descartan al guardar
    const filled = sections.filter((s) => s.title.trim() || s.body.trim())
    const parsed = parseForm(meetingSchema, {
      title,
      meeting_date: date,
      summary,
      sections: filled.map(({ title: t, body }) => ({ title: t, body })),
    })
    if (!parsed.ok) {
      // Los índices de error se refieren a los puntos con contenido: se reordena la lista para que cuadren
      setSections(filled.length ? filled : [newSection()])
      return setErrors(parsed.errors)
    }
    setErrors({})
    save.mutate(parsed.data)
  }

  const dateOptions = [today, addDays(today, -1), ...(event ? [event.event_date] : [])]

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <h1>{meeting ? 'Editar acta' : 'Nueva acta'}</h1>
      {event && (
        <p className="muted small">
          Vinculada al evento «{event.title}» del {formatLongDate(event.event_date).toLowerCase()}.
        </p>
      )}
      <section className="card stack">
        <Field label="Título *" error={errors.title}>
          <input
            value={title}
            maxLength={160}
            placeholder="p. ej. Reunión de la Estructura · noviembre"
            onChange={(e) => {
              clearError('title')
              setTitle(e.target.value)
            }}
          />
        </Field>
        <DateChips
          value={date}
          onChange={(d) => {
            clearError('meeting_date')
            setDate(d)
          }}
          suggestions={dateOptions}
          label="Fecha de la reunión *"
          error={errors.meeting_date}
        />
      </section>

      <section className="card stack-sm">
        <h2>📑 Índice: puntos tratados</h2>
        <p className="muted small">Un punto por tema (p. ej. «Inicio de temporada», «Material», «Torneo»). Puedes ordenarlos con ↑↓.</p>
        <ol className="meeting-sections">
          {sections.map((s, i) => (
            <li key={s.key} className="meeting-section-row">
              <div className="meeting-section-head">
                <span className="exercise-num" aria-hidden="true">
                  {i + 1}
                </span>
                <input
                  aria-label={`Punto ${i + 1}: título`}
                  placeholder="Título del punto"
                  maxLength={120}
                  value={s.title}
                  className={errors[`sections.${i}.title`] ? 'input-error' : ''}
                  onChange={(e) => updateSection(s.key, { title: e.target.value })}
                />
                <span className="exercise-actions meeting-section-actions">
                  <button type="button" className="icon-btn" aria-label={`Subir el punto ${i + 1}`} disabled={i === 0} onClick={() => moveSection(i, -1)}>
                    <ArrowUpIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Bajar el punto ${i + 1}`}
                    disabled={i === sections.length - 1}
                    onClick={() => moveSection(i, 1)}
                  >
                    <ArrowDownIcon />
                  </button>
                  <button type="button" className="icon-btn icon-btn-danger" aria-label={`Quitar el punto ${i + 1}`} onClick={() => removeSection(s.key)}>
                    <CloseIcon />
                  </button>
                </span>
              </div>
              <textarea
                aria-label={`Punto ${i + 1}: texto`}
                rows={4}
                maxLength={8000}
                placeholder="Qué se habló, quién se encarga, plazos…"
                value={s.body}
                onChange={(e) => updateSection(s.key, { body: e.target.value })}
              />
              {(errors[`sections.${i}.title`] || errors[`sections.${i}.body`]) && (
                <span className="field-error">{errors[`sections.${i}.title`] ?? errors[`sections.${i}.body`]}</span>
              )}
            </li>
          ))}
        </ol>
        {errors.sections && <span className="field-error">{errors.sections}</span>}
        <button type="button" className="btn btn-touch add-exercise-btn" disabled={sections.length >= 30} onClick={() => setSections((list) => [...list, newSection()])}>
          + Añadir punto
        </button>
      </section>

      <section className="card stack-sm">
        <Field label="Resumen y acuerdos (texto global)" error={errors.summary} hint="Opcional: conclusiones, tareas y próxima reunión.">
          <textarea
            rows={5}
            maxLength={8000}
            value={summary}
            onChange={(e) => {
              clearError('summary')
              setSummary(e.target.value)
            }}
          />
        </Field>
      </section>

      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      <div className="row sticky-actions">
        <button className="btn btn-primary btn-large" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : meeting ? 'Guardar cambios' : 'Guardar acta'}
        </button>
        <Link to={meeting ? `/reuniones/${meeting.id}` : '/reuniones'} className="btn btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
