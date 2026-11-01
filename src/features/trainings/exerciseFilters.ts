import type { ExerciseTag } from '../../lib/validation'
import type { Tables } from '../../types/database'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Filtra la biblioteca por texto (título y explicación, sin tildes) y etiqueta. */
export function filterExercises(list: Tables<'exercises'>[], search: string, tag: ExerciseTag | '') {
  const term = normalize(search.trim())
  return list.filter((e) => (!tag || e.tags.includes(tag)) && (!term || normalize(`${e.title} ${e.description}`).includes(term)))
}
