import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap } from '../../lib/queries'

/**
 * ¿Hay ya otro partido de esa categoría ese día? Solo es un aviso (en un torneo puede haber dos),
 * a diferencia de los entrenamientos, que son uno por categoría y día.
 */
export function useMatchConflict(categoryId: string, date: string, excludeId: string | null) {
  const query = useQuery({
    enabled: Boolean(categoryId && date),
    queryKey: ['matches', 'same-day', categoryId, date],
    queryFn: async () =>
      unwrap(await supabase.from('matches').select('id, opponent').eq('category_id', categoryId).eq('match_date', date)),
  })
  return query.data?.find((m) => m.id !== excludeId) ?? null
}
