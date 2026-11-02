import { type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, unwrapMaybe, useCategories, useCoachCategories } from '../../lib/queries'
import { useAuth } from '../../auth/AuthProvider'
import { useSport } from '../../sport/SportProvider'
import { ConfirmButton, ErrorMessage, Spinner } from '../../components/ui'
import { Wizard } from '../../components/mobile/Wizard'
import { useIsMobileOnMount } from '../../components/mobile/useIsMobile'
import { EventReviewLink } from '../reviews/EventReviewLink'
import { clearTrainingDraft, useTrainingForm, type TrainingFormApi } from './useTrainingForm'
import { ExercisesSection, NotesField, TrainingSummary, WhenSection } from './TrainingSections'
import type { Tables } from '../../types/database'

/**
 * /entrenamientos/nuevo (alta) o /entrenamientos/:id (edición).
 * En el móvil, el alta es un asistente de 3 pasos; en escritorio y al editar, una sola pantalla.
 */
export function TrainingEditPage() {
  const { id = '' } = useParams()
  const isNew = id === 'nuevo'
  const isMobile = useIsMobileOnMount()
  const sport = useSport()
  const categories = useCategories(sport)
  const coachCategories = useCoachCategories() // para proponer la categoría habitual
  const session = useQuery({
    enabled: !isNew,
    queryKey: ['sessions', 'training', id],
    queryFn: async () => unwrapMaybe(await supabase.from('training_sessions').select('*').eq('id', id).maybeSingle()),
  })

  if (categories.isPending || coachCategories.isPending || (!isNew && session.isPending)) return <Spinner />
  if (categories.isError) return <ErrorMessage error={categories.error} onRetry={categories.refetch} />
  if (session.isError) return <ErrorMessage error={session.error} onRetry={session.refetch} />
  if (!isNew && !session.data) return <ErrorMessage message="Entrenamiento no encontrado." />

  if (isNew && isMobile) return <TrainingWizard categories={categories.data} />
  return <TrainingSinglePage key={session.data?.id ?? 'nuevo'} session={isNew ? null : session.data!} categories={categories.data} />
}

// ---------------------------------------------------------------------------
// Móvil: asistente de 3 pasos (¿Cuándo? → Ejercicios → Resumen)
// ---------------------------------------------------------------------------

function TrainingWizard({ categories }: { categories: Tables<'categories'>[] }) {
  const navigate = useNavigate()
  const t = useTrainingForm({ session: null, categories, useDraft: true })

  return (
    <div className="stack">
      <h1>Nuevo entrenamiento</h1>
      <Wizard
        finishLabel="Crear entrenamiento"
        finishing={t.save.isPending}
        onFinish={t.submit}
        onCancel={() => {
          clearTrainingDraft()
          navigate('/entrenamientos')
        }}
        steps={[
          { id: 'cuando', title: '¿Cuándo?', content: <WhenSection t={t} />, validate: t.validateWhen, isComplete: t.whenComplete },
          {
            id: 'ejercicios',
            title: 'Ejercicios',
            content: <ExercisesSection t={t} />,
            validate: t.validateExercises,
            isComplete: t.exercisesComplete,
          },
          {
            id: 'resumen',
            title: 'Resumen',
            content: (
              <>
                <TrainingSummary t={t} />
                <NotesField t={t} />
                <SaveErrors t={t} />
              </>
            ),
          },
        ]}
      />
    </div>
  )
}

function SaveErrors({ t }: { t: TrainingFormApi }) {
  if (!t.save.isError || (t.save.error as { code?: string }).code === '23505') return null
  return <ErrorMessage message={toMessage(t.save.error)} />
}

// ---------------------------------------------------------------------------
// Escritorio y edición: una sola pantalla con las mismas secciones
// ---------------------------------------------------------------------------

function TrainingSinglePage({ session, categories }: { session: Tables<'training_sessions'> | null; categories: Tables<'categories'>[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile, isAdmin } = useAuth()
  const t = useTrainingForm({ session, categories, useDraft: false })

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('training_sessions').delete().eq('id', session!.id).select('id')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance'] })
      navigate('/entrenamientos', { replace: true })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    t.submit()
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Link to="/entrenamientos" className="back-link">
        ← Entrenamientos
      </Link>
      <header className="page-header">
        <h1>{session ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}</h1>
        {session && (
          <span className="row">
            {session.finished_at && <span className="badge badge-success">Finalizado ✓</span>}
            <Link to={`/asistencia?categoria=${session.category_id}&fecha=${session.session_date}`} className="btn">
              ✅ Pasar lista
            </Link>
          </span>
        )}
      </header>

      {session && <EventReviewLink kind="training" eventId={session.id} />}

      <section className="card stack">
        <h2>📅 ¿Cuándo?</h2>
        <WhenSection t={t} />
        <NotesField t={t} />
      </section>

      <section className="card stack-sm">
        <h2>🏃 Ejercicios</h2>
        <ExercisesSection t={t} />
      </section>

      <SaveErrors t={t} />
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}

      <div className="row sticky-actions">
        <button className="btn btn-primary btn-large" disabled={t.save.isPending}>
          {t.save.isPending ? 'Guardando…' : session ? 'Guardar cambios' : 'Crear entrenamiento'}
        </button>
        <Link to="/entrenamientos" className="btn btn-ghost">
          Cancelar
        </Link>
        {session && (isAdmin || session.created_by === profile?.id) && (
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar (también su lista de asistencia)" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        )}
      </div>
    </form>
  )
}
