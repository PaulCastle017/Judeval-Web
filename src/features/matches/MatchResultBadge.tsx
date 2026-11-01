import { matchOutcome, OUTCOME_LABELS } from '../../lib/format'
import { Badge } from '../../components/ui'

const TONE = { victoria: 'success', empate: 'neutral', derrota: 'danger' } as const

/** «3–1 · Victoria» en verde, empate en gris, derrota en rojo. Nada si no hay marcador. */
export function MatchResultBadge({ goalsFor, goalsAgainst }: { goalsFor: number | null; goalsAgainst: number | null }) {
  const outcome = matchOutcome(goalsFor, goalsAgainst)
  if (!outcome) return null
  return (
    <Badge tone={TONE[outcome]}>
      {goalsFor}–{goalsAgainst} · {OUTCOME_LABELS[outcome]}
    </Badge>
  )
}
