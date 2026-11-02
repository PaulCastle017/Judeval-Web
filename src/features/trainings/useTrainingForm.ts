import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { unwrap, unwrapMaybe, useCoachCategories } from '../../lib/queries'
import { minutesBetween, todayISO } from '../../lib/format'
import { defaultCategoryId, pushRecent, readLast, upcomingTrainingDays } from '../../lib/defaults'
import { parseExercises, parseForm, trainingSchema, type ExerciseTag, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import type { Tables } from '../../types/database'

// Ejercicio en el formulario. Los que vienen de la biblioteca guardan su id y una copia
// del enlace, la explicación y las etiquetas del momento en que se añadieron.
export type ExerciseRow = {
  key: number
  name: string
  minutes: string
  notes: string
  exercise_id: string | null
  url: string
  description: string
  tags: ExerciseTag[]
}
let exerciseKey = 0
export const newExercise = (init: Partial<Omit<ExerciseRow, 'key'>> = {}): ExerciseRow => ({
  key: ++exerciseKey,
  name: '',
  minutes: '',
  notes: '',
  exercise_id: null,
  url: '',
  description: '',
  tags: [],
  ...init,
})

export function exerciseFromLibrary(e: Tables<'exercises'>): ExerciseRow {
  return newExercise({
    name: e.title,
    minutes: e.default_minutes?.toString() ?? '',
    exercise_id: e.id,
    url: e.url ?? '',
    description: e.description,
    tags: e.tags as ExerciseTag[],
  })
}

type FormState = { category_id: string; session_date: string; start_time: string; duration_minutes: string; notes: string }

// Borrador del alta en el móvil: sobrevive a una recarga accidental de la página
const DRAFT_KEY = 'judeval.draft.training'
type Draft = { form: FormState; exercises: Omit<ExerciseRow, 'key'>[] }
function readDraft(): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')
    return d && d.form && Array.isArray(d.exercises) ? d : null
  } catch {
    return null
  }
}
export function clearTrainingDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* nada */
  }
}

const categoryTimes = (c?: Tables<'categories'> | null) => ({
  start_time: c?.start_time?.slice(0, 5) ?? '',
  duration_minutes: String(minutesBetween(c?.start_time, c?.end_time) ?? ''),
})

/**
 * Estado, validación y guardado de un entrenamiento. Lo comparten la pantalla única
 * (escritorio y edición) y el asistente por pasos del móvil.
 */
export function useTrainingForm({
  session,
  categories,
  useDraft,
}: {
  session: Tables<'training_sessions'> | null
  categories: Tables<'categories'>[]
  useDraft: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const coachCategories = useCoachCategories()

  // Valores iniciales: los de la sesión; en un alta, la categoría habitual y su próximo día y horario.
  const [form, setForm] = useState<FormState>(() => {
    if (session) {
      return {
        category_id: session.category_id,
        session_date: session.session_date,
        start_time: session.start_time?.slice(0, 5) ?? '',
        duration_minutes: session.duration_minutes?.toString() ?? '',
        notes: session.notes,
      }
    }
    const draft = useDraft ? readDraft() : null
    if (draft && categories.some((c) => c.id === draft.form.category_id)) return draft.form
    const assigned = coachCategories.data?.filter((cc) => cc.coach_id === profile?.id).map((cc) => cc.category_id) ?? []
    const requested = params.get('categoria')
    const categoryId =
      requested && categories.some((c) => c.id === requested)
        ? requested
        : defaultCategoryId(
            categories.map((c) => c.id),
            assigned,
            readLast('categoria-entreno'),
          )
    const category = categories.find((c) => c.id === categoryId)
    return {
      category_id: categoryId,
      session_date: params.get('fecha') ?? upcomingTrainingDays(todayISO(), category?.training_weekdays ?? [], 1)[0] ?? todayISO(),
      ...categoryTimes(category),
      notes: '',
    }
  })
  const [exercises, setExercises] = useState<ExerciseRow[]>(() => {
    if (!session && useDraft) {
      const draft = readDraft()
      if (draft) return draft.exercises.map((e) => newExercise(e))
    }
    return parseExercises(session?.exercises).map((e) =>
      newExercise({
        name: e.name,
        minutes: e.minutes?.toString() ?? '',
        notes: e.notes,
        exercise_id: e.exercise_id ?? null,
        url: e.url ?? '',
        description: e.description ?? '',
        tags: e.tags ?? [],
      }),
    )
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  // Guarda el borrador (solo en el alta con asistente)
  useEffect(() => {
    if (session || !useDraft) return
    try {
      const draft: Draft = {
        form,
        exercises: exercises.map(({ name, minutes, notes, exercise_id, url, description, tags }) => ({ name, minutes, notes, exercise_id, url, description, tags })),
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* sin almacenamiento: no hay borrador */
    }
  }, [form, exercises, session, useDraft])

  // ¿Ya hay un entrenamiento (o una lista) de esa categoría ese día? Se avisa antes de guardar.
  const conflict = useQuery({
    enabled: Boolean(form.category_id && form.session_date),
    queryKey: ['sessions', 'exists', form.category_id, form.session_date],
    queryFn: async () =>
      unwrapMaybe(
        await supabase
          .from('training_sessions')
          .select('id')
          .eq('category_id', form.category_id)
          .eq('session_date', form.session_date)
          .maybeSingle(),
      ),
  })
  const conflictId = conflict.data && conflict.data.id !== session?.id ? conflict.data.id : null

  const category = categories.find((c) => c.id === form.category_id) ?? null

  function changeCategory(id: string) {
    const c = categories.find((x) => x.id === id)
    // En un alta se proponen el próximo día y el horario de la nueva categoría
    setForm((f) => ({
      ...f,
      category_id: id,
      ...(session ? {} : categoryTimes(c)),
      session_date: session ? f.session_date : (upcomingTrainingDays(todayISO(), c?.training_weekdays ?? [], 1)[0] ?? f.session_date),
    }))
  }
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function updateExercise(key: number, patch: Partial<ExerciseRow>) {
    setExercises((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }
  function moveExercise(index: number, delta: number) {
    setExercises((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }
  const removeExercise = (key: number) => setExercises((list) => list.filter((e) => e.key !== key))
  const addExercise = (row: ExerciseRow) => setExercises((list) => [...list, row])

  function parse() {
    return parseForm(trainingSchema, {
      ...form,
      exercises: exercises.map(({ name, minutes, notes, exercise_id, url, description, tags }) => ({
        name,
        minutes,
        notes,
        ...(exercise_id ? { exercise_id } : {}),
        ...(url ? { url } : {}),
        ...(description ? { description } : {}),
        ...(tags.length ? { tags } : {}),
      })),
    })
  }

  const WHEN_KEYS = ['category_id', 'session_date', 'start_time', 'duration_minutes']
  const pick = (errs: FieldErrors, match: (k: string) => boolean) => Object.fromEntries(Object.entries(errs).filter(([k]) => match(k)))

  /** Errores del paso «¿Cuándo?» (puro: no toca el estado; se puede llamar al pintar). */
  function whenErrors(): FieldErrors {
    const parsed = parse()
    return parsed.ok ? {} : pick(parsed.errors, (k) => WHEN_KEYS.includes(k))
  }
  function exerciseErrors(): FieldErrors {
    const parsed = parse()
    return parsed.ok ? {} : pick(parsed.errors, (k) => k.startsWith('exercises'))
  }
  const whenComplete = () => Object.keys(whenErrors()).length === 0 && !conflictId
  const exercisesComplete = () => Object.keys(exerciseErrors()).length === 0

  /** Al pulsar «Siguiente» en «¿Cuándo?»: marca los errores y devuelve el mensaje. */
  function validateWhen(): string | null {
    const errs = whenErrors()
    setErrors(errs)
    if (Object.keys(errs).length) return Object.values(errs)[0] ?? 'Revisa los datos'
    if (conflictId) return 'Ya hay un entrenamiento de esa categoría ese día: elige otra fecha o ábrelo.'
    return null
  }

  /** Al pulsar «Siguiente» en «Ejercicios». */
  function validateExercises(): string | null {
    const errs = exerciseErrors()
    setErrors(errs)
    return Object.keys(errs).length ? 'Revisa los ejercicios marcados' : null
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof trainingSchema.parse>) => {
      if (session) return unwrap(await supabase.from('training_sessions').update(values).eq('id', session.id).select('id').single())
      return unwrap(await supabase.from('training_sessions').insert(values).select('id').single())
    },
    onSuccess: async (row, values) => {
      clearTrainingDraft()
      pushRecent('categoria-entreno', values.category_id)
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      navigate('/entrenamientos', {
        state: session ? undefined : { createdTraining: { id: row.id, date: values.session_date, categoryId: values.category_id } },
      })
    },
  })

  function submit() {
    const parsed = parse()
    if (!parsed.ok) return setErrors(parsed.errors)
    if (conflictId) return
    setErrors({})
    save.mutate(parsed.data)
  }

  const totalMinutes = exercises.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0)
  const duration = Number(form.duration_minutes) || 0

  return {
    session,
    categories,
    category,
    form,
    setField,
    changeCategory,
    exercises,
    setExercises,
    updateExercise,
    moveExercise,
    removeExercise,
    addExercise,
    errors,
    conflictId,
    validateWhen,
    validateExercises,
    whenComplete,
    exercisesComplete,
    submit,
    save,
    totalMinutes,
    duration,
  }
}

export type TrainingFormApi = ReturnType<typeof useTrainingForm>
