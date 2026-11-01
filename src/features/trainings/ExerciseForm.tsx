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
import type { Tables } from '../../types/database'
import { ExerciseThumb } from './ExerciseCard'

/** Crear o editar un ejercicio de la biblioteca (enlace de YouTube/Instagram o texto). */
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
  const [form, setForm] = useState({
    title: exercise?.title ?? '',
    url: exercise?.url ?? '',
    description: exercise?.description ?? '',
    tags: (exercise?.tags ?? []) as ExerciseTag[],
    default_minutes: exercise?.default_minutes?.toString() ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const video = parseVideo(form.url)

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof libraryExerciseSchema.parse>) => {
      if (exercise) return unwrap(await supabase.from('exercises').update(values).eq('id', exercise.id).select().single())
      return unwrap(await supabase.from('exercises').insert({ ...values, sport }).select().single())
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onSaved(row)
    },
  })

  function toggleTag(tag: ExerciseTag) {
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }))
  }

  function onSubmit(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault()
    e.stopPropagation() // puede ir dentro del formulario del entrenamiento
    const parsed = parseForm(libraryExerciseSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    // div con role="form": se usa también dentro del formulario del entrenamiento (no se anidan <form>)
    <div
      className={`card stack-sm ex-form${compact ? ' ex-form-compact' : ''}`}
      role="form"
      aria-label="Ejercicio de la biblioteca"
      onKeyDown={(e) => {
        // Intro en un campo guarda este ejercicio, no el entrenamiento que lo contiene
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault()
          onSubmit(e)
        }
      }}
    >
      <h3>{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio de la biblioteca'}</h3>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      <Field label="Título *" error={errors.title}>
        <input value={form.title} maxLength={120} placeholder="p. ej. Rondo 4×2 con dos toques" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <div className="ex-url-row">
        <ExerciseThumb url={form.url} size="sm" />
        <Field
          label="Enlace (YouTube o Instagram)"
          error={errors.url}
          hint={video ? (video.kind === 'youtube' ? '✓ Vídeo de YouTube' : '✓ Publicación de Instagram') : 'Opcional si explicas el ejercicio por escrito'}
        >
          <input type="url" inputMode="url" value={form.url} placeholder="https://youtu.be/…" onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </Field>
      </div>
      <Field label="Explicación" error={errors.description} hint="Organización, reglas, variantes, material…">
        <textarea rows={compact ? 3 : 5} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="stack-sm">
        <span className="field-label" id="ex-tags-label">
          Etiquetas
        </span>
        <div className="chips" role="group" aria-labelledby="ex-tags-label">
          {EXERCISE_TAGS.map((t) => (
            <button key={t} type="button" aria-pressed={form.tags.includes(t)} className={`chip${form.tags.includes(t) ? ' chip-on' : ''}`} onClick={() => toggleTag(t)}>
              {EXERCISE_TAG_LABELS[t].icon} {EXERCISE_TAG_LABELS[t].label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Minutos habituales" error={errors.default_minutes}>
        <input
          className="input-narrow"
          inputMode="numeric"
          value={form.default_minutes}
          onChange={(e) => setForm({ ...form, default_minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
        />
      </Field>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : exercise ? 'Guardar cambios' : 'Guardar en la biblioteca'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={save.isPending}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
