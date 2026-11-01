import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { staffName, unwrap, useCategories, useStaff } from '../../lib/queries'
import { formatLongDate, formatTime } from '../../lib/format'
import { currentPollSlot, madridDateHour, nextTrainingDate, POLL_TIME_ZONE } from '../../lib/pollSlot'
import { useLabels, useWords } from '../../i18n/useWords'
import type { Sport } from '../../sport/storage'
import { ErrorMessage } from '../../components/ui'
import type { Tables } from '../../types/database'

const timeFmt = new Intl.DateTimeFormat('es-ES', { timeZone: POLL_TIME_ZONE, hour: '2-digit', minute: '2-digit' })

/** Hora actual que se refresca cada minuto (el recordatorio aparece a las 08:00 sin recargar). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/**
 * Recordatorio de la encuesta de asistencia por WhatsApp (martes y domingo desde las 08:00).
 * Una fila por categoría del deporte activo; al marcarla como enviada se guarda en la BD
 * y deja de mostrarse para todo el equipo técnico. Desaparece cuando todas están enviadas.
 */
export function PollReminder({ sport }: { sport: Sport }) {
  const queryClient = useQueryClient()
  const w = useWords()
  const labels = useLabels()
  const staff = useStaff()
  const categories = useCategories(sport)
  const now = useNow()
  const { slotDate, weekday } = currentPollSlot(now)
  const today = madridDateHour(now).date
  const [copied, setCopied] = useState<string | null>(null)
  const ids = categories.data?.map((c) => c.id) ?? []

  const sent = useQuery({
    enabled: categories.isSuccess && ids.length > 0,
    queryKey: ['poll_reminders', sport, slotDate],
    queryFn: async () =>
      unwrap(await supabase.from('poll_reminders').select('*').eq('slot_date', slotDate).in('category_id', ids)),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['poll_reminders'] })
  const mark = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase.from('poll_reminders').insert({ category_id: categoryId, slot_date: slotDate })
      // Si otro entrenador la acaba de marcar (clave duplicada), el resultado es el mismo
      if (error && error.code !== '23505') throw error
    },
    onSuccess: invalidate,
  })
  const undo = useMutation({
    mutationFn: async (categoryId: string) =>
      unwrap(await supabase.from('poll_reminders').delete().eq('category_id', categoryId).eq('slot_date', slotDate).select('category_id')),
    onSuccess: invalidate,
  })

  if (!categories.isSuccess || !sent.isSuccess) return null
  const sentBy = new Map(sent.data.map((r) => [r.category_id, r]))
  const pending = categories.data.filter((c) => !sentBy.has(c.id))
  if (pending.length === 0) return null // todas enviadas: el recordatorio desaparece

  async function copyText(category: Tables<'categories'>) {
    const day = nextTrainingDate(today, category.training_weekdays)
    const when = day ? `${formatLongDate(day)}${category.start_time ? `, ${formatTime(category.start_time)}` : ''}` : 'el próximo entreno'
    const text = [
      `📣 Entreno de ${category.name} · ${when}`,
      `¿Vienes?`,
      `✅ Sí`,
      `❌ No`,
      `🤕 ${labels.status.lesionado}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(category.id)
    } catch {
      window.prompt('Copia el texto de la encuesta:', text)
    }
  }

  return (
    <section className="card poll-card" aria-live="polite">
      <div className="card-head">
        <h2>📣 Encuesta de asistencia por WhatsApp</h2>
      </div>
      <p>
        Es {weekday}: toca enviar la encuesta de asistencia a {w.thePl} {w.players}. Márcala como enviada cuando la lances para que
        no la repita otra persona del equipo técnico.
      </p>
      {mark.isError && <ErrorMessage message={toMessage(mark.error)} />}
      {undo.isError && <ErrorMessage message={toMessage(undo.error)} />}
      <ul className="list">
        {categories.data.map((c) => {
          const row = sentBy.get(c.id)
          const day = nextTrainingDate(today, c.training_weekdays)
          return (
            <li key={c.id} className="poll-row">
              <span className="list-main">
                <strong>{c.name}</strong>
                {day && (
                  <span className="muted small">
                    Próximo entreno: {formatLongDate(day)}
                    {c.start_time && `, ${formatTime(c.start_time)}`}
                  </span>
                )}
              </span>
              {row ? (
                <span className="row-tight">
                  <span className="small text-success">
                    ✓ Enviada por {staffName(staff.data, row.created_by)} · {timeFmt.format(new Date(row.created_at))}
                  </span>
                  <button className="btn btn-ghost btn-small" onClick={() => undo.mutate(c.id)} disabled={undo.isPending}>
                    Deshacer
                  </button>
                </span>
              ) : (
                <span className="row-tight">
                  <button className="btn btn-ghost btn-small" onClick={() => void copyText(c)}>
                    {copied === c.id ? 'Copiado ✓' : 'Copiar texto'}
                  </button>
                  <button className="btn btn-primary btn-small" onClick={() => mark.mutate(c.id)} disabled={mark.isPending}>
                    Encuesta enviada
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
