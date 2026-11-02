import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrapMaybe } from '../../lib/queries'
import { formatDate } from '../../lib/format'
import type { Enums } from '../../types/database'

export type EventKind = 'training' | 'match'

/** Contexto de un entrenamiento o partido para precargar su revisión. */
export type EventContext = {
  kind: EventKind
  id: string
  sport: Enums<'sport_type'>
  date: string
  label: string
  link: string
  /** Presentes en el entrenamiento, o convocados del partido (presentes si ya se pasó lista). */
  participantIds: string[]
  existingReviewId: string | null
}

export const eventParam = (kind: EventKind) => (kind === 'training' ? 'entrenamiento' : 'partido')
export const newReviewLink = (kind: EventKind, id: string) => `/revisiones/nueva?${eventParam(kind)}=${id}`

export function useEventContext(kind: EventKind | null, id: string | null) {
  return useQuery({
    enabled: Boolean(kind && id),
    queryKey: ['reviews', 'event', kind, id],
    queryFn: async (): Promise<EventContext | null> => {
      if (kind === 'training') {
        const s = unwrapMaybe(
          await supabase
            .from('training_sessions')
            .select('id, session_date, category:categories(name, sport), attendance(player_id, status), staff_reviews(id)')
            .eq('id', id!)
            .maybeSingle(),
        )
        if (!s) return null
        return {
          kind,
          id: s.id,
          sport: s.category.sport,
          date: s.session_date,
          label: `📋 Entreno ${s.category.name} · ${formatDate(s.session_date)}`,
          link: `/entrenamientos/${s.id}`,
          participantIds: s.attendance.filter((a) => a.status === 'presente').map((a) => a.player_id),
          existingReviewId: s.staff_reviews[0]?.id ?? null,
        }
      }
      const m = unwrapMaybe(
        await supabase
          .from('matches')
          .select('id, match_date, opponent, goals_for, goals_against, category:categories(name, sport), match_players(player_id, status), staff_reviews(id)')
          .eq('id', id!)
          .maybeSingle(),
      )
      if (!m) return null
      const present = m.match_players.filter((p) => p.status === 'presente').map((p) => p.player_id)
      const score = m.goals_for !== null ? ` · ${m.goals_for}–${m.goals_against}` : ''
      return {
        kind: 'match',
        id: m.id,
        sport: m.category.sport,
        date: m.match_date,
        label: `🏆 ${m.category.name} vs ${m.opponent}${score} · ${formatDate(m.match_date)}`,
        link: `/partidos/${m.id}`,
        participantIds: present.length ? present : m.match_players.map((p) => p.player_id),
        existingReviewId: m.staff_reviews[0]?.id ?? null,
      }
    },
  })
}
