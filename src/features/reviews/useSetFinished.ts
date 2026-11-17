import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import type { EventKind } from './eventContext'

/** Finalizar (true) o reabrir (false) un entrenamiento o partido. La BD impide finalizar antes del día del evento. */
export function useSetFinished(kind: EventKind, eventId: string) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const table = kind === 'training' ? 'training_sessions' : 'matches'
  return useMutation({
    mutationFn: async (finished: boolean) => {
      const { error } = await supabase
        .from(table)
        .update({ finished_at: finished ? new Date().toISOString() : null, finished_by: finished ? (profile?.id ?? null) : null })
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kind === 'training' ? ['sessions'] : ['matches'] })
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}
