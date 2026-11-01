import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { unwrap, usePlayers } from '../../lib/queries'
import { playerName } from '../../lib/format'
import { wordsForSport } from '../../i18n/useWords'
import type { Sport } from '../../sport/storage'
import { ErrorMessage, SuccessMessage } from '../../components/ui'
import { FutsalCourt, VolleyCourt } from './Courts'
import { initials, lineupSlots, type SlotId } from './lineupSlots'
import type { Tables } from '../../types/database'

type SquadRow = Pick<Tables<'match_players'>, 'player_id' | 'lineup_slot'>
type Assignment = Partial<Record<SlotId, string | null>>
type Drag = { playerId: string; startX: number; startY: number; active: boolean }

/**
 * Alineación sobre el diagrama. Tres formas de colocar a alguien:
 *  1) tocar un puesto y elegir de la lista,
 *  2) tocar a una persona de «Suplentes» y después el puesto,
 *  3) arrastrarla (ratón o dedo) a un puesto; entre puestos se intercambian.
 */
export function Lineup({ matchId, squad, sport }: { matchId: string; squad: SquadRow[]; sport: Sport }) {
  const queryClient = useQueryClient()
  const w = wordsForSport(sport)
  const players = usePlayers(sport)
  const slots = lineupSlots(sport, w)
  const nameOf = (id: string) => {
    const p = players.data?.find((x) => x.id === id)
    return p ? playerName(p) : '…'
  }

  const initial: Assignment = Object.fromEntries(
    squad.filter((r) => r.lineup_slot).map((r) => [r.lineup_slot as SlotId, r.player_id]),
  )
  const [assignment, setAssignment] = useState<Assignment>(initial)
  const [savedAssignment, setSavedAssignment] = useState<Assignment>(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<SlotId | null>(null)
  const [saved, setSaved] = useState(false)
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null)
  const drag = useRef<Drag | null>(null)
  const justDragged = useRef(false)

  const placed = new Set(Object.values(assignment).filter(Boolean) as string[])
  const bench = squad.map((r) => r.player_id).filter((id) => !placed.has(id))
  const sameAs = (a: Assignment, b: Assignment) => slots.every((s) => (a[s.id] ?? null) === (b[s.id] ?? null))
  const dirty = !sameAs(assignment, savedAssignment)

  function place(playerId: string, slot: SlotId) {
    setSaved(false)
    setAssignment((prev) => {
      const next = { ...prev }
      const from = slots.find((s) => next[s.id] === playerId)?.id
      const occupant = next[slot] ?? null
      next[slot] = playerId
      // Si venía de otro puesto, intercambian; si venía de suplentes, quien ocupaba el puesto pasa a suplentes
      if (from && from !== slot) next[from] = occupant
      return next
    })
    setSelected(null)
    setOpenSlot(null)
  }

  function clearSlot(slot: SlotId) {
    setSaved(false)
    setAssignment((prev) => ({ ...prev, [slot]: null }))
    setOpenSlot(null)
  }

  function onSlotClick(slot: SlotId) {
    if (justDragged.current) return
    if (selected) return place(selected, slot)
    setOpenSlot((cur) => (cur === slot ? null : slot))
  }

  function onBenchClick(playerId: string) {
    if (justDragged.current) return
    if (openSlot) return place(playerId, openSlot)
    setSelected((cur) => (cur === playerId ? null : playerId))
  }

  // --- Arrastrar (Pointer Events: ratón y táctil) ---------------------------------------
  function onPointerDown(e: ReactPointerEvent<HTMLElement>, playerId: string) {
    if (e.button !== 0) return
    drag.current = { playerId, startX: e.clientX, startY: e.clientY, active: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d) return
    if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return
    d.active = true
    setGhost({ x: e.clientX, y: e.clientY, label: nameOf(d.playerId) })
  }
  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current
    drag.current = null
    if (!d?.active) return // fue un toque: lo gestiona onClick
    setGhost(null)
    justDragged.current = true
    window.setTimeout(() => (justDragged.current = false), 0)
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const slotEl = target?.closest<HTMLElement>('[data-slot]')
    if (slotEl) return place(d.playerId, slotEl.dataset.slot as SlotId)
    if (target?.closest('[data-bench]')) {
      const from = slots.find((s) => assignment[s.id] === d.playerId)?.id
      if (from) clearSlot(from)
    }
  }
  function onPointerCancel() {
    drag.current = null
    setGhost(null)
  }
  const dragHandlers = (playerId: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onPointerDown(e, playerId),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  })

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(assignment).filter(([, id]) => id)) as Record<string, string>
      unwrap(await supabase.rpc('set_match_lineup', { p_match_id: matchId, p_slots: payload }))
    },
    onSuccess: async () => {
      setSaved(true)
      setSavedAssignment(assignment)
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  const filled = slots.filter((s) => assignment[s.id]).length
  const openDef = slots.find((s) => s.id === openSlot)

  return (
    <section className="card stack-sm">
      <div className="card-head">
        <h2>
          🧩 Alineación · {filled}/{slots.length} {sport === 'voley' ? 'en la rotación inicial' : 'titulares'}
        </h2>
      </div>
      {squad.length === 0 ? (
        <p className="muted">Guarda primero la convocatoria para poder colocar a {w.thePl} {w.calledUpPl}.</p>
      ) : (
        <>
          <p className="muted small">
            Toca un puesto y elige quién juega, toca a alguien de «Suplentes» y luego el puesto, o arrástralo al campo.
          </p>
          <div className={`court court-${sport}`}>
            {sport === 'futsal' ? <FutsalCourt /> : <VolleyCourt />}
            {slots.map((s) => {
              const id = assignment[s.id]
              const name = id ? nameOf(id) : null
              return (
                <button
                  key={s.id}
                  type="button"
                  data-slot={s.id}
                  className={`slot${id ? ' slot-filled' : ''}${openSlot === s.id ? ' slot-open' : ''}${selected && !id ? ' slot-target' : ''}`}
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  aria-label={`${s.label}: ${name ?? 'vacío'}`}
                  aria-expanded={openSlot === s.id}
                  onClick={() => onSlotClick(s.id)}
                  {...(id ? dragHandlers(id) : {})}
                >
                  <span className="slot-token" aria-hidden="true">
                    {name ? initials(name) : s.id.startsWith('p') ? s.id.toUpperCase() : '+'}
                  </span>
                  {/* En voley vacío, «P4» ya va en el círculo: solo se repite si añade algo («P1 · saque») */}
                  {(name || s.label.toLowerCase() !== s.id) && (
                    <span className="slot-name" aria-hidden="true">
                      {name ?? s.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {openDef && (
            <div className="slot-picker" role="dialog" aria-label={`Elegir para ${openDef.label}`}>
              <div className="row space-between">
                <strong>¿Quién juega de {openDef.label}?</strong>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpenSlot(null)}>
                  Cerrar
                </button>
              </div>
              <ul className="chips">
                {bench.map((id) => (
                  <li key={id}>
                    <button type="button" className="chip" onClick={() => place(id, openDef.id)}>
                      {nameOf(id)}
                    </button>
                  </li>
                ))}
                {bench.length === 0 && <li className="muted small">No quedan suplentes: arrastra o vacía otro puesto.</li>}
              </ul>
              {assignment[openDef.id] && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => clearSlot(openDef.id)}>
                  Vaciar puesto
                </button>
              )}
            </div>
          )}

          <div className="bench" data-bench>
            <h3>Suplentes ({bench.length})</h3>
            {bench.length === 0 ? (
              <p className="muted small">No queda nadie en el banquillo: toda la convocatoria está en el campo.</p>
            ) : (
              <ul className="chips">
                {bench.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={`chip bench-chip${selected === id ? ' chip-on' : ''}`}
                      aria-pressed={selected === id}
                      onClick={() => onBenchClick(id)}
                      {...dragHandlers(id)}
                    >
                      ⠿ {nameOf(id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && <p className="small text-accent">Ahora toca el puesto donde jugará {nameOf(selected)}.</p>}
          </div>

          {save.isError && <ErrorMessage message={toMessage(save.error)} />}
          {saved && !dirty && <SuccessMessage>Alineación guardada.</SuccessMessage>}
          <div>
            <button type="button" className="btn btn-primary" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
              {save.isPending ? 'Guardando…' : 'Guardar alineación'}
            </button>
          </div>
        </>
      )}
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          {ghost.label}
        </div>
      )}
    </section>
  )
}
