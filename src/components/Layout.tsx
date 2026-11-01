import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSport } from '../sport/SportProvider'
import { SPORT_EMOJI, SPORT_LABELS } from '../lib/format'
import { useWords } from '../i18n/useWords'
import type { Words } from '../i18n/gender'

type NavItem = { to: string; label: string; short?: string; icon: string; end?: boolean }

// Orden del menú: Jugadores · Entrenamientos · Partidos · Asistencia…
const navLinks = (w: Words): NavItem[] => [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/jugadores', label: w.Players, icon: '👥' },
  { to: '/entrenamientos', label: 'Entrenamientos', short: 'Entrenos', icon: '📋' },
  { to: '/partidos', label: 'Partidos', icon: '🏆' },
  { to: '/asistencia', label: 'Asistencia', icon: '✅' },
  { to: '/revisiones', label: 'Revisiones', icon: '📝' },
  { to: '/compromisos', label: 'Compromisos', icon: '🎯' },
  { to: '/guia', label: 'Guía', icon: '📖' },
]

// En móvil: 5 accesos + «Más»
const MOBILE_COUNT = 5

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
  const links = navLinks(useWords())

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand-crest" src="/escudo-192.png" alt="" width={36} height={36} />
          <span className="brand-name">JUDEVAL</span>
        </NavLink>
        <SportPill />
        <nav className="topnav" aria-label="Principal">
          {links.map((l) => (
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
        {links.slice(0, MOBILE_COUNT).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} aria-label={l.label}>
            <span aria-hidden="true" className="bottomnav-icon">
              {l.icon}
            </span>
            <span aria-hidden="true">{l.short ?? l.label}</span>
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
  const moreLinks = navLinks(useWords()).slice(MOBILE_COUNT)
  return (
    <div className="stack">
      <h1>Más opciones</h1>
      <div className="card link-list">
        <NavLink to="/deporte" state={{ from: '/mas' }}>
          <span aria-hidden="true">{SPORT_EMOJI[sport]}</span> Cambiar de deporte
          <span className="muted small push-right">Ahora: {SPORT_LABELS[sport]}</span>
        </NavLink>
        {moreLinks.map((l) => (
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
