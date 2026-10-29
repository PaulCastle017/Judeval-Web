import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useStaff } from '../../lib/queries'
import { formatDate, todayISO } from '../../lib/format'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../../components/ui'

export function ReviewsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const reviews = useQuery({
    queryKey: ['reviews'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('staff_reviews')
          .select('id, review_date, next_change, created_by, review_actions(done)')
          .order('review_date', { ascending: false }),
      ),
  })

  const create = useMutation({
    mutationFn: async () => unwrap(await supabase.from('staff_reviews').insert({ review_date: todayISO() }).select('id').single()),
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      navigate(`/revisiones/${row.id}`)
    },
  })

  return (
    <div className="stack">
      <PageHeader
        title="Revisiones del equipo técnico"
        subtitle="Reunión breve cada dos o tres semanas para coordinarnos (sección 8 de la guía)."
        actions={
          <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Creando…' : '+ Nueva revisión'}
          </button>
        }
      />
      {create.isError && <ErrorMessage message={toMessage(create.error)} />}
      {reviews.isPending && <Spinner />}
      {reviews.isError && <ErrorMessage error={reviews.error} onRetry={reviews.refetch} />}
      {reviews.isSuccess && reviews.data.length === 0 && <EmptyState>Todavía no hay revisiones. Crea la primera.</EmptyState>}
      {reviews.isSuccess && reviews.data.length > 0 && (
        <ul className="card list">
          {reviews.data.map((r) => {
            const open = r.review_actions.filter((a) => !a.done).length
            return (
              <li key={r.id}>
                <Link to={`/revisiones/${r.id}`} className="list-link">
                  <span className="list-main">
                    <strong>{formatDate(r.review_date)}</strong>
                    <span className="muted small">
                      {r.next_change ? `Cambio a probar: ${r.next_change}` : `Por ${staffName(staff.data, r.created_by)}`}
                    </span>
                  </span>
                  <span className="muted small">
                    {r.review_actions.length ? `${open} de ${r.review_actions.length} acciones pendientes` : 'Sin acciones'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
