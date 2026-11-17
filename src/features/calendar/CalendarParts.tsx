import { Link } from 'react-router-dom'
import { formatLongDate, formatTime } from '../../lib/format'
import { KIND_LABELS, monthGrid, monthLabel, sportTag, type CalendarItem } from '../../lib/calendar'
import { MATCH_STATUS } from '../../lib/eventStatus'
import { wordsForSport } from '../../i18n/useWords'
import { Badge } from '../../components/ui'

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function itemDetail(item: CalendarItem): string {
  const parts = [sportTag(item.sport), item.detail]
  if (item.kind === 'partido' && item.calledUp !== undefined && item.sport) {
    const w = wordsForSport(item.sport)
    parts.push(item.calledUp ? `${item.calledUp} ${item.calledUp === 1 ? w.calledUp : w.calledUpPl}` : `sin convocatoria`)
  }
  return parts.filter(Boolean).join(' · ')
}

/** Una fila de evento (agenda del día, agenda y widget de Inicio). */
export function CalendarItemRow({ item, dateLabel }: { item: CalendarItem; dateLabel?: string }) {
  const status = item.matchStatus && item.matchStatus !== 'programado' ? MATCH_STATUS[item.matchStatus] : null
  return (
    <li>
      <Link to={item.link} className={`list-link cal-item cal-${item.kind}`}>
        <span className="cal-item-time">
          {dateLabel && <span className="block small">{dateLabel}</span>}
          {item.time ? formatTime(item.time) : <span className="muted small">Sin hora</span>}
          {item.endTime && <span className="muted small">–{formatTime(item.endTime)}</span>}
        </span>
        <span className="list-main">
          <strong>
            <span aria-hidden="true">{KIND_LABELS[item.kind].icon}</span> {item.title}
          </strong>
          <span className="muted small">{itemDetail(item)}</span>
        </span>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </Link>
    </li>
  )
}

/**
 * Rejilla del mes (lunes a domingo). En escritorio cada día muestra hasta 3 eventos;
 * en el móvil, puntos de color. Al tocar un día se selecciona y su agenda aparece debajo.
 */
export function MonthGrid({
  month,
  today,
  selected,
  byDay,
  onSelect,
}: {
  month: string
  today: string
  selected: string
  byDay: Map<string, CalendarItem[]>
  onSelect: (day: string) => void
}) {
  const weeks = monthGrid(month)
  return (
    <div className="cal-month" role="grid" aria-label={monthLabel(month)}>
      <div className="cal-weekdays" role="row">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} role="columnheader" className="cal-weekday">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="cal-week" role="row">
          {week.map((day) => {
            const items = byDay.get(day) ?? []
            const classes = [
              'cal-day',
              day.slice(0, 7) !== month && 'cal-out',
              day === today && 'cal-today',
              day === selected && 'cal-selected',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={day === selected}
                aria-label={`${formatLongDate(day)}: ${items.length ? `${items.length} evento${items.length === 1 ? '' : 's'}` : 'sin eventos'}`}
                className={classes}
                onClick={() => onSelect(day)}
              >
                <span className="cal-daynum">{Number(day.slice(8))}</span>
                <span className="cal-chips" aria-hidden="true">
                  {items.slice(0, 3).map((i) => (
                    <span key={i.key} className={`cal-chip cal-${i.kind}`}>
                      {i.time && <span className="cal-chip-time">{formatTime(i.time)}</span>} {i.title}
                    </span>
                  ))}
                  {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                </span>
                <span className="cal-dots" aria-hidden="true">
                  {items.slice(0, 4).map((i) => (
                    <span key={i.key} className={`cal-dot cal-${i.kind}`} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
