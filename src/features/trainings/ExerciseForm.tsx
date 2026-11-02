import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap } from '../../lib/queries'
import { EXERCISE_TAG_LABELS } from '../../lib/format'
import { EXERCISE_TAGS, libraryExerciseSchema, parseForm, type ExerciseTag, type FieldErrors } from '../../lib/validation'
import { parseVideo } from '../../lib/video'
import type { Sport } from '../../sport/storage'
import { ErrorMessage, Field } from '../../components/ui'
import { Segmented } from '../../components/pickers'
import { useIsMobile } from '../../components/mobile/useIsMobile'
import type { Tables } from '../../types/database'
import { ExerciseThumb } from './ExerciseCard'

type Mode = 'video' | 'texto'
const MINUTE_PRESETS = [5, 10, 15, 20]

/**
 * Crear o editar un ejercicio de la biblioteca. Primero se elige el tipo (vídeo o texto)
 * y solo se muestra el campo que hace falta. En el móvil ocupa toda la pantalla, con
 * «Guardar» fijo abajo.
 */
export function ExerciseForm({
  sport,
  exercise,
  onSaved,
  onCancel,
  compact,
}: {
  sport: Sport
  exercise?: Tables<'exercises'>
  onSaved: (exercise: Tables<'exercises'>) => void
  onCancel: () => void
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [mode, setMode] = useState<Mode>(exercise && !exercise.url ? 'texto' : 'video')
  const [form, setForm] = useState({
    title: exercise?.title ?? '',
    url: exercise?.url ?? '',
    description: exercise?.description ?? '',
    tags: (exercise?.tags ?? []) as ExerciseTag[],
    default_minutes: exercise?.default_minutes?.toString() ?? '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const video = parseVideo(form.url)

  // En modo texto no se guarda enlace
  const values = { ...form, url: mode === 'video' ? form.url : '' }
  const parsed = parseForm(libraryExerciseSchema, values)
  const allErrors: FieldErrors = parsed.ok ? {} : { ...parsed.errors }
  if (mode === 'video') {
    // En modo vídeo lo que falta es el enlace (las notas son opcionales)
    delete allErrors.description
    if (!values.url.trim()) allErrors.url ??= 'Pega el enlace del vídeo o cambia a «📝 Texto»'
  }
  const valid = parsed.ok && Object.keys(allErrors).length === 0
  // Validación en línea: el aviso aparece al salir del campo (o al intentar guardar)
  const errors: FieldErrors = Object.fromEntries(
    Object.entries(allErrors).filter(([k]) => submitted || touched[k] || (k === 'description' && touched.url)),
  )
  const blur = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }))

  const save = useMutation({
    mutationFn: async (data: ReturnType<typeof libraryExerciseSchema.parse>) => {
      if (exercise) return unwrap(await supabase.from('exercises').update(data).eq('id', exercise.id).select().single())
      return unwrap(await supabase.from('exercises').insert({ ...data, sport }).select().single())
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onSaved(row)
    },
  })

  function toggleTag(tag: ExerciseTag) {
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }))
  }

  async function pasteLink() {
    setPasteHint(null)
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) return setPasteHint('El portapapeles está vacío.')
      setForm((f) => ({ ...f, url: text }))
      setTouched((t) => ({ ...t, url: true }))
    } catch {
      setPasteHint('Tu navegador no deja leer el portapapeles: mantén pulsado el campo y elige «Pegar».')
    }
  }

  function submit(e?: { preventDefault(): void; stopPropagation(): void }) {
    e?.preventDefault()
    e?.stopPropagation() // puede ir dentro del formulario del entrenamiento
    setSubmitted(true)
    if (valid && parsed.ok) save.mutate(parsed.data)
  }

  const actions = (
    <div className={isMobile ? 'sheet-actions' : 'row'}>
      <button type="button" className="btn btn-ghost btn-touch" onClick={onCancel} disabled={save.isPending}>
        Cancelar
      </button>
      <button type="button" className="btn btn-primary btn-touch" onClick={() => submit()} disabled={save.isPending}>
        {save.isPending ? 'Guardando…' : exercise ? 'Guardar cambios' : 'Guardar ejercicio'}
      </button>
    </div>
  )

  return (
    // div con role="form": también va dentro del formulario del entrenamiento (no se anidan <form>)
    <div
      className={`card stack-sm ex-form${compact ? ' ex-form-compact' : ''}${isMobile ? ' sheet' : ''}`}
      role="form"
      aria-label="Ejercicio de la biblioteca"
      onKeyDown={(e) => {
        // Intro en un campo guarda este ejercicio, no el entrenamiento que lo contiene
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault()
          submit(e)
        }
      }}
    >
      <h3>{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h3>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}

      <Segmented
        label="Tipo de ejercicio"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'video', label: '🎬 Vídeo' },
          { value: 'texto', label: '📝 Texto' },
        ]}
      />

      {mode === 'video' ? (
        <div className="stack-sm">
          <button type="button" className="btn btn-touch paste-btn" onClick={() => void pasteLink()}>
            📋 Pegar enlace de YouTube o Instagram
          </button>
          {pasteHint && <span className="field-hint">{pasteHint}</span>}
          <Field
            label="Enlace"
            error={errors.url}
            hint={video ? (video.kind === 'youtube' ? '✓ Vídeo de YouTube' : '✓ Publicación de Instagram') : 'https://youtu.be/… o https://instagram.com/…'}
          >
            <input type="url" inputMode="url" value={form.url} onBlur={blur('url')} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          {video && (
            <div className="ex-url-preview">
              <ExerciseThumb url={form.url} />
            </div>
          )}
        </div>
      ) : (
        <Field label="Explicación *" error={errors.description} hint="Organización, reglas, variantes, material…">
          <textarea
            rows={compact ? 4 : 6}
            maxLength={4000}
            value={form.description}
            onBlur={blur('description')}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      )}

      <Field label="Título *" error={errors.title}>
        <input
          value={form.title}
          maxLength={120}
          placeholder="p. ej. Rondo 4×2 con dos toques"
          onBlur={blur('title')}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>

      {mode === 'video' && (
        <Field label="Notas (opcional)" error={errors.description}>
          <textarea rows={2} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      )}

      <div className="pick-group">
        <span className="field-label" id="ex-tags-label">
          Etiquetas
        </span>
        <div className="chips" role="group" aria-labelledby="ex-tags-label">
          {EXERCISE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={form.tags.includes(t)}
              className={`chip chip-touch${form.tags.includes(t) ? ' chip-on' : ''}`}
              onClick={() => toggleTag(t)}
            >
              {EXERCISE_TAG_LABELS[t].icon} {EXERCISE_TAG_LABELS[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="pick-group">
        <span className="field-label" id="ex-minutes-label">
          Minutos habituales
        </span>
        <div className="row-tight" role="group" aria-labelledby="ex-minutes-label">
          {MINUTE_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={Number(form.default_minutes) === m}
              className={`chip chip-touch${Number(form.default_minutes) === m ? ' chip-on' : ''}`}
              onClick={() => setForm({ ...form, default_minutes: String(m) })}
            >
              {m}′
            </button>
          ))}
          <input
            className="input-narrow"
            inputMode="numeric"
            aria-label="Otros minutos"
            value={form.default_minutes}
            onChange={(e) => setForm({ ...form, default_minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
          />
        </div>
        {errors.default_minutes && <span className="field-error">{errors.default_minutes}</span>}
      </div>

      {actions}
    </div>
  )
}
