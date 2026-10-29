-- Tests de permisos (RLS). Ejecutar con: npx supabase test db
-- Todo ocurre dentro de una transacción que se deshace al final.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(32);

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

select * from finish();
rollback;
