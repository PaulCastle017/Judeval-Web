import { describe, expect, it } from 'vitest'
import { labelsFor, SPORT_GENDER, WORDS, wordsFor } from './gender'

describe('diccionario de género', () => {
  it('cada término tiene forma masculina y femenina', () => {
    for (const [key, [m, f]] of Object.entries(WORDS)) {
      expect(m, key).toBeTruthy()
      expect(f, key).toBeTruthy()
    }
  })

  it('fútbol sala es masculino y voley femenino', () => {
    expect(SPORT_GENDER).toEqual({ futsal: 'm', voley: 'f' })
    expect(wordsFor('m').Players).toBe('Jugadores')
    expect(wordsFor('f').Players).toBe('Jugadoras')
    expect(`${wordsFor('f').New} ${wordsFor('f').player}`).toBe('Nueva jugadora')
    expect(`${wordsFor('m').All} ${wordsFor('m').thePl} ${wordsFor('m').players}`).toBe('Todos los jugadores')
  })

  it('las etiquetas de los enums concuerdan', () => {
    expect(labelsFor('f').status.lesionado).toBe('Lesionada')
    expect(labelsFor('m').status.lesionado).toBe('Lesionado')
    expect(labelsFor('f').attendance.justificado).toBe('Justificada')
    expect(labelsFor('f').position.jugador).toBe('Jugadora')
  })
})

// Guarda anti-regresión: ninguna pantalla debe escribir a mano palabras con género;
// deben salir de la capa src/i18n (useWords / useLabels).
const SOURCES = import.meta.glob(['../features/**/*.tsx', '../components/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const GENDERED =
  /\b(jugador(es|a|as)?|entrenador(es|a|as)?|lesionad[oa]s?|porter[oa]s?|chaval(es|as)?|nacid[oa]|mencionad[oa]s?|convocad[oa]s?|psicólog[oa]s|sustitut[oa]s)\b/i

const ALLOWED = [
  /'(jugador|portero|lesionado)'/g, // valores de enum de la base de datos
  /\/jugadores\b[^'"`\s]*/g, // rutas de la app
  /\.(lesionado|portero|jugador)\b/g, // propiedades (stat.lesionado, labels.position.portero)
  /\blesionado:/g, // claves de objetos
]

describe('guarda de textos con género', () => {
  it('no hay palabras con género escritas a mano en las pantallas', () => {
    const offenders: string[] = []
    for (const [file, source] of Object.entries(SOURCES)) {
      source.split('\n').forEach((line, i) => {
        const t = line.trim()
        if (/^(\/\/|\/\*|\*|\{\/\*|import )/.test(t)) return
        const clean = ALLOWED.reduce((acc, re) => acc.replace(re, ''), line)
        if (GENDERED.test(clean)) offenders.push(`${file}:${i + 1}: ${t}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
