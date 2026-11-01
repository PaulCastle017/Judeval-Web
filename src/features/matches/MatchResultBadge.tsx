import { matchOutcome, OUTCOME_LABELS } from '../../lib/format'
import { formatSets, type VolleySet } from '../../lib/volley'
import { Badge } from '../../components/ui'

const TONE = { victoria: 'success', empate: 'neutral', derrota: 'danger' } as const

/**
 * «3–1 · Victoria» en verde, empate en gris, derrota en rojo. Nada si no hay marcador.
 * En voley, goals_* son los sets ganados; con `sets` añade el detalle «(25-20, 18-25…)».
 */
export function MatchResultBadge({
  goalsFor,
  goalsAgainst,
  sets,
}: {
  goalsFor: number | null
  goalsAgainst: number | null
  sets?: VolleySet[] | null
}) {
  const outcome = matchOutcome(goalsFor, goalsAgainst)
  if (!outcome) return null
  return (
    <Badge tone={TONE[outcome]}>
      {goalsFor}–{goalsAgainst} · {OUTCOME_LABELS[outcome]}
      {sets && ` (${formatSets(sets)})`}
    </Badge>
  )
}
