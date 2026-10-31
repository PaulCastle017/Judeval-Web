import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { readStoredSport, writeStoredSport, type Sport } from './storage'

type SportState = {
  sport: Sport | null
  setSport: (sport: Sport) => void
}

const SportContext = createContext<SportState | null>(null)

/** Deporte activo del entrenador. Filtra toda la app (no es un permiso: RLS no cambia). */
export function SportProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  // Elección hecha en esta pestaña; si no hay, se lee la guardada en el navegador.
  const [chosen, setChosen] = useState<{ userId: string; sport: Sport } | null>(null)

  const sport = !userId ? null : chosen?.userId === userId ? chosen.sport : readStoredSport(userId)

  const setSport = useCallback(
    (next: Sport) => {
      if (!userId) return
      writeStoredSport(userId, next)
      setChosen({ userId, sport: next })
    },
    [userId],
  )

  return <SportContext.Provider value={{ sport, setSport }}>{children}</SportContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSportState(): SportState {
  const ctx = useContext(SportContext)
  if (!ctx) throw new Error('useSportState debe usarse dentro de <SportProvider>')
  return ctx
}

/** Deporte activo dentro de las rutas protegidas por <RequireSport> (nunca null ahí). */
// eslint-disable-next-line react-refresh/only-export-components
export function useSport(): Sport {
  const { sport } = useSportState()
  if (!sport) throw new Error('useSport requiere un deporte elegido (<RequireSport>)')
  return sport
}
