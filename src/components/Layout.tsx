import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

type NavItem = { to: string; label: string; icon?: string; end?: boolean }

const MAIN_LINKS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '⌂', end: true },
  { to: '/jugadores', label: 'Jugadores', icon: '☺' },
  { to: '/asistencia', label: 'Asistencia', icon: '✓' },
  { to: '/revisiones', label: 'Revisiones', icon: '✎' },
]

const MORE_LINKS: NavItem[] = [
  { to: '/compromisos', label: 'Compromisos' },
  { to: '/guia', label: 'Guía rápida' },
  { to: '/perfil', label: 'Mi perfil' },
]

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand-crest" src="/escudo-192.png" alt="" width={36} height={36} />
          JUDEVAL <span>Entrenadores</span>
        </NavLink>
        <nav className="topnav" aria-label="Principal">
          {[...MAIN_LINKS, ...MORE_LINKS].map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-user">
          <span className="muted small">{profile?.full_name || profile?.email}</span>
          <button className="btn btn-ghost btn-small" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Navegación móvil">
        {MAIN_LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <span aria-hidden="true">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/mas">
          <span aria-hidden="true">≡</span>
          Más
        </NavLink>
      </nav>
    </div>
  )
}

export function MorePage() {
  const { isAdmin, signOut } = useAuth()
  return (
    <div className="stack">
      <h1>Más opciones</h1>
      <div className="card link-list">
        {MORE_LINKS.map((l) => (
          <NavLink key={l.to} to={l.to}>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/asistencia/historial">Historial de asistencia</NavLink>
        {isAdmin && <NavLink to="/admin">Administración</NavLink>}
      </div>
      <button className="btn btn-ghost" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  )
}

