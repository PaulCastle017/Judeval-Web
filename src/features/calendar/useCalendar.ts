import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap } from '../../lib/queries'
import { todayISO } from '../../lib/format'
import { mergeItems, type CalendarItem } from '../../lib/calendar'

/**
 * Todo lo del calendario entre dos fechas (incluidas): eventos, partidos de LOS DOS deportes
 * (el deporte activo no filtra) y actas sin evento. Se vuelve a pedir cada vez que se abre
 * (staleTime 0): así un partido recién editado nunca sale desactualizado.
 */
export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', from, to],
    staleTime: 0,
    queryFn: async (): Promise<CalendarItem[]> => {
      const [events, matches, meetings] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('id, title, kind, sport, event_date, start_time, end_time, location')
          .gte('event_date', from)
          .lte('event_date', to),
        supabase
          .from('matches')
          .select('id, match_date, start_time, opponent, venue, location, goals_for, finished_at, category:categories(name, sport), match_players(count)')
          .gte('match_date', from)
          .lte('match_date', to),
        supabase.from('meetings').select('id, title, meeting_date').is('event_id', null).gte('meeting_date', from).lte('meeting_date', to),
      ])
      return mergeItems({ events: unwrap(events), matches: unwrap(matches), meetings: unwrap(meetings) }, todayISO())
    },
  })
}
