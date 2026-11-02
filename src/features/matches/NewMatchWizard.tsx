import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, useCoachCategories } from '../../lib/queries'
import { todayISO } from '../../lib/format'
import { defaultCategoryId, readLast, readRecent, rememberMatch, upcomingWeekend } from '../../lib/defaults'
import { matchSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { CategoryCards, DateChips, Segmented, TimeChips } from '../../components/pickers'
import { ErrorMessage, Field } from '../../components/ui'
import { Wizard } from '../../components/mobile/Wizard'
import type { Enums, Tables } from '../../types/database'

type Venue = Enums<'match_venue'>

function RecentChips({ items, onPick, label }: { items: string[]; onPick: (v: string) => void; label: string }) {
  if (items.length === 0) return null
  return (
    <div className="chips" role="group" aria-label={label}>
      {items.slice(0, 4).map((v) => (
        <button key={v} type="button" className="chip chip-touch" onClick={() => onPick(v)}>
          ↺ {v}
        </button>
      ))}
    </div>
  )
}

/** Alta de partido en el móvil: 1) rival y cuándo · 2) dónde. Después, convocatoria en la ficha. */
export function NewMatchWizard({ categories }: { categories: Tables<'categories'>[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const coachCategories = useCoachCategories()
  const today = todayISO()
  const [form, setForm] = useState(() => {
    const assigned = coachCategories.data?.filter((cc) => cc.coach_id === profile?.id).map((cc) => cc.category_id) ?? []
    return {
      category_id: defaultCategoryId(
        categories.map((c) => c.id),
        assigned,
        readLast('categoria-partido'),
      ),
      opponent: '',
      match_date: upcomingWeekend(today)[0],
      start_time: '',
      venue: 'local' as Venue,
      location: readLast('lugar-local') ?? '',
      competition: readLast('competicion') ?? '',
      notes: '',
    }
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Errores del primer paso (puro: se puede llamar al pintar)
  function firstStepErrors(): FieldErrors {
    const parsed = parseForm(matchSchema, form)
    const keys = ['category_id', 'match_date', 'start_time', 'opponent']
    return parsed.ok ? {} : Object.fromEntries(Object.entries(parsed.errors).filter(([k]) => keys.includes(k)))
  }

  function validateFirst(): string | null {
    const stepErrors = firstStepErrors()
    setErrors(stepErrors)
    return Object.values(stepErrors)[0] ?? null
  }

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof matchSchema.parse>) => unwrap(await supabase.from('matches').insert(values).select('id').single()),
    onSuccess: async (row, values) => {
      rememberMatch(values)
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      navigate(`/partidos/${row.id}`, { replace: true, state: { justSaved: true, created: true } })
    },
  })

  function finish() {
    const parsed = parseForm(matchSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  const recentTimes = readRecent('hora-partido')

  return (
    <div className="stack">
      <h1>Nuevo partido</h1>
      <Wizard
        finishLabel="Crear partido"
        finishing={save.isPending}
        onFinish={finish}
        onCancel={() => navigate('/partidos')}
        steps={[
          {
            id: 'rival',
            title: 'Rival y cuándo',
            validate: validateFirst,
            isComplete: () => Object.keys(firstStepErrors()).length === 0,
            content: (
              <>
                <CategoryCards categories={categories} value={form.category_id} onChange={(id) => set('category_id', id)} label="Categoría *" />
                <Field label="Rival *" error={errors.opponent}>
                  <input value={form.opponent} maxLength={120} placeholder="p. ej. CD Ejemplo" onChange={(e) => set('opponent', e.target.value)} />
                </Field>
                <RecentChips items={readRecent('rival').filter((r) => r !== form.opponent)} onPick={(v) => set('opponent', v)} label="Rivales recientes" />
                <DateChips value={form.match_date} onChange={(d) => set('match_date', d)} suggestions={[today, ...upcomingWeekend(today)]} label="Fecha *" error={errors.match_date} />
                <TimeChips value={form.start_time} onChange={(t) => set('start_time', t)} suggestions={recentTimes.slice(0, 3)} label="Hora" />
              </>
            ),
          },
          {
            id: 'donde',
            title: '¿Dónde?',
            content: (
              <>
                <Segmented
                  label="Local o visitante"
                  value={form.venue}
                  onChange={(v) => setForm((f) => ({ ...f, venue: v, location: readLast(`lugar-${v}`) ?? '' }))}
                  options={[
                    { value: 'local', label: '🏠 Local' },
                    { value: 'visitante', label: '✈️ Visitante' },
                  ]}
                />
                <Field label="Lugar" error={errors.location}>
                  <input value={form.location} maxLength={200} placeholder="Pabellón, dirección…" onChange={(e) => set('location', e.target.value)} />
                </Field>
                <RecentChips items={readRecent(`lugar-${form.venue}`).filter((r) => r !== form.location)} onPick={(v) => set('location', v)} label="Lugares recientes" />
                <Field label="Competición / jornada" error={errors.competition}>
                  <input value={form.competition} maxLength={120} placeholder="p. ej. Liga · J5" onChange={(e) => set('competition', e.target.value)} />
                </Field>
                <Field label="Notas (opcional)" error={errors.notes} hint="Hora de quedada, desplazamiento, equipación…">
                  <textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </Field>
                {save.isError && <ErrorMessage message={toMessage(save.error)} />}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
