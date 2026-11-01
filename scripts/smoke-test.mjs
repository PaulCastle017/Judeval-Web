// Prueba de humo end-to-end contra el Supabase LOCAL (npx supabase start).
// Ejercita las operaciones principales y los permisos usando la API real.
// Uso: npm run smoke
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const URL = status.API_URL
const ANON = status.ANON_KEY
const SERVICE = status.SERVICE_ROLE_KEY
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL)) {
  console.error('Este script solo se ejecuta contra Supabase local.')
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL, SERVICE, opts)
const newClient = () => createClient(URL, ANON, opts)

let passed = 0
let failed = 0
function check(cond, label, extra) {
  if (cond) {
    passed++
    console.log(`  ✔ ${label}`)
  } else {
    failed++
    console.log(`  ✘ ${label}`, extra ?? '')
  }
}

const stamp = Date.now()
const ADMIN_EMAIL = `smoke-admin-${stamp}@test.local`
const COACH_EMAIL = `smoke-coach-${stamp}@test.local`
const PASS = 'Prueba1234'
const created = { users: [], playerId: null, reviewId: null, commitmentId: null, matchId: null }

async function callAdminFn(client, body) {
  const { data, error } = await client.functions.invoke('admin-users', { body })
  let status = 200
  let message = data?.error
  if (error) {
    status = error.context?.status ?? 0
    try {
      message = (await error.context.json()).error
    } catch {
      message = error.message
    }
  }
  return { status, data, message }
}

try {
  console.log('1. Preparar admin (bootstrap con service_role, como en el README)')
  const { data: au, error: auErr } = await service.auth.admin.createUser({ email: ADMIN_EMAIL, password: PASS, email_confirm: true })
  if (auErr) throw auErr
  created.users.push(au.user.id)
  await service.from('profiles').update({ role: 'admin', active: true, full_name: 'Admin Smoke' }).eq('id', au.user.id)

  const admin = newClient()
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: PASS })
  check(!loginErr, 'admin inicia sesión', loginErr?.message)

  console.log('2. Edge Function admin-users')
  const createRes = await callAdminFn(admin, { action: 'create', email: COACH_EMAIL, full_name: 'Coach Smoke', role: 'coach', password: PASS })
  check(createRes.status === 200 && createRes.data?.user_id, 'admin crea un entrenador', createRes)
  const coachId = createRes.data?.user_id
  if (coachId) created.users.push(coachId)

  const dupRes = await callAdminFn(admin, { action: 'create', email: COACH_EMAIL, full_name: 'X', role: 'coach', password: PASS })
  check(dupRes.status === 409, 'email duplicado → 409', dupRes)
  const badRes = await callAdminFn(admin, { action: 'create', email: 'no-es-email', full_name: 'X', role: 'coach', password: PASS })
  check(badRes.status === 400, 'email no válido → 400', badRes)
  const weakRes = await callAdminFn(admin, { action: 'create', email: `x${stamp}@test.local`, full_name: 'X', role: 'coach', password: '123' })
  check(weakRes.status === 400, 'contraseña débil → 400', weakRes)

  const coach = newClient()
  const { error: coachLoginErr } = await coach.auth.signInWithPassword({ email: COACH_EMAIL, password: PASS })
  check(!coachLoginErr, 'el entrenador inicia sesión', coachLoginErr?.message)

  const coachFn = await callAdminFn(coach, { action: 'set_role', user_id: coachId, role: 'admin' })
  check(coachFn.status === 403, 'un entrenador NO puede usar admin-users → 403', coachFn)

  console.log('3. Operaciones del entrenador')
  const { data: cats, error: catErr } = await coach.from('categories').select('id, name, sport').eq('sport', 'futsal').order('sort_order')
  check(!catErr && cats.length >= 2, `lee categorías de fútbol sala (${cats?.length})`, catErr)
  const { data: voleyCats } = await coach.from('categories').select('id').eq('sport', 'voley')
  check(voleyCats?.length >= 2, `existen categorías de voley (${voleyCats?.length})`)
  const { count: seeded } = await coach.from('players').select('*', { count: 'exact', head: true })
  check(seeded >= 24, `lee jugadores del seed (${seeded})`)
  const { count: voleyPlayers } = await coach
    .from('players')
    .select('id, category:categories!inner(sport)', { count: 'exact', head: true })
    .eq('category.sport', 'voley')
  check(voleyPlayers === 0, `filtro por deporte: voley no incluye jugadores de fútbol (${voleyPlayers})`)

  const { data: player, error: pErr } = await coach
    .from('players')
    .insert({ category_id: cats[0].id, first_name: 'Smoke', last_name: 'Test', position: 'portero' })
    .select()
    .single()
  check(!pErr && player.created_by === coachId, 'crea jugador (created_by = entrenador)', pErr)
  created.playerId = player?.id

  const { data: note, error: nErr } = await coach
    .from('player_notes')
    .insert({ player_id: player.id, type: 'conversacion', topic: 'bienestar', body: 'Conversación de prueba', follow_up: true })
    .select()
    .single()
  check(!nErr && note.author_id === coachId, 'crea nota de conversación con seguimiento', nErr)

  const { error: invalidNoteErr } = await coach.from('player_notes').insert({ player_id: player.id, body: '   ' })
  check(!!invalidNoteErr, 'rechaza nota vacía (CHECK en BD)')

  const today = new Date().toISOString().slice(0, 10)
  const { data: session, error: sErr } = await coach
    .from('training_sessions')
    .upsert({ category_id: cats[0].id, session_date: '2000-01-03', closing_question: '¿Qué ha hecho hoy el equipo para ayudarse?' }, { onConflict: 'category_id,session_date' })
    .select()
    .single()
  check(!sErr && session?.id, 'crea sesión de entrenamiento', sErr)
  const { error: aErr } = await coach
    .from('attendance')
    .upsert([{ session_id: session.id, player_id: player.id, status: 'presente' }], { onConflict: 'session_id,player_id' })
  check(!aErr, 'pasa lista', aErr)
  const { error: a2Err } = await coach
    .from('attendance')
    .upsert([{ session_id: session.id, player_id: player.id, status: 'justificado', comment: 'Examen' }], { onConflict: 'session_id,player_id' })
  check(!a2Err, 'corrige la asistencia (upsert)', a2Err)

  const { data: stats, error: stErr } = await coach.rpc('player_attendance_stats', { p_from: '2000-01-01', p_to: '2000-01-31' })
  const mine = stats?.find((s) => s.player_id === player.id)
  check(!stErr && mine?.justificado === 1 && mine?.total === 1, 'estadísticas de asistencia', stErr ?? stats)

  const { error: rpcErr } = await coach.rpc('set_note_follow_up_done', { p_note_id: note.id, p_done: true })
  check(!rpcErr, 'marca seguimiento como resuelto', rpcErr)

  const { data: reviewId, error: rErr } = await coach.rpc('save_review', {
    p_id: null,
    p_sport: 'futsal',
    p_review_date: today,
    p_body: 'Revisión libre de prueba',
    p_player_ids: [player.id],
  })
  check(!rErr && reviewId, 'crea revisión libre con jugador etiquetado (RPC save_review)', rErr)
  created.reviewId = reviewId
  const { data: tagged } = await coach.from('review_players').select('player_id').eq('review_id', reviewId)
  check(tagged?.length === 1 && tagged[0].player_id === player.id, 'la etiqueta del jugador queda guardada')

  const { data: training, error: tErr } = await coach
    .from('training_sessions')
    .insert({
      category_id: cats[0].id,
      session_date: '2030-01-07',
      start_time: '17:00',
      duration_minutes: 90,
      notes: 'Entrenamiento de prueba',
      exercises: [{ name: 'Rondo 4x2', minutes: 15, notes: '' }],
    })
    .select()
    .single()
  check(!tErr && training.exercises.length === 1, 'crea entrenamiento planificado con ejercicios', tErr)
  const { error: dupErr } = await coach.from('training_sessions').insert({ category_id: cats[0].id, session_date: '2030-01-07' })
  check(dupErr?.code === '23505', 'un segundo entrenamiento misma categoría y día se rechaza (23505)', dupErr)

  const { data: commitment, error: cErr } = await coach
    .from('team_commitments')
    .insert({ sport: 'futsal', title: 'Compromiso smoke', status: 'pendiente' })
    .select()
    .single()
  created.commitmentId = commitment?.id
  const { data: updatedC, error: cuErr } = await coach
    .from('team_commitments')
    .update({ status: 'cumplido' })
    .eq('id', commitment?.id)
    .select()
    .single()
  check(!cErr && !cuErr && updatedC?.status === 'cumplido', 'cambia el estado de un compromiso', cErr ?? cuErr)

  const { data: news, error: newsErr } = await coach.rpc('player_last_news', { p_sport: 'futsal' })
  const myNews = news?.find((n) => n.player_id === player.id)
  check(!newsErr && myNews?.last_news_date, 'noticias: el jugador con nota reciente tiene fecha', newsErr ?? myNews)

  const { data: match, error: mErr } = await coach
    .from('matches')
    .insert({ category_id: cats[0].id, match_date: '2000-01-08', opponent: 'CD Smoke', venue: 'visitante', competition: 'Liga · J1' })
    .select()
    .single()
  check(!mErr && match?.id, 'crea un partido', mErr)
  created.matchId = match?.id
  const { error: sqErr } = await coach.rpc('set_match_squad', { p_match_id: match.id, p_player_ids: [player.id] })
  check(!sqErr, 'hace la convocatoria (RPC set_match_squad)', sqErr)
  const { error: mpErr } = await coach
    .from('match_players')
    .upsert([{ match_id: match.id, player_id: player.id, status: 'presente' }], { onConflict: 'match_id,player_id' })
  check(!mpErr, 'pasa lista en el partido', mpErr)
  const { error: halfErr } = await coach.from('matches').update({ goals_for: 2 }).eq('id', match.id)
  check(!!halfErr, 'rechaza un resultado a medias')
  const { error: resErr } = await coach.from('matches').update({ goals_for: 2, goals_against: 2 }).eq('id', match.id)
  check(!resErr, 'guarda el resultado', resErr)
  const { data: mStats, error: msErr } = await coach.rpc('player_match_stats', { p_from: '2000-01-01', p_to: '2000-01-31' })
  const myMatch = mStats?.find((r) => r.player_id === player.id)
  check(!msErr && myMatch?.called_up === 1 && myMatch?.presente === 1, 'estadísticas de partidos', msErr ?? mStats)

  const { error: pollErr } = await coach.from('poll_reminders').insert({ category_id: cats[0].id, slot_date: '2000-01-02' })
  check(!pollErr, 'marca la encuesta de WhatsApp como enviada', pollErr)
  const { error: pollDupErr } = await admin.from('poll_reminders').insert({ category_id: cats[0].id, slot_date: '2000-01-02' })
  check(pollDupErr?.code === '23505', 'otra persona no puede duplicarla (23505, la app lo trata como ya enviada)', pollDupErr)
  const { data: pollSeen } = await admin.from('poll_reminders').select('created_by').eq('slot_date', '2000-01-02')
  check(pollSeen?.[0]?.created_by === coachId, 'el resto del equipo ve quién la envió')
  const { data: undone, error: undoErr } = await coach.from('poll_reminders').delete().eq('slot_date', '2000-01-02').select()
  check(!undoErr && undone?.length === 1, 'deshace la marca de encuesta', undoErr)

  console.log('4. Permisos negativos')
  const { error: roleErr } = await coach.from('profiles').update({ role: 'admin' }).eq('id', coachId)
  check(!!roleErr, 'el entrenador NO puede cambiarse el rol')
  const { data: delP } = await coach.from('players').delete().eq('id', player.id).select()
  check((delP ?? []).length === 0, 'el entrenador NO puede borrar jugadores')
  const { error: catInsErr } = await coach.from('categories').insert({ name: `Hack ${stamp}` })
  check(!!catInsErr, 'el entrenador NO puede crear categorías')

  const anon = newClient()
  const { error: anonErr } = await anon.from('players').select('id')
  check(!!anonErr, 'un usuario anónimo NO puede leer jugadores')
  const { error: signUpErr } = await anon.auth.signUp({ email: `intruso-${stamp}@test.local`, password: PASS })
  check(!!signUpErr, 'el registro público está desactivado', signUpErr?.message)

  console.log('5. Desactivar cuenta')
  const offRes = await callAdminFn(admin, { action: 'set_active', user_id: coachId, active: false })
  check(offRes.status === 200, 'admin desactiva al entrenador', offRes)
  const { data: afterOff } = await coach.from('players').select('id')
  check((afterOff ?? []).length === 0, 'la sesión de una cuenta desactivada ya no ve datos')
  const { error: reLoginErr } = await newClient().auth.signInWithPassword({ email: COACH_EMAIL, password: PASS })
  check(!!reLoginErr, 'una cuenta desactivada no puede iniciar sesión')
  const selfRes = await callAdminFn(admin, { action: 'set_active', user_id: au.user.id, active: false })
  check(selfRes.status === 400, 'el admin no puede desactivarse a sí mismo')
} catch (err) {
  failed++
  console.error('Error inesperado:', err)
} finally {
  console.log('6. Limpieza')
  if (created.reviewId) await service.from('staff_reviews').delete().eq('id', created.reviewId)
  if (created.commitmentId) await service.from('team_commitments').delete().eq('id', created.commitmentId)
  if (created.matchId) await service.from('matches').delete().eq('id', created.matchId)
  await service.from('poll_reminders').delete().eq('slot_date', '2000-01-02')
  await service.from('training_sessions').delete().eq('session_date', '2030-01-07')
  if (created.playerId) await service.from('players').delete().eq('id', created.playerId)
  await service.from('training_sessions').delete().eq('session_date', '2000-01-03')
  for (const id of created.users) await service.auth.admin.deleteUser(id)
  console.log(`\nResultado: ${passed} OK, ${failed} fallos`)
  process.exit(failed ? 1 : 0)
}
