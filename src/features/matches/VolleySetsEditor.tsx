import { matchOutcome, OUTCOME_LABELS } from '../../lib/format'
import { parseSetRows, setsToShow, volleySummary, type SetRow } from '../../lib/volley'

/**
 * Editor guiado del resultado de voley: 3 sets obligatorios y el 4.º / 5.º solo
 * aparecen cuando el marcador lo exige (2-1 tras 3 sets, 2-2 tras 4).
 */
export function VolleySetsEditor({
  rows,
  opponent,
  error,
  onChange,
}: {
  rows: SetRow[]
  opponent: string
  error?: string
  onChange: (rows: SetRow[]) => void
}) {
  const visible = setsToShow(rows)
  const parsed = parseSetRows(rows)
  const live = parsed.ok && parsed.sets ? volleySummary(parsed.sets) : null
  const outcome = live ? matchOutcome(live.won, live.lost) : null

  function setCell(index: number, side: keyof SetRow, value: string) {
    const next = rows.map((r, i) => (i === index ? { ...r, [side]: value.replace(/\D/g, '').slice(0, 2) } : r))
    onChange(next)
  }

  return (
    <div className="stack-sm">
      <div className="sets-grid" role="group" aria-label="Resultado por sets">
        <span />
        <span className="sets-head">JUDEVAL</span>
        <span className="sets-head" title={opponent}>
          {opponent}
        </span>
        {rows.slice(0, visible).map((r, i) => (
          <div key={i} className="sets-row">
            <span className="sets-label">
              Set {i + 1}
              {i >= 3 && <span className="muted small"> (desempate)</span>}
            </span>
            <input
              inputMode="numeric"
              className="score-input set-input"
              aria-label={`Set ${i + 1}: puntos de JUDEVAL`}
              value={r.for}
              onChange={(e) => setCell(i, 'for', e.target.value)}
            />
            <input
              inputMode="numeric"
              className="score-input set-input"
              aria-label={`Set ${i + 1}: puntos de ${opponent}`}
              value={r.against}
              onChange={(e) => setCell(i, 'against', e.target.value)}
            />
          </div>
        ))}
      </div>
      <p className="muted small">
        Al mejor de 5: gana quien llega a 3 sets. El 4.º y el 5.º set aparecen solo si hacen falta. Deja todo vacío para no registrar
        resultado.
      </p>
      {live && outcome && (
        <p className="sets-summary" aria-live="polite">
          {live.won}–{live.lost} · {OUTCOME_LABELS[outcome]}
        </p>
      )}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
