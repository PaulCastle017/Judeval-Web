import type { Words } from '../../i18n/gender'
import type { Sport } from '../../sport/storage'

export type SlotId = 'portero' | 'cierre' | 'ala_izq' | 'ala_der' | 'pivot' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6'

/** Puesto en el diagrama: x / y en % del campo (y = 0 arriba). */
export type SlotDef = { id: SlotId; label: string; x: number; y: number }

/**
 * Fútbol sala: media pista en vertical con la portería abajo (1 portero + 4).
 * Voley: media pista con la red arriba y las 6 zonas de la rotación inicial
 * (delante P4-P3-P2, detrás P5-P6-P1, como en el reglamento).
 */
export function lineupSlots(sport: Sport, w: Words): SlotDef[] {
  if (sport === 'futsal') {
    return [
      { id: 'pivot', label: 'Pívot', x: 50, y: 17 },
      { id: 'ala_izq', label: 'Ala izquierda', x: 18, y: 44 },
      { id: 'ala_der', label: 'Ala derecha', x: 82, y: 44 },
      { id: 'cierre', label: 'Cierre', x: 50, y: 64 },
      { id: 'portero', label: w.Goalkeeper, x: 50, y: 88 },
    ]
  }
  return [
    { id: 'p4', label: 'P4', x: 20, y: 24 },
    { id: 'p3', label: 'P3', x: 50, y: 24 },
    { id: 'p2', label: 'P2', x: 80, y: 24 },
    { id: 'p5', label: 'P5', x: 20, y: 72 },
    { id: 'p6', label: 'P6', x: 50, y: 72 },
    { id: 'p1', label: 'P1 · saque', x: 80, y: 72 },
  ]
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
