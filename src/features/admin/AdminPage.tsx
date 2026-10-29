import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { functionErrorMessage, toMessage } from '../../lib/errors'
import { unwrap, useCategories, useCoachCategories, useStaff } from '../../lib/queries'
import { ROLE_LABELS, WEEKDAYS } from '../../lib/format'
import { categorySchema, newUserSchema, parseForm, password as passwordSchema, type FieldErrors } from '../../lib/validation'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, ConfirmButton, ErrorMessage, Field, PageHeader, Spinner, SuccessMessage } from '../../components/ui'
import type { Enums, Tables } from '../../types/database'

type AdminAction =
  | { action: 'create'; email: string; full_name: string; role: Enums<'staff_role'>; password: string }
  | { action: 'set_active'; user_id: string; active: boolean }
  | { action: 'set_role'; user_id: string; role: Enums<'staff_role'> }
  | { action: 'reset_password'; user_id: string; password: string }

/** Llama a la Edge Function admin-users (la única que usa service_role, en el servidor). */
async function callAdminUsers(body: AdminAction) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(await functionErrorMessage(error))
  return data as { ok: true; user_id?: string }
}

/** Contraseña temporal aleatoria con letras y números. */
function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  const pw = Array.from(bytes, (b) => chars[b % chars.length]).join('')
  return /\d/.test(pw) && /[a-zA-Z]/.test(pw) ? pw : generatePassword()
}

export function AdminPage() {
  const [tab, setTab] = useState<'users' | 'categories'>('users')
  return (
    <div className="stack">
      <PageHeader title="Administración" />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
          Entrenadores
        </button>
        <button
          role="tab"
          aria-selected={tab === 'categories'}
          className={tab === 'categories' ? 'on' : ''}
          onClick={() => setTab('categories')}
        >
          Categorías
        </button>
      </div>
      {tab === 'users' ? <UsersAdmin /> : <CategoriesAdmin />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

function UsersAdmin() {
  const staff = useStaff()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="stack">
      <div className="row space-between">
        <p className="muted small">
          El registro público está desactivado: solo un administrador puede crear cuentas. Comunica la contraseña temporal
          en persona o por un canal privado; el entrenador debe cambiarla en «Mi perfil».
        </p>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nuevo entrenador
          </button>
        )}
      </div>
      {notice && <SuccessMessage>{notice}</SuccessMessage>}
      {creating && (
        <NewUserForm
          onDone={(msg) => {
            setCreating(false)
            setNotice(msg)
          }}
        />
      )}
      {staff.isPending && <Spinner />}
      {staff.isError && <ErrorMessage error={staff.error} onRetry={staff.refetch} />}
      {staff.data?.map((u) => (
        <UserCard key={u.id} user={u} onNotice={setNotice} />
      ))}
    </div>
  )
}

function NewUserForm({ onDone }: { onDone: (message: string | null) => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ full_name: '', email: '', role: 'coach' as Enums<'staff_role'>, password: generatePassword() })
  const [errors, setErrors] = useState<FieldErrors>({})

  const create = useMutation({
    mutationFn: (values: ReturnType<typeof newUserSchema.parse>) => callAdminUsers({ action: 'create', ...values }),
    onSuccess: async (_data, values) => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      onDone(`Cuenta creada para ${values.email}. Contraseña temporal: ${values.password}`)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseForm(newUserSchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    create.mutate(parsed.data)
  }

  return (
    <form className="card stack" onSubmit={onSubmit} noValidate>
      <h2>Nuevo entrenador</h2>
      {create.isError && <ErrorMessage message={toMessage(create.error)} />}
      <div className="grid-2">
        <Field label="Nombre completo" error={errors.full_name}>
          <input value={form.full_name} maxLength={120} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Rol" error={errors.role}>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Enums<'staff_role'> })}>
            <option value="coach">{ROLE_LABELS.coach}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
        </Field>
        <Field label="Contraseña temporal" error={errors.password}>
          <span className="row-tight">
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="btn btn-small" onClick={() => setForm({ ...form, password: generatePassword() })}>
              Generar
            </button>
          </span>
        </Field>
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear cuenta'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onDone(null)} disabled={create.isPending}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function UserCard({ user, onNotice }: { user: Tables<'profiles'>; onNotice: (msg: string) => void }) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const categories = useCategories()
  const coachCategories = useCoachCategories()
  const [resetPw, setResetPw] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const isSelf = user.id === profile?.id

  const action = useMutation({
    mutationFn: callAdminUsers,
    onSuccess: async (_d, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      if (vars.action === 'reset_password') {
        onNotice(`Contraseña de ${user.email} cambiada a: ${vars.password}`)
        setResetPw(null)
      }
    },
  })

  const assign = useMutation({
    mutationFn: async ({ categoryId, on }: { categoryId: string; on: boolean }) => {
      if (on) unwrap(await supabase.from('coach_categories').insert({ coach_id: user.id, category_id: categoryId }))
      else unwrap(await supabase.from('coach_categories').delete().eq('coach_id', user.id).eq('category_id', categoryId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coach_categories'] }),
  })

  const assigned = new Set(coachCategories.data?.filter((cc) => cc.coach_id === user.id).map((cc) => cc.category_id))

  return (
    <article className={`card stack-sm${user.active ? '' : ' inactive'}`}>
      <header className="page-header">
        <div>
          <h3>
            {user.full_name || '(sin nombre)'} {isSelf && <span className="muted small">(tú)</span>}
          </h3>
          <span className="muted small">{user.email}</span>
        </div>
        <span className="row-tight">
          <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>{ROLE_LABELS[user.role]}</Badge>
          <Badge tone={user.active ? 'success' : 'danger'}>{user.active ? 'Activa' : 'Desactivada'}</Badge>
        </span>
      </header>

      <div className="row-tight">
        <span className="small muted">Categorías:</span>
        {categories.data?.map((c) => (
          <label key={c.id} className="checkbox small">
            <input
              type="checkbox"
              checked={assigned.has(c.id)}
              disabled={assign.isPending}
              onChange={(e) => assign.mutate({ categoryId: c.id, on: e.target.checked })}
            />
            {c.name}
          </label>
        ))}
      </div>

      {action.isError && <ErrorMessage message={toMessage(action.error)} />}
      {assign.isError && <ErrorMessage message={toMessage(assign.error)} />}

      {!isSelf && (
        <div className="row">
          <select
            aria-label="Rol"
            value={user.role}
            disabled={action.isPending}
            onChange={(e) => action.mutate({ action: 'set_role', user_id: user.id, role: e.target.value as Enums<'staff_role'> })}
          >
            <option value="coach">{ROLE_LABELS.coach}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
          {user.active ? (
            <ConfirmButton
              onConfirm={() => action.mutate({ action: 'set_active', user_id: user.id, active: false })}
              confirmText="Desactivar acceso"
              disabled={action.isPending}
            >
              Desactivar
            </ConfirmButton>
          ) : (
            <button
              className="btn btn-small"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: 'set_active', user_id: user.id, active: true })}
            >
              Activar
            </button>
          )}
          {resetPw === null ? (
            <button className="btn btn-ghost btn-small" onClick={() => setResetPw(generatePassword())}>
              Nueva contraseña
            </button>
          ) : (
            <span className="row-tight">
              <input value={resetPw} onChange={(e) => setResetPw(e.target.value)} aria-label="Nueva contraseña" />
              <button
                className="btn btn-small"
                disabled={action.isPending}
                onClick={() => {
                  const parsed = passwordSchema.safeParse(resetPw)
                  if (!parsed.success) return setResetError(parsed.error.issues[0].message)
                  setResetError(null)
                  action.mutate({ action: 'reset_password', user_id: user.id, password: parsed.data })
                }}
              >
                Guardar
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => setResetPw(null)}>
                Cancelar
              </button>
            </span>
          )}
        </div>
      )}
      {resetError && <ErrorMessage message={resetError} />}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

function CategoriesAdmin() {
  const categories = useCategories()
  const [creating, setCreating] = useState(false)
  return (
    <div className="stack">
      {!creating && (
        <div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nueva categoría
          </button>
        </div>
      )}
      {creating && <CategoryForm onDone={() => setCreating(false)} />}
      {categories.isPending && <Spinner />}
      {categories.isError && <ErrorMessage error={categories.error} onRetry={categories.refetch} />}
      {categories.data?.map((c) => (
        <CategoryForm key={c.id} category={c} />
      ))}
    </div>
  )
}

function CategoryForm({ category, onDone }: { category?: Tables<'categories'>; onDone?: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: category?.name ?? '',
    schedule_text: category?.schedule_text ?? '',
    training_weekdays: category?.training_weekdays ?? [],
    start_time: category?.start_time?.slice(0, 5) ?? '',
    end_time: category?.end_time?.slice(0, 5) ?? '',
    season: category?.season ?? '2026/27',
    sort_order: String(category?.sort_order ?? 10),
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: async (values: ReturnType<typeof categorySchema.parse>) => {
      if (category) unwrap(await supabase.from('categories').update(values).eq('id', category.id).select('id').single())
      else unwrap(await supabase.from('categories').insert(values).select('id').single())
    },
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      onDone?.()
    },
  })
  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from('categories').delete().eq('id', category!.id).select('id')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  function toggleDay(iso: number) {
    setSaved(false)
    const days = form.training_weekdays.includes(iso)
      ? form.training_weekdays.filter((d) => d !== iso)
      : [...form.training_weekdays, iso].sort()
    setForm({ ...form, training_weekdays: days })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const parsed = parseForm(categorySchema, form)
    if (!parsed.ok) return setErrors(parsed.errors)
    setErrors({})
    save.mutate(parsed.data)
  }

  return (
    <form className="card stack-sm" onSubmit={onSubmit} noValidate>
      <h3>{category ? category.name : 'Nueva categoría'}</h3>
      {save.isError && <ErrorMessage message={toMessage(save.error)} />}
      {remove.isError && <ErrorMessage message={toMessage(remove.error)} />}
      <div className="grid-3">
        <Field label="Nombre" error={errors.name}>
          <input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Inicio" error={errors.start_time}>
          <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </Field>
        <Field label="Fin" error={errors.end_time}>
          <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </Field>
        <Field label="Horario (texto)" error={errors.schedule_text}>
          <input value={form.schedule_text} maxLength={120} onChange={(e) => setForm({ ...form, schedule_text: e.target.value })} />
        </Field>
        <Field label="Temporada" error={errors.season}>
          <input value={form.season} maxLength={20} onChange={(e) => setForm({ ...form, season: e.target.value })} />
        </Field>
        <Field label="Orden" error={errors.sort_order}>
          <input type="number" min={0} max={999} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
        </Field>
      </div>
      <div className="row-tight" role="group" aria-label="Días de entrenamiento">
        <span className="small muted">Días:</span>
        {WEEKDAYS.map((d) => (
          <button
            key={d.iso}
            type="button"
            title={d.name}
            aria-pressed={form.training_weekdays.includes(d.iso)}
            className={`chip${form.training_weekdays.includes(d.iso) ? ' chip-on' : ''}`}
            onClick={() => toggleDay(d.iso)}
          >
            {d.short}
          </button>
        ))}
      </div>
      {saved && <SuccessMessage>Guardado.</SuccessMessage>}
      <div className="row">
        <button className="btn btn-primary btn-small" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onDone}>
            Cancelar
          </button>
        )}
        {category && (
          <ConfirmButton onConfirm={() => remove.mutate()} confirmText="Borrar categoría" disabled={remove.isPending}>
            Borrar
          </ConfirmButton>
        )}
      </div>
    </form>
  )
}
