-- Tests de permisos (RLS). Ejecutar con: npx supabase test db
-- Todo ocurre dentro de una transacción que se deshace al final.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(72);

-- Usuarios de prueba ---------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'coach1@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'coach2@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'inactive@test.local', 'authenticated', 'authenticated');

select is((select count(*)::int from profiles where id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1')),
  4, 'el trigger crea un perfil por usuario');
select is((select active from profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  false, 'los perfiles nuevos nacen inactivos');

update profiles set active = true, role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set active = true where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

-- Datos de prueba
insert into categories (id, name) values ('00000000-0000-0000-0000-00000000ca71', 'Test');
insert into players (id, category_id, first_name) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000ca71', 'Jugador Test');
insert into player_notes (id, player_id, author_id, body, follow_up) values
  ('00000000-0000-0000-0000-00000000b0c2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000c2', 'Nota de coach2', true);

-- ANON ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.players', '42501', null, 'anon no puede leer jugadores');
select throws_ok('select * from public.player_notes', '42501', null, 'anon no puede leer notas');
select throws_ok('select * from public.profiles', '42501', null, 'anon no puede leer perfiles');
select throws_ok($$insert into public.players (category_id, first_name) values ('00000000-0000-0000-0000-00000000ca71', 'X')$$,
  '42501', null, 'anon no puede crear jugadores');
select throws_ok('select * from public.player_attendance_stats()', '42501', null, 'anon no puede ejecutar estadísticas');
reset role;

-- USUARIO INACTIVO -----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from players), 0, 'inactivo: no ve jugadores');
select is((select count(*)::int from player_notes), 0, 'inactivo: no ve notas');
select is((select count(*)::int from profiles), 1, 'inactivo: solo ve su propio perfil');
select throws_ok($$insert into public.players (category_id, first_name) values ('00000000-0000-0000-0000-00000000ca71', 'X')$$,
  '42501', null, 'inactivo: no puede crear jugadores');
select throws_ok($$select public.set_note_follow_up_done('00000000-0000-0000-0000-00000000b0c2')$$,
  '42501', null, 'inactivo: no puede resolver seguimientos');
reset role;

-- COACH 1 -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from players where id = '00000000-0000-0000-0000-0000000000f1'), 1, 'coach: ve jugadores');
select is((select count(*)::int from player_notes where id = '00000000-0000-0000-0000-00000000b0c2'), 1, 'coach: ve notas de otros');
select lives_ok($$insert into public.players (id, category_id, first_name) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000ca71', 'Nuevo')$$, 'coach: puede crear jugadores');
select lives_ok($$insert into public.player_notes (id, player_id, body) values
  ('00000000-0000-0000-0000-00000000b0c1', '00000000-0000-0000-0000-0000000000f1', 'Nota de coach1')$$, 'coach: puede crear notas');
select is((select author_id from player_notes where id = '00000000-0000-0000-0000-00000000b0c1'),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'coach: la nota queda firmada por él');
-- Intento de suplantación: el trigger fuerza author_id = auth.uid()
insert into player_notes (id, player_id, author_id, body) values
  ('00000000-0000-0000-0000-00000000b0c3', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000c2', 'suplantación');
select is((select author_id from player_notes where id = '00000000-0000-0000-0000-00000000b0c3'),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'coach: no puede firmar notas como otro');
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'coach: no puede cambiarse el rol');
select throws_ok($$update public.profiles set active = true where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'coach: no puede activar cuentas');
select lives_ok($$update public.profiles set full_name = 'Coach Uno' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'coach: puede cambiar su nombre');
update player_notes set body = 'editada por coach1' where id = '00000000-0000-0000-0000-00000000b0c2';
delete from player_notes where id = '00000000-0000-0000-0000-00000000b0c2';
delete from players where id = '00000000-0000-0000-0000-0000000000f1';
select throws_ok($$insert into public.categories (name) values ('Hackers')$$, '42501', null, 'coach: no puede crear categorías');
select lives_ok($$select public.set_note_follow_up_done('00000000-0000-0000-0000-00000000b0c2')$$,
  'coach: puede resolver un seguimiento ajeno');
select lives_ok($$
  with s as (insert into public.training_sessions (category_id, session_date)
             values ('00000000-0000-0000-0000-00000000ca71', current_date) returning id)
  insert into public.attendance (session_id, player_id, status)
  select id, '00000000-0000-0000-0000-0000000000f1', 'presente' from s$$, 'coach: puede pasar lista');
select is((select presente from player_attendance_stats() where player_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'coach: estadísticas de asistencia');
reset role;

select is((select body from player_notes where id = '00000000-0000-0000-0000-00000000b0c2'),
  'Nota de coach2', 'coach no pudo editar la nota de otro');
select is((select count(*)::int from players where id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'coach no pudo borrar jugadores');
select is((select role::text from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'coach', 'el rol del coach no cambió');
select is((select follow_up_done from player_notes where id = '00000000-0000-0000-0000-00000000b0c2'),
  true, 'el seguimiento quedó resuelto');

-- ADMIN ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.categories (name) values ('Infantiles')$$, 'admin: puede crear categorías');
delete from player_notes where id = '00000000-0000-0000-0000-00000000b0c2';
delete from players where id = '00000000-0000-0000-0000-0000000000f2';
reset role;

select is((select count(*)::int from player_notes where id = '00000000-0000-0000-0000-00000000b0c2'),
  0, 'admin pudo borrar la nota de otro');
select is((select count(*)::int from players where id = '00000000-0000-0000-0000-0000000000f2'),
  0, 'admin pudo borrar un jugador');

-- DEPORTES, REVISIONES LIBRES, NOTICIAS Y ENTRENAMIENTOS ---------------------------
insert into categories (id, name, sport) values ('00000000-0000-0000-0000-00000000ca72', 'Test', 'voley');
insert into players (id, category_id, first_name) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000ca72', 'Jugadora Voley');

select throws_ok($$insert into public.team_commitments (sport, category_id, title)
  values ('voley', '00000000-0000-0000-0000-00000000ca71', 'Mal')$$,
  '23503', null, 'un compromiso no puede apuntar a una categoría de otro deporte');
select lives_ok($$insert into public.team_commitments (sport, category_id, title, status)
  values ('futsal', '00000000-0000-0000-0000-00000000ca71', 'Bien', 'cumplido')$$,
  'compromiso con categoría del mismo deporte y estado');
select throws_ok($$insert into public.categories (name, sport) values ('Test', 'voley')$$,
  '23505', null, 'el nombre de categoría es único dentro de cada deporte');

set local role anon;
select throws_ok('select * from public.review_players', '42501', null, 'anon no puede leer etiquetas de revisiones');
select throws_ok($$select * from public.player_last_news('futsal')$$, '42501', null, 'anon no puede consultar noticias');
select throws_ok($$select public.save_review(null, 'futsal', current_date, 'x', '{}')$$, '42501', null, 'anon no puede guardar revisiones');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.player_last_news('futsal')), 0, 'inactivo: no ve noticias de jugadores');
select throws_ok($$select public.save_review(null, 'futsal', current_date, 'x', '{}')$$, '42501', null, 'inactivo: no puede guardar revisiones');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.save_review(null, 'futsal', '2026-10-31', 'Revisión libre',
  array['00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1']::uuid[])$$,
  'coach: guarda revisión libre con jugador etiquetado (duplicados ignorados)');
select is((select count(*)::int from review_players rp join staff_reviews r on r.id = rp.review_id where r.body = 'Revisión libre'),
  1, 'coach: la etiqueta queda guardada una sola vez');
select lives_ok($$select public.save_review((select id from public.staff_reviews where body = 'Revisión libre'),
  'futsal', '2026-10-31', 'Revisión editada', '{}')$$, 'coach: edita la revisión y quita etiquetas');
select is((select count(*)::int from review_players rp join staff_reviews r on r.id = rp.review_id where r.body = 'Revisión editada'),
  0, 'coach: las etiquetas quitadas se borran');
select throws_ok($$select public.save_review(null, 'futsal', current_date, 'Atómica',
  array['00000000-0000-0000-0000-00000000dead']::uuid[])$$, '23503', null, 'save_review: un jugador inexistente aborta la operación');
select is((select count(*)::int from staff_reviews where body = 'Atómica'), 0, 'save_review es atómica: no queda revisión a medias');
select is((select count(*)::int from public.player_last_news('futsal') where player_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'coach: las noticias de fútbol incluyen a sus jugadores');
select is((select count(*)::int from public.player_last_news('futsal') where player_id = '00000000-0000-0000-0000-0000000000f3'),
  0, 'las noticias de fútbol no incluyen jugadores de voley');
select isnt((select last_news_date from public.player_last_news('futsal') where player_id = '00000000-0000-0000-0000-0000000000f1'),
  null, 'noticias: fecha de la última nota del jugador');
select throws_ok($$insert into public.training_sessions (category_id, session_date, exercises)
  values ('00000000-0000-0000-0000-00000000ca71', '2030-01-01', '{"a": 1}')$$, '23514', null, 'exercises debe ser una lista');
select lives_ok($$insert into public.training_sessions (category_id, session_date, start_time, duration_minutes, exercises)
  values ('00000000-0000-0000-0000-00000000ca71', '2030-01-02', '17:00', 90, '[{"name": "Rondo", "minutes": 15, "notes": ""}]')$$,
  'coach: crea un entrenamiento planificado con ejercicios');
reset role;

-- PARTIDOS Y ENCUESTA DE WHATSAPP -------------------------------------------------
insert into matches (id, category_id, match_date, opponent) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000ca71', '2030-02-01', 'Rival');

set local role anon;
select throws_ok('select * from public.matches', '42501', null, 'anon no puede leer partidos');
select throws_ok('select * from public.poll_reminders', '42501', null, 'anon no puede leer encuestas');
select throws_ok($$select public.set_match_squad('00000000-0000-0000-0000-0000000000e1', '{}')$$, '42501', null, 'anon no puede convocar');
select throws_ok('select * from public.player_match_stats()', '42501', null, 'anon no puede ver estadísticas de partidos');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from matches), 0, 'inactivo: no ve partidos');
select throws_ok($$insert into public.poll_reminders (category_id, slot_date) values ('00000000-0000-0000-0000-00000000ca71', '2026-11-03')$$,
  '42501', null, 'inactivo: no puede marcar encuestas');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_match_squad('00000000-0000-0000-0000-0000000000e1', array['00000000-0000-0000-0000-0000000000f1']::uuid[])$$,
  'coach: hace la convocatoria');
select is((select count(*)::int from match_players where match_id = '00000000-0000-0000-0000-0000000000e1'), 1, 'coach: queda una persona convocada');
select lives_ok($$update public.match_players set status = 'presente'
  where match_id = '00000000-0000-0000-0000-0000000000e1' and player_id = '00000000-0000-0000-0000-0000000000f1'$$, 'coach: pasa lista en el partido');
select lives_ok($$select public.set_match_squad('00000000-0000-0000-0000-0000000000e1', array['00000000-0000-0000-0000-0000000000f1']::uuid[])$$,
  'coach: vuelve a guardar la convocatoria');
select is((select status::text from match_players where match_id = '00000000-0000-0000-0000-0000000000e1'), 'presente',
  'set_match_squad conserva la asistencia de quien sigue convocado');
select is((select presente from public.player_match_stats('00000000-0000-0000-0000-00000000ca71') where player_id = '00000000-0000-0000-0000-0000000000f1'),
  1, 'estadísticas de partidos');
select throws_ok($$update public.matches set goals_for = 3 where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '23514', null, 'el resultado no puede quedar a medias');
select lives_ok($$update public.matches set goals_for = 3, goals_against = 1 where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'coach: guarda el resultado');
select throws_ok($$select public.set_match_squad('00000000-0000-0000-0000-00000000dead', '{}')$$, 'P0002', null, 'convocatoria de un partido inexistente');
select lives_ok($$insert into public.poll_reminders (category_id, slot_date) values ('00000000-0000-0000-0000-00000000ca71', '2026-11-03')$$,
  'coach: marca la encuesta del martes como enviada');
select throws_ok($$insert into public.poll_reminders (category_id, slot_date) values ('00000000-0000-0000-0000-00000000ca71', '2026-11-03')$$,
  '23505', null, 'la misma encuesta no se marca dos veces');
select throws_ok($$insert into public.poll_reminders (category_id, slot_date) values ('00000000-0000-0000-0000-00000000ca71', '2026-11-04')$$,
  '23514', null, 'solo hay turnos de encuesta en martes y domingo');
select is((select created_by from poll_reminders where slot_date = '2026-11-03'), '00000000-0000-0000-0000-0000000000c1'::uuid,
  'la encuesta queda firmada por quien la marcó');
select lives_ok($$select public.set_match_squad('00000000-0000-0000-0000-0000000000e1', '{}')$$, 'coach: vacía la convocatoria');
select is((select count(*)::int from match_players where match_id = '00000000-0000-0000-0000-0000000000e1'), 0, 'la convocatoria queda vacía');
reset role;

select * from finish();
rollback;
