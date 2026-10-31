import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, useCategories } from '../../lib/queries'
import { COMMITMENT_STATUS_LABELS, SPORT_EMOJI, SPORT_LABELS } from '../../lib/format'
import { commitmentSchema, parseForm, type FieldErrors } from '../../lib/validation'
import { useSport } from '../../sport/SportProvider'
import { Badge, ConfirmButton, EmptyState, ErrorMessage, Field, PageHeader, Spinner } from '../../components/ui'
import type { Enums, Tables } from '../../types/database'

type Commitment = Tables<'team_commitments'>
type Status = Enums<'commitment_status'>

const STATUSES: Status[] = ['pendiente', 'cumplido', 'no_conseguido']
const STATUS_TONE: Record<Status, string> = { pendiente: 'warn', cumplido: 'success', no_conseguido: 'danger' }
const STATUS_ICON: Record<Status, string> = { pendiente: '⏳', cumplido: '✅', no_conseguido: '❌' }

export function CommitmentsPage() {
  const sport = useSport()
  const categories = useCategories(sport)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [showArchived, setShowArchived] = useState(false)
  const commitments = useQuery({
    queryKey: ['commitments', sport],
    queryFn: async () =>
      unwrap(await supabase.from('team_commitments').select('*').eq('sport', sport).order('sort_order').order('created_at')),
  })

  const visible = (commitments.data ?? []).filter((c) => (showArchived || c.active) && (!statusFilter || c.status === statusFilter))
  const countBy = (s: Status) => (commitments.data ?? []).filter((c) => (showArchived || c.active) && c.status === s).length
  const groups = [
    { id: null as string | null, name: `Todo ${SPORT_LABELS[sport]}` },
    ...(categories.data ?? []).map((c) => ({ id: c.id as string | null, name: c.name })),
  ]

  return (
    <div className="stack">
      <PageHeader
        title={`${SPORT_EMOJI[sport]} Nuestro estilo Judeval`}
        subtitle="Compromisos sencillos y revisables, acordados a partir de lo que los jugadores dicen que quieren ser como equipo."
        actions={
          !creating && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Compromiso
            </button>
          )
        }
      />

      <div className="row space-between">
        <div className="chips" role="group" aria-label="Filtrar por estado">
          <button className={`chip${statusFilter === '' ? ' chip-on' : ''}`} onClick={() => setStatusFilter('')}>
            Todos
          </button>
          {STATUSES.map((s) => (
            <button key={s} className={`chip${statusFilter === s ? ' chip-on' : ''}`} onClick={() => setStatusFilter(s)}>
              {STATUS_ICON[s]} {COMMITMENT_STATUS_LABELS[s].replace('Objetivo ', '')} ({countBy(s)})
            </button>
          ))}
        </div>
        <label className="checkbox small">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar archivados
        </label>
      </div>

      {creating && <CommitmentForm onDone={() => setCreating(false)} />}
      {commitments.isPending && <Spinner />}
      {commitments.isError && <ErrorMessage error={commitments.error} onRetry={commitments.refetch} />}
      {commitments.isSuccess && visible.length === 0 && <EmptyState>No hay compromisos con este filtro.</EmptyState>}
      {commitments.isSuccess &&
        groups.map((g) => {
          const items = visible.filter((c) => c.category_id === g.id)
          if (!items.length) return null
          return (
            <section key={g.id ?? 'all'} className="stack-sm">
              <h2>{g.name}</h2>
              <div className="commitment-grid">
                {items.map((c) =>
                  editing === c.id ? (
                    <CommitmentForm key={c.id} commitment={c} onDone={() => setEditing(null)} />
                  ) : (
                    <CommitmentCard key={c.id} commitment={c} onEdit={() => setEditing(c.id)} />
                  ),
                )}
              </div>
            </section>
          )
        })}
    </div>
  )
}

function CommitmentCard({ commitment: c, onEdit }: { commitment: Commitment; onEdit: () => void }) {
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<Commitment, 'active' | 'status'>>) =>
      unwrap(await supabase.from('team_commitments').update(patch).eq('id', c.id).select('id').single()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commitments'] }),
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('team_commitments').delete().eq('id', c.id).select('id')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commitments'] }),
  })

  return (
    <article className={`card commitment commitment-${c.status}${c.active ? '' : ' inactive'}`}>
      <header className="row space-between">
        <Badge tone={STATUS_TONE[c.status]}>
          {STATUS_ICON[c.status]} {COMMITMENT_STATUS_LABELS[c.status]}
        </Badge>
        {!c.active && <Badge>Archivado</Badge>}
      </header>
      <h3>{c.title}</h3>
      {c.description && <p>{c.description}</p>}
      {(update.isError || remove.isError) && <ErrorMessage message={toMessage(update.error ?? remove.error)} />}
      <footer className="row">
        <select
          aria-label={`Estado de «${c.title}»`}
          value={c.status}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ status: e.target.value as Status })}
          className="select-small"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMMITMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-small" onClick={onEdit}>
          Editar
        </button>
        <button className="btn btn-ghost btn-small" onClick={() => update.mutate({ active: !c.active })} disabled={update.isPending}>
          {c.active ? 'Archivar' : 'Reactivar'}
        </button>
        <ConfirmButton onConfirm={() => remove.mutate()} disabled={remove.isPending}>
          Borrar
        </ConfirmButton>
      </footer>
    </article>
  )
}

function CommitmentForm({ commitment, onDone }: { commitment?: Commitment; onDone: () => void }) {
  const queryClient = useQueryClient()
  const sport = useSport()
  const categories = useCategories(commitment?.sport ?? sport)
  const [form, setForm] = useState({
    title: commitment?.title ?? '',
    description: commitment?.description ?? '',
    category_id: commitment?.category_id ?? '',
    status: commitment?.status ?? ('pendiente' as Status),
    sort_order: String(commitment?.sort_order ?? 10),
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof commitmentSchema.parse>) => {
      if (commitment) {
        return unwrap(await supabase.from('team_commitments').update(values).eq('id', commitment.id).select('id').single())
      }
      return unwrap(await supabase.from('team_commitments').insert({ ...values, sport }).select('id').single())
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
      <div className="grid-3">
        <Field label="Estado" error={errors.status}>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {COMMITMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ámbito" error={errors.category_id}>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Todo {SPORT_LABELS[commitment?.sport ?? sport]}</option>
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
