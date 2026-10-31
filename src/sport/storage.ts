import type { Enums } from '../types/database'

export type Sport = Enums<'sport_type'>

// Preferencias por usuario guardadas en el navegador. localStorage puede no estar
// disponible (modo privado, bloqueos), así que todo va en try/catch.

const sportKey = (userId: string) => `judeval.sport.${userId}`

export function readStoredSport(userId: string): Sport | null {
  try {
    const v = localStorage.getItem(sportKey(userId))
    return v === 'futsal' || v === 'voley' ? v : null
  } catch {
    return null
  }
}

export function writeStoredSport(userId: string, sport: Sport) {
  try {
    localStorage.setItem(sportKey(userId), sport)
  } catch {
    /* sin almacenamiento: el deporte dura lo que la pestaña */
  }
}

/** Se llama al iniciar y al cerrar sesión, para que cada login pase por la elección de deporte. */
export function clearStoredSport(userId: string) {
  try {
    localStorage.removeItem(sportKey(userId))
  } catch {
    /* nada que limpiar */
  }
}

export function clearAllStoredSports() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('judeval.sport.')) localStorage.removeItem(key)
  } catch {
    /* nada que limpiar */
  }
}

export function readNumberPref(key: string, fallback: number, min: number, max: number): number {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback
  } catch {
    return fallback
  }
}

export function writeNumberPref(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* preferencia no persistente */
  }
}
