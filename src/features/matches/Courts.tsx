/** Diagramas de pista (decorativos: la información la llevan los botones de cada puesto). */

/** Media pista de fútbol sala en vertical: línea de medio campo arriba, portería abajo. */
export function FutsalCourt() {
  return (
    <svg className="court-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="98" rx="1.5" className="court-line court-fill-futsal" />
      {/* Medio campo y círculo central */}
      <path d="M 35 1 A 15 15 0 0 0 65 1" className="court-line" />
      <circle cx="50" cy="1" r="1" className="court-dot" />
      {/* Área (6 m) */}
      <path d="M 18 99 L 18 92 Q 18 74 38 74 L 62 74 Q 82 74 82 92 L 82 99" className="court-line" />
      {/* Punto de penalti y segundo penalti */}
      <circle cx="50" cy="69" r="0.9" className="court-dot" />
      <circle cx="50" cy="49" r="0.9" className="court-dot" />
      {/* Portería */}
      <rect x="42" y="99" width="16" height="1" className="court-goal" />
    </svg>
  )
}

/** Media pista de voley: red arriba y línea de ataque a 3 m. */
export function VolleyCourt() {
  return (
    <svg className="court-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="98" rx="1.5" className="court-line court-fill-volley" />
      <line x1="0" y1="1.5" x2="100" y2="1.5" className="court-net" />
      <line x1="1" y1="34" x2="99" y2="34" className="court-line court-dash" />
    </svg>
  )
}
