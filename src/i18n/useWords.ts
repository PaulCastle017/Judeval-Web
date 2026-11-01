import { useSport } from '../sport/SportProvider'
import type { Sport } from '../sport/storage'
import { labelsFor, SPORT_GENDER, wordsFor, type Gender, type Labels, type Words } from './gender'

// Precalculados: solo hay dos géneros.
const WORDS_BY_GENDER: Record<Gender, Words> = { m: wordsFor('m'), f: wordsFor('f') }
const LABELS_BY_GENDER: Record<Gender, Labels> = { m: labelsFor('m'), f: labelsFor('f') }

/** Para textos de un deporte concreto distinto del activo (p. ej. la ficha de un jugador de otro deporte). */
export function wordsForSport(sport: Sport): Words {
  return WORDS_BY_GENDER[SPORT_GENDER[sport]]
}

export function labelsForSport(sport: Sport): Labels {
  return LABELS_BY_GENDER[SPORT_GENDER[sport]]
}

/** Género del deporte activo (solo dentro de <RequireSport>). */
export function useGender(): Gender {
  return SPORT_GENDER[useSport()]
}

/** Palabras con género ya resueltas para el deporte activo: w.players, w.Players, w.New… */
export function useWords(): Words {
  return WORDS_BY_GENDER[useGender()]
}

/** Etiquetas de estado, asistencia y posición concordadas con el deporte activo. */
export function useLabels(): Labels {
  return LABELS_BY_GENDER[useGender()]
}
