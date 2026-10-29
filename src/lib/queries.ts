import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Lanza el error de Supabase para que React Query lo gestione. */
export function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error
  return res.data as NonNullable<R['data']>
}

/** Igual que unwrap, pero para consultas .maybeSingle() que pueden no devolver fila. */
export function unwrapMaybe<R extends { data: unknown; error: unknown }>(res: R): R['data'] {
  if (res.error) throw res.error
  return res.data
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrap(await supabase.from('categories').select('*').order('sort_order').order('name')),
    staleTime: 5 * 60_000,
  })
}

export function useStaff() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').order('full_name')),
    staleTime: 60_000,
  })
}

export function useCoachCategories() {
  return useQuery({
    queryKey: ['coach_categories'],
    queryFn: async () => unwrap(await supabase.from('coach_categories').select('*')),
    staleTime: 60_000,
  })
}

/** Jugadores (ligeros) para selectores y listados. */
export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => unwrap(await supabase.from('players').select('*').order('first_name').order('display_name')),
  })
}

export function staffName(staff: { id: string; full_name: string; email: string }[] | undefined, id: string | null) {
  if (!id) return 'Sistema'
  const p = staff?.find((s) => s.id === id)
  return p ? p.full_name || p.email : 'Usuario eliminado'
}
