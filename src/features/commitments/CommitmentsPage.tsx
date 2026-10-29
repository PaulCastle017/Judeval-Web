import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, useCategories } from '../../lib/queries'
import { commitmentSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { ConfirmButton, EmptyState, ErrorMessage, Field, PageHeader, Spinner } from '../../components/ui'
import type { Tables } from '../../types/database'

type Commitment = Tables<'team_commitments'>

export function CommitmentsPage() {
  const categories = useCategories()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const commitments = useQuery({
    queryKey: ['commitments'],
    queryFn: async () => unwrap(await supabase.from('team_commitments').select('*').order('sort_order').order('created_at')),
  })

  const groups = [
    { id: null as string | null, name: 'Toda la escuela' },
    ...(categories.data ?? []).map((c) => ({ id: c.id as string | null, name: c.name })),
  ]

  return (
    <div className="stack">
      <PageHeader
        title="Nuestro estilo Judeval"
        subtitle="Compromisos sencillos y revisables, acordados a partir de lo que los jugadores dicen que quieren ser como equipo."
        actions={
          !creating && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Compromiso
            </button>
          )
        }
      />
      {creating && <CommitmentForm onDone={() => setCreating(false)} />}
      {commitments.isPending && <Spinner />}
      {commitments.isError && <ErrorMessage error={commitments.error} onRetry={commitments.refetch} />}
      {commitments.isSuccess && commitments.data.length === 0 && <EmptyState>No hay compromisos todavía.</EmptyState>}
      {commitments.isSuccess &&
        groups.map((g) => {
          const items = commitments.data.filter((c) => c.category_id === g.id)
          if (!items.length) return null
          return (
            <section key={g.id ?? 'all'} className="stack-sm">
              <h2>{g.name}</h2>
              {items.map((c) =>
                editing === c.id ? (
                  <CommitmentForm key={c.id} commitment={c} onDone={() => setEditing(null)} />
                ) : (
                  <CommitmentCard key={c.id} commitment={c} onEdit={() => setEditing(c.id)} />
                ),
              )}
            </section>
          )
        })}
    </div>
  )
}

function CommitmentCard({ commitment: c, onEdit }: { commitment: Commitment; onEdit: () => void }) {
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (active: boolean) =>
      unwrap(await supabase.from('team_commitments').update({ active }).eq('id', c.id).select('id').single()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commitments'] }),
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('team_commitments').delete().eq('id', c.id).select('id')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commitments'] }),
  })

  return (
    <article className={`card commitment${c.active ? '' : ' inactive'}`}>
      <h3>{c.title}</h3>
      {c.description && <p>{c.description}</p>}
      {(update.isError || remove.isError) && <ErrorMessage message={toMessage(update.error ?? remove.error)} />}
      <div className="row">
        <button className="btn btn-ghost btn-small" onClick={onEdit}>
          Editar
        </button>
        <button className="btn btn-ghost btn-small" onClick={() => update.mutate(!c.active)} disabled={update.isPending}>
          {c.active ? 'Archivar' : 'Reactivar'}
        </button>
        <ConfirmButton onConfirm={() => remove.mutate()} disabled={remove.isPending}>
          Borrar
        </ConfirmButton>
      </div>
    </article>
  )
}

function CommitmentForm({ commitment, onDone }: { commitment?: Commitment; onDone: () => void }) {
  const queryClient = useQueryClient()
  const categories = useCategories()
  const [form, setForm] = useState({
    title: commitment?.title ?? '',
    description: commitment?.description ?? '',
    category_id: commitment?.category_id ?? '',
    sort_order: String(commitment?.sort_order ?? 10),
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof commitmentSchema.parse>) => {
      if (commitment) {
        return unwrap(await supabase.from('team_commitments').update(values).eq('id', commitment.id).select('id').single())
      }
      return unwrap(await supabase.from('team_commitments').insert(values).select('id').single())
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['commitments'] })
      onDone()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(commitmentSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      <Field label="Compromiso" error={errors.title}>
        <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="p. ej. Nos respetamos" />
      </Field>
      <Field label="Descripción" error={errors.description}>
        <textarea rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid-2">
        <Field label="Ámbito" error={errors.category_id}>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Toda la escuela</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orden" error={errors.sort_order}>
          <input type="number" min={0} max={999} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
        </Field>
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
