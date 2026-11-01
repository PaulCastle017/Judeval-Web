import type { Enums } from '../types/database'

/**
 * Concordancia de género por deporte: Fútbol sala → masculino, Voley → femenino.
 * Todas las palabras con género de la interfaz salen de aquí; las pantallas
 * componen frases con ellas (`${w.New} ${w.player}`) en vez de duplicar textos.
 */
export type Gender = 'm' | 'f'

export const SPORT_GENDER: Record<Enums<'sport_type'>, Gender> = {
  futsal: 'm',
  voley: 'f',
}

// [masculino, femenino]
export const WORDS = {
  player: ['jugador', 'jugadora'],
  players: ['jugadores', 'jugadoras'],
  coach: ['entrenador', 'entrenadora'],
  coaches: ['entrenadores', 'entrenadoras'],
  goalkeeper: ['portero', 'portera'],
  kids: ['chavales', 'chavalas'],
  they: ['ellos', 'ellas'],
  all: ['todos', 'todas'],
  the: ['el', 'la'],
  thePl: ['los', 'las'],
  a: ['un', 'una'],
  ofThe: ['del', 'de la'],
  toThe: ['al', 'a la'],
  this: ['este', 'esta'],
  these: ['estos', 'estas'],
  some: ['algunos', 'algunas'],
  others: ['otros', 'otras'],
  theSame: ['los mismos', 'las mismas'],
  theOthers: ['los demás', 'las demás'],
  eachOne: ['cada uno', 'cada una'],
  teammate: ['compañero', 'compañera'],
  teammates: ['compañeros', 'compañeras'],
  new: ['nuevo', 'nueva'],
  newPl: ['nuevos', 'nuevas'],
  active: ['activo', 'activa'],
  activePl: ['activos', 'activas'],
  specificPl: ['concretos', 'concretas'],
  mentionedPl: ['mencionados', 'mencionadas'],
  psychologists: ['psicólogos', 'psicólogas'],
  substitutes: ['sustitutos', 'sustitutas'],
  injured: ['lesionado', 'lesionada'],
  injuredPl: ['lesionados', 'lesionadas'],
  born: ['nacido', 'nacida'],
  mentioned: ['mencionado', 'mencionada'],
  calledUp: ['convocado', 'convocada'],
  calledUpPl: ['convocados', 'convocadas'],
  integrated: ['integrado', 'integrada'],
  isolated: ['aislado', 'aislada'],
  quiet: ['callado', 'callada'],
  seen: ['visto', 'vista'],
  respected: ['respetado', 'respetada'],
} as const satisfies Record<string, readonly [string, string]>

type Key = keyof typeof WORDS
export type Words = { [K in Key]: string } & { [K in Key as Capitalize<K>]: string }

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function wordsFor(gender: Gender): Words {
  const i = gender === 'm' ? 0 : 1
  const out: Record<string, string> = {}
  for (const [key, forms] of Object.entries(WORDS)) {
    out[key] = forms[i]
    out[capitalize(key)] = capitalize(forms[i])
  }
  return out as Words
}

/** Etiquetas de los enums de la BD que concuerdan con el género del deporte. */
export function labelsFor(gender: Gender) {
  const pick = (m: string, f: string) => (gender === 'm' ? m : f)
  return {
    status: {
      activo: pick('Activo', 'Activa'),
      lesionado: pick('Lesionado', 'Lesionada'),
      baja: 'Baja',
    } satisfies Record<Enums<'player_status'>, string>,
    attendance: {
      presente: 'Presente',
      ausente: 'Ausente',
      justificado: pick('Justificado', 'Justificada'),
      lesionado: pick('Lesionado', 'Lesionada'),
    } satisfies Record<Enums<'attendance_status'>, string>,
    position: {
      jugador: pick('Jugador', 'Jugadora'),
      portero: pick('Portero', 'Portera'),
    } satisfies Record<Enums<'player_position'>, string>,
  }
}

export type Labels = ReturnType<typeof labelsFor>
