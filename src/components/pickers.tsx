import { useState } from 'react'
import { formatTime, shortDayLabel, todayISO } from '../lib/format'
import type { Tables } from '../types/database'

/** Selectores visuales (táctiles) para los flujos de creación. */

export function CategoryCards({
  categories,
  value,
  onChange,
  label = 'Categoría',
}: {
  categories: Tables<'categories'>[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  return (
    <div className="pick-group">
      <span className="field-label" id="cat-cards-label">
        {label}
      </span>
      <div className="category-cards" role="radiogroup" aria-labelledby="cat-cards-label">
        {categories.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className={`category-card${value === c.id ? ' on' : ''}`} onClick={() => onChange(c.id)}>
            <strong>{c.name}</strong>
            {c.start_time && (
              <span className="small">
                {formatTime(c.start_time)}–{formatTime(c.end_time)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Chips de fecha sugeridas + «Otra fecha» (selector nativo). */
export function DateChips({
  value,
  onChange,
  suggestions,
  label = 'Fecha',
  error,
}: {
  value: string
  onChange: (iso: string) => void
  suggestions: string[]
  label?: string
  error?: string
}) {
  const today = todayISO()
  const options = Array.from(new Set(suggestions))
  const custom = value && !options.includes(value)
  const [showOther, setShowOther] = useState(Boolean(custom))
  return (
    <div className="pick-group">
      <span className="field-label" id="date-chips-label">
        {label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby="date-chips-label">
        {options.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={value === d} className={`chip chip-touch${value === d ? ' chip-on' : ''}`} onClick={() => (setShowOther(false), onChange(d))}>
            {shortDayLabel(d, today)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={Boolean(custom)}
          className={`chip chip-touch${custom ? ' chip-on' : ''}`}
          onClick={() => setShowOther(true)}
        >
          📅 {custom ? shortDayLabel(value, today) : 'Otra fecha'}
        </button>
      </div>
      {(showOther || custom) && (
        <input type="date" aria-label="Otra fecha" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** Chips de hora sugerida + «Otra hora». */
export function TimeChips({ value, onChange, suggestions, label = 'Hora' }: { value: string; onChange: (t: string) => void; suggestions: string[]; label?: string }) {
  const options = Array.from(new Set(suggestions.filter(Boolean).map((t) => t.slice(0, 5))))
  const custom = value && !options.includes(value)
  const [showOther, setShowOther] = useState(Boolean(custom))
  return (
    <div className="pick-group">
      <span className="field-label" id="time-chips-label">
        {label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby="time-chips-label">
        {options.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={value === t} className={`chip chip-touch${value === t ? ' chip-on' : ''}`} onClick={() => (setShowOther(false), onChange(t))}>
            🕒 {t}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={Boolean(custom)} className={`chip chip-touch${custom ? ' chip-on' : ''}`} onClick={() => setShowOther(true)}>
          {custom ? `🕒 ${value}` : 'Otra hora'}
        </button>
        {value && (
          <button type="button" className="chip chip-touch" onClick={() => (setShowOther(false), onChange(''))}>
            Sin hora
          </button>
        )}
      </div>
      {(showOther || custom) && <input type="time" aria-label="Otra hora" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

export function DurationChips({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const n = Number(value) || 0
  return (
    <div className="pick-group">
      <span className="field-label" id="duration-label">
        Duración (minutos)
      </span>
      <div className="row-tight" role="group" aria-labelledby="duration-label">
        {[60, 75, 90, 120].map((m) => (
          <button key={m} type="button" className={`chip chip-touch${n === m ? ' chip-on' : ''}`} aria-pressed={n === m} onClick={() => onChange(String(m))}>
            {m}′
          </button>
        ))}
        <input
          className="input-narrow"
          inputMode="numeric"
          aria-label="Duración en minutos"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** Control segmentado (2–3 opciones grandes). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
