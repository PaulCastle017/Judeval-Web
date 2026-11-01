import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useSportState } from '../sport/SportProvider'
import { ErrorMessage, FullPageSpinner } from '../components/ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading, error, signOut, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (error) {
    return (
      <div className="center-page">
        <ErrorMessage message={error} onRetry={refreshProfile} />
      </div>
    )
  }

  if (!profile?.active) {
    return (
      <div className="center-page">
        <div className="card narrow">
          <h1>Cuenta pendiente de activación</h1>
          <p>
            Tu cuenta ({session.user.email}) existe pero todavía no está activa. Pide a la coordinación de JUDEVAL que la
            active desde el panel de administración.
          </p>
          <div className="row">
            <button className="btn" onClick={() => void refreshProfile()}>
              Volver a comprobar
            </button>
            <button className="btn btn-ghost" onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/** Exige haber elegido deporte; si no, lleva a /deporte y vuelve después a la ruta pedida. */
export function RequireSport({ children }: { children: ReactNode }) {
  const { sport } = useSportState()
  const location = useLocation()
  if (!sport) return <Navigate to="/deporte" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <ErrorMessage message="Esta sección es solo para administradores." />
  }
  return <>{children}</>
}
