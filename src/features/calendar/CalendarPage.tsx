import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, formatLongDate, relativeDayLabel, todayISO } from '../../lib/format'
import {
  addMonths,
  filterItems,
  gridRange,
  isMonth,
  itemsByDay,
  KIND_LABELS,
  monthLabel,
  monthOf,
  type CalendarFilter,
  type CalendarKind,
} from '../../lib/calendar'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'
import { Segmented } from '../../components/pickers'
import { CalendarItemRow, MonthGrid } from './CalendarParts'
import { useCalendar } from './useCalendar'

const KINDS: CalendarKind[] = ['partido', 'reunion', 'otro']
const SPORT_FILTERS: { value: CalendarFilter['sport']; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'futsal', label: '⚽ Fútbol sala' },
  { value: 'voley', label: '🏐 Voley' },
  { value: 'club', label: 'Club' },
]
const AGENDA_DAYS = 60

/**
 * /calendario · Calendario compartido por los dos deportes: partidos (leídos de su tabla, sin copiarlos),
 * reuniones y otros eventos. El deporte activo no filtra; se puede filtrar aquí por tipo y deporte.
 * Parámetros: ?vista=mes|agenda &mes=AAAA-MM &dia=AAAA-MM-DD
 */
export function CalendarPage() {
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const view = params.get('vista') === 'agenda' ? 'agenda' : 'mes'
  const month = isMonth(params.get('mes')) ? params.get('mes')! : monthOf(today)
  const requestedDay = params.get('dia') ?? ''
  const selected = requestedDay.startsWith(month) ? requestedDay : monthOf(today) === month ? today : `${month}-01`
  const [filter, setFilter] = useState<CalendarFilter>({ kinds: KINDS, sport: 'todos' })

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  function toggleKind(kind: CalendarKind) {
    setFilter((f) => {
      const kinds = f.kinds.includes(kind) ? f.kinds.filter((k) => k !== kind) : [...f.kinds, kind]
      return { ...f, kinds: kinds.length ? kinds : KINDS } // nunca vacío: vuelve a «todos»
    })
  }

  return (
    <div className="stack">
      <PageHeader
        title="📅 Calendario"
        subtitle="Compartido por fútbol sala y voley: partidos, reuniones y otros eventos del club."
        actions={
          <Link to={`/calendario/nuevo?fecha=${view === 'mes' ? selected : today}`} className="btn btn-primary">
            + Nuevo evento
          </Link>
        }
      />

      <Segmented
        label="Vista del calendario"
        value={view}
        onChange={(v) => update({ vista: v === 'mes' ? null : v })}
        options={[
          { value: 'mes', label: '🗓️ Mes' },
          { value: 'agenda', label: '📋 Agenda' },
        ]}
      />

      <div className="stack-sm">
        <div className="chips chips-scroll" role="group" aria-label="Tipos de evento">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${filter.kinds.includes(k) ? ' chip-on' : ''}`}
              aria-pressed={filter.kinds.includes(k)}
              onClick={() => toggleKind(k)}
            >
              {KIND_LABELS[k].icon} {KIND_LABELS[k].plural}
            </button>
          ))}
        </div>
        <div className="chips chips-scroll" role="radiogroup" aria-label="Deporte">
          {SPORT_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={filter.sport === s.value}
              className={`chip${filter.sport === s.value ? ' chip-on' : ''}`}
              onClick={() => setFilter((f) => ({ ...f, sport: s.value }))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'mes' ? (
        <MonthView month={month} today={today} selected={selected} filter={filter} onMonth={(m) => update({ mes: m, dia: null })} onDay={(d) => update({ dia: d })} />
      ) : (
        <AgendaView today={today} filter={filter} />
      )}
    </div>
  )
}

function MonthView({
  month,
  today,
  selected,
  filter,
  onMonth,
  onDay,
}: {
  month: string
  today: string
  selected: string
  filter: CalendarFilter
  onMonth: (month: string) => void
  onDay: (day: string) => void
}) {
  const { from, to } = gridRange(month)
  const calendar = useCalendar(from, to)
  const items = filterItems(calendar.data ?? [], filter)
  const byDay = itemsByDay(items)
  const dayItems = byDay.get(selected) ?? []

  return (
    <>
      <div className="cal-toolbar">
        <button type="button" className="btn btn-ghost btn-small" aria-label="Mes anterior" onClick={() => onMonth(addMonths(month, -1))}>
          ‹
        </button>
        <h2 className="cal-title" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <button type="button" className="btn btn-ghost btn-small" aria-label="Mes siguiente" onClick={() => onMonth(addMonths(month, 1))}>
          ›
        </button>
        {monthOf(today) !== month && (
          <button type="button" className="btn btn-small" onClick={() => onMonth(monthOf(today))}>
            Hoy
          </button>
        )}
      </div>
      {calendar.isError && <ErrorMessage error={calendar.error} onRetry={calendar.refetch} />}
      <MonthGrid month={month} today={today} selected={selected} byDay={byDay} onSelect={onDay} />

      <section className="card stack-sm cal-day-panel" aria-label={`Eventos del ${formatLongDate(selected)}`}>
        <div className="card-head">
          <h2>{formatLongDate(selected)}</h2>
          <Link to={`/calendario/nuevo?fecha=${selected}`} className="btn btn-small">
            + Añadir
          </Link>
        </div>
        {calendar.isPending ? (
          <Spinner />
        ) : dayItems.length === 0 ? (
          <p className="empty">Nada este día.</p>
        ) : (
          <ul className="list">
            {dayItems.map((i) => (
              <CalendarItemRow key={i.key} item={i} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Agenda: lista por días desde hoy (60 días); «Ver anteriores» amplía hacia atrás. */
function AgendaView({ today, filter }: { today: string; filter: CalendarFilter }) {
  const [from, setFrom] = useState(today)
  const to = addDays(today, AGENDA_DAYS)
  const calendar = useCalendar(from, to)
  const byDay = itemsByDay(filterItems(calendar.data ?? [], filter))

  return (
    <div className="stack">
      <button type="button" className="btn btn-ghost btn-small cal-earlier" disabled={calendar.isFetching} onClick={() => setFrom((f) => addDays(f, -AGENDA_DAYS))}>
        ↑ Ver anteriores
      </button>
      {calendar.isPending && <Spinner />}
      {calendar.isError && <ErrorMessage error={calendar.error} onRetry={calendar.refetch} />}
      {calendar.isSuccess && byDay.size === 0 && (
        <EmptyState
          icon="📅"
          action={
            <Link to={`/calendario/nuevo?fecha=${today}`} className="btn btn-primary btn-small">
              + Nuevo evento
            </Link>
          }
        >
          No hay eventos en los próximos {AGENDA_DAYS} días.
        </EmptyState>
      )}
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className={`card stack-sm${day === today ? ' cal-agenda-today' : ''}`}>
          <h2 className="cal-agenda-day">
            {relativeDayLabel(day, today)}
            {(day === today || day === addDays(today, 1)) && <span className="muted small"> · {formatLongDate(day)}</span>}
          </h2>
          <ul className="list">
            {items.map((i) => (
              <CalendarItemRow key={i.key} item={i} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
