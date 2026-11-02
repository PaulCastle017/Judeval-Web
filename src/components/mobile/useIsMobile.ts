import { useState, useSyncExternalStore } from 'react'

/** Breakpoint móvil único de la app (coincide con el CSS: max-width 639px). */
export const MOBILE_QUERY = '(max-width: 639px)'

const matchesNow = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** ¿Pantalla móvil? Se actualiza en vivo (para estilos y comportamientos que no guardan estado). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, matchesNow, () => false)
}

/**
 * ¿Pantalla móvil al abrir la página? Se fija al montar: así girar la tablet o redimensionar
 * la ventana a mitad de un alta no cambia de asistente a pantalla única (y no se pierde lo escrito).
 */
export function useIsMobileOnMount(): boolean {
  const [value] = useState(matchesNow)
  return value
}
