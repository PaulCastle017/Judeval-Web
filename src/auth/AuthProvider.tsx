import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toMessage } from '../lib/errors'
import { unwrapMaybe } from '../lib/queries'
import type { Tables } from '../types/database'

type AuthState = {
  session: Session | null
  profile: Tables<'profiles'> | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const profileQuery = useQuery({
    enabled: !!userId,
    queryKey: ['me', userId],
    queryFn: async () => unwrapMaybe(await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()),
    staleTime: 60_000,
  })
  const { refetch } = profileQuery

  const refreshProfile = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Cierra sesión y recarga en /login: no queda ningún dato en memoria (dispositivos compartidos)
  // y el siguiente usuario no vuelve a la página del anterior.
  const [signingOut, setSigningOut] = useState(false)
  const signOut = useCallback(async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    queryClient.clear()
    window.location.replace('/login')
  }, [queryClient])

  const profile = userId ? (profileQuery.data ?? null) : null

  const value: AuthState = {
    session,
    profile,
    loading: signingOut || sessionLoading || (!!userId && profileQuery.isPending),
    error: userId && profileQuery.isError ? toMessage(profileQuery.error) : null,
    isAdmin: !!profile?.active && profile.role === 'admin',
    refreshProfile,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
