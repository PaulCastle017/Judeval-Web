import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useSportState } from '../../sport/SportProvider'
import { SPORT_EMOJI, SPORT_LABELS, SPORTS } from '../../lib/format'

/** Pantalla intermedia tras el login (y al cambiar de deporte desde el menú). */
export function SportPickerPage() {
  const { profile } = useAuth()
  const { sport, setSport } = useSportState()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  return (
    <div className="center-page sport-page">
      <div className="sport-picker">
        <img className="sport-crest" src="/escudo-192.png" alt="Escudo de la Escuela Deportiva JUDEVAL" width={72} height={72} />
        <h1>{profile?.full_name ? `Hola, ${profile.full_name.split(' ')[0]}` : 'Hola'}</h1>
        <p className="muted">¿Con qué deporte vas a trabajar ahora?</p>
        <div className="sport-cards">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`sport-card sport-card-${s}${sport === s ? ' is-current' : ''}`}
              onClick={() => {
                setSport(s)
                navigate(from, { replace: true })
              }}
            >
              <span className="sport-card-emoji" aria-hidden="true">
                {SPORT_EMOJI[s]}
              </span>
              <span className="sport-card-label">{SPORT_LABELS[s]}</span>
              {sport === s && <span className="sport-card-current">Deporte actual</span>}
            </button>
          ))}
        </div>
        <p className="muted small">Podrás cambiar de deporte en cualquier momento desde el menú.</p>
        {sport && (
          <Link to="/" className="btn btn-ghost">
            Volver sin cambiar
          </Link>
        )}
      </div>
    </div>
  )
}
