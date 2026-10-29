import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, useCategories } from '../../lib/queries'
import { POSITION_LABELS, STATUS_LABELS } from '../../lib/format'
import { parseForm, playerSchema, type FieldErrors } from '../../lib/validation'
import { ErrorMessage, Field } from '../../components/ui'
import type { Tables } from '../../types/database'

type Props = {
  player?: Tables<'players'>
  defaultCategoryId?: string
  onSaved: (id: string) => void
  onCancel: () => void
}

export function PlayerForm({ player, defaultCategoryId, onSaved, onCancel }: Props) {
  const queryClient = useQueryClient()
  const categories = useCategories()
  const [form, setForm] = useState({
    category_id: player?.category_id ?? defaultCategoryId ?? '',
    first_name: player?.first_name ?? '',
    last_name: player?.last_name ?? '',
    display_name: player?.display_name ?? '',
    position: player?.position ?? 'jugador',
    status: player?.status ?? 'activo',
    birth_year: player?.birth_year?.toString() ?? '',
    availability_notes: player?.availability_notes ?? '',
    physical_considerations: player?.physical_considerations ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof playerSchema.parse>) => {
      if (player) {
        return unwrap(await supabase.from('players').update(values).eq('id', player.id).select('id').single())
      }
      return unwrap(await supabase.from('players').insert(values).select('id').single())
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['players'] })
      onSaved(row.id)
    },
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(playerSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <h2>{player ? 'Editar jugador' : 'Nuevo jugador'}</h2>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      <div className="grid-2">
        <Field label="Nombre *" error={errors.first_name}>
          <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={60} />
        </Field>
        <Field label="Apellidos" error={errors.last_name}>
          <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} />
        </Field>
        <Field label="Nombre visible / alias" error={errors.display_name} hint="Para distinguir, p. ej. «David (Portero)»">
          <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} maxLength={80} />
        </Field>
        <Field label="Categoría *" error={errors.category_id}>
          <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">— Elige —</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Posición" error={errors.position}>
          <select value={form.position} onChange={(e) => set('position', e.target.value as typeof form.position)}>
            {Object.entries(POSITION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado" error={errors.status}>
          <select value={form.status} onChange={(e) => set('status', e.target.value as typeof form.status)}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Año de nacimiento" error={errors.birth_year}>
          <input
            inputMode="numeric"
            value={form.birth_year}
            onChange={(e) => set('birth_year', e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </Field>
      </div>
      <Field label="Disponibilidad" error={errors.availability_notes} hint="Horarios, días que puede venir, distancia…">
        <textarea
          rows={2}
          value={form.availability_notes}
          onChange={(e) => set('availability_notes', e.target.value)}
          maxLength={500}
        />
      </Field>
      <Field
        label="Consideraciones físicas"
        error={errors.physical_considerations}
        hint="Solo lo necesario para adaptar el entrenamiento (lesiones, asma…). Sin diagnósticos no confirmados."
      >
        <textarea
          rows={2}
          value={form.physical_considerations}
          onChange={(e) => set('physical_considerations', e.target.value)}
          maxLength={1000}
        />
      </Field>
      <div className="row">
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={save.isPending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
