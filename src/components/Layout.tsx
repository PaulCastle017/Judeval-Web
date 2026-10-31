import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSport } from '../sport/SportProvider'
import { SPORT_EMOJI, SPORT_LABELS } from '../lib/format'

type NavItem = { to: string; label: string; icon: string; end?: boolean }

// Orden del menú: Entrenamientos va entre Jugadores y Asistencia
const NAV_LINKS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/jugadores', label: 'Jugadores', icon: '👥' },
  { to: '/entrenamientos', label: 'Entrenamientos', icon: '📋' },
  { to: '/asistencia', label: 'Asistencia', icon: '✅' },
  { to: '/revisiones', label: 'Revisiones', icon: '📝' },
  { to: '/compromisos', label: 'Compromisos', icon: '🎯' },
  { to: '/guia', label: 'Guía', icon: '📖' },
]

// En móvil caben 4 accesos + «Más»
const MOBILE_LINKS = NAV_LINKS.slice(0, 4)
const MORE_LINKS = NAV_LINKS.slice(4)

function SportPill() {
  const sport = useSport()
  const location = useLocation()
  return (
    <Link
      to="/deporte"
      state={{ from: location.pathname + location.search }}
      className={`sport-pill sport-pill-${sport}`}
      title="Cambiar de deporte"
    >
      <span aria-hidden="true">{SPORT_EMOJI[sport]}</span>
      <span>{SPORT_LABELS[sport]}</span>
      <span aria-hidden="true" className="sport-pill-caret">
        ▾
      </span>
      <span className="sr-only">(cambiar de deporte)</span>
    </Link>
  )
}

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand-crest" src="/escudo-192.png" alt="" width={36} height={36} />
          <span className="brand-name">JUDEVAL</span>
        </NavLink>
        <SportPill />
        <nav className="topnav" aria-label="Principal">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-user">
          <Link to="/perfil" className="topbar-profile" title="Mi perfil">
            {profile?.full_name || profile?.email}
          </Link>
          <button className="btn btn-on-dark btn-small" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Navegación móvil">
        {MOBILE_LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <span aria-hidden="true" className="bottomnav-icon">
              {l.icon}
            </span>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/mas">
          <span aria-hidden="true" className="bottomnav-icon">
            ☰
          </span>
          Más
        </NavLink>
      </nav>
    </div>
  )
}

export function MorePage() {
  const { isAdmin, signOut } = useAuth()
  const sport = useSport()
  return (
    <div className="stack">
      <h1>Más opciones</h1>
      <div className="card link-list">
        <NavLink to="/deporte" state={{ from: '/mas' }}>
          <span aria-hidden="true">{SPORT_EMOJI[sport]}</span> Cambiar de deporte
          <span className="muted small push-right">Ahora: {SPORT_LABELS[sport]}</span>
        </NavLink>
        {MORE_LINKS.map((l) => (
          <NavLink key={l.to} to={l.to}>
            <span aria-hidden="true">{l.icon}</span> {l.label}
          </NavLink>
        ))}
        <NavLink to="/asistencia/historial">
          <span aria-hidden="true">📊</span> Historial de asistencia
        </NavLink>
        <NavLink to="/perfil">
          <span aria-hidden="true">👤</span> Mi perfil
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin">
            <span aria-hidden="true">⚙️</span> Administración
          </NavLink>
        )}
      </div>
      <button className="btn btn-ghost" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  )
}
