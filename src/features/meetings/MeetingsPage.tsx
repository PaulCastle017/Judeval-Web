import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { staffName, unwrap, useStaff } from '../../lib/queries'
import { formatLongDate } from '../../lib/format'
import { parseSections } from '../../lib/validation'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** /reuniones · Actas de las Reuniones de la Estructura (todo el staff las ve; cualquiera puede escribir una). */
export function MeetingsPage() {
  const staff = useStaff()
  const [search, setSearch] = useState('')
  const meetings = useQuery({
    queryKey: ['meetings'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('meetings')
          .select('id, title, meeting_date, summary, sections, created_by, event_id')
          .order('meeting_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
  const term = normalize(search.trim())
  const visible = (meetings.data ?? []).filter((m) => !term || normalize(m.title).includes(term))

  return (
    <div className="stack">
      <PageHeader
        title="📝 Reuniones de la Estructura"
        subtitle="Actas de las reuniones del equipo técnico: qué se habló y qué se acordó, consultables por todo el staff."
        actions={
          <Link to="/reuniones/nueva" className="btn btn-primary">
            + Nueva acta
          </Link>
        }
      />
      {(meetings.data?.length ?? 0) > 5 && (
        <input type="search" placeholder="Buscar por título…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar acta" />
      )}
      {meetings.isPending && <Spinner />}
      {meetings.isError && <ErrorMessage error={meetings.error} onRetry={meetings.refetch} />}
      {meetings.isSuccess && meetings.data.length === 0 && (
        <EmptyState
          icon="📝"
          action={
            <Link to="/reuniones/nueva" className="btn btn-primary btn-small">
              + Escribir la primera
            </Link>
          }
        >
          Todavía no hay actas.
        </EmptyState>
      )}
      {meetings.isSuccess && meetings.data.length > 0 && visible.length === 0 && <EmptyState icon="🔍">Ningún acta coincide con la búsqueda.</EmptyState>}
      {visible.map((m) => {
        const sections = parseSections(m.sections)
        const excerpt = m.summary || sections.find((s) => s.body)?.body || ''
        return (
          <Link key={m.id} to={`/reuniones/${m.id}`} className="card review-card meeting-card">
            <div className="row space-between">
              <strong>{formatLongDate(m.meeting_date)}</strong>
              <span className="muted small">{staffName(staff.data, m.created_by)}</span>
            </div>
            <h2 className="meeting-card-title">{m.title}</h2>
            <span className="row-tight">
              <span className="badge badge-neutral">
                {sections.length} punto{sections.length === 1 ? '' : 's'}
              </span>
              {m.event_id && <span className="badge badge-info">📅 En el calendario</span>}
            </span>
            {excerpt && <p className="clamp review-excerpt">{excerpt}</p>}
          </Link>
        )
      })}
    </div>
  )
}
