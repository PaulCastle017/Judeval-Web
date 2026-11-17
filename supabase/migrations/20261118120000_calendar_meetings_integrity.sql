-- =============================================================================
-- JUDEVAL · Calendario compartido, Reuniones de la Estructura (actas) e
-- integridad de Entrenamientos y Partidos.
-- Solo añade objetos (tablas, funciones y triggers): no cambia datos existentes.
-- =============================================================================

-- Fecha de hoy en Madrid (la de los entrenadores), no la del servidor (UTC)
create or replace function public.madrid_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- -----------------------------------------------------------------------------
-- Integridad de Entrenamientos y Partidos
-- -----------------------------------------------------------------------------

-- C1 · Solo se convoca a jugadores de la categoría del partido
create or replace function public.match_players_same_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.players p
      join public.matches m on m.category_id = p.category_id
     where p.id = new.player_id and m.id = new.match_id
  ) then
    raise exception 'Solo se puede convocar a jugadores de la categoría del partido' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger match_players_same_category
  before insert on public.match_players
  for each row execute function public.match_players_same_category();

-- C1 · Con convocatoria no se cambia la categoría (los convocados quedarían «fuera» de ella)
create or replace function public.matches_category_locked_with_squad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is distinct from old.category_id
     and exists (select 1 from public.match_players where match_id = old.id) then
    raise exception 'Quita la convocatoria antes de cambiar la categoría del partido' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger matches_category_locked_with_squad
  before update of category_id on public.matches
  for each row execute function public.matches_category_locked_with_squad();

-- C2 · Con lista guardada no se cambia la categoría del entrenamiento
create or replace function public.training_sessions_category_locked_with_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is distinct from old.category_id
     and exists (select 1 from public.attendance where session_id = old.id) then
    raise exception 'Este entrenamiento ya tiene lista: no se puede cambiar de categoría' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger training_sessions_category_locked_with_list
  before update of category_id on public.training_sessions
  for each row execute function public.training_sessions_category_locked_with_list();

-- C3 · No se finaliza un entrenamiento o partido que aún no ha llegado
create or replace function public.finish_not_in_future()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_date date := coalesce((to_jsonb(new) ->> 'match_date')::date, (to_jsonb(new) ->> 'session_date')::date);
begin
  if new.finished_at is not null
     and (tg_op = 'INSERT' or old.finished_at is null)
     and v_date > public.madrid_today() then
    raise exception 'No se puede finalizar antes del día del evento' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger matches_finish_not_in_future
  before insert or update of finished_at on public.matches
  for each row execute function public.finish_not_in_future();
create trigger training_sessions_finish_not_in_future
  before insert or update of finished_at on public.training_sessions
  for each row execute function public.finish_not_in_future();

-- M5 · Día de partido en una sola transacción: asistencia de los convocados y resultado.
-- p_marks: { "<player_id>": "presente" | "ausente" | "justificado" | "lesionado" | null }
-- Voley: p_sets (los sets ganados los calcula el trigger matches_result_by_sport).
create or replace function public.save_match_day(
  p_match_id      uuid,
  p_marks         jsonb,
  p_goals_for     smallint default null,
  p_goals_against smallint default null,
  p_sets          jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  if not exists (select 1 from public.matches where id = p_match_id) then
    raise exception 'Partido no encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_marks, '{}'::jsonb)) <> 'object' then
    raise exception 'Asistencia no válida' using errcode = '22023';
  end if;

  for r in select key, value from jsonb_each(coalesce(p_marks, '{}'::jsonb)) loop
    update public.match_players
       set status = case when jsonb_typeof(r.value) = 'null' then null else (r.value #>> '{}')::public.attendance_status end
     where match_id = p_match_id and player_id = r.key::uuid;
    if not found then
      raise exception 'Solo se puede pasar lista a personas convocadas' using errcode = '23503';
    end if;
  end loop;

  update public.matches
     set goals_for = p_goals_for, goals_against = p_goals_against, sets = p_sets
   where id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Calendario compartido (los dos deportes). Los partidos NO se copian aquí:
-- el calendario los lee de public.matches.
-- -----------------------------------------------------------------------------
create type public.event_kind as enum ('reunion', 'otro');

create table public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 1 and 120),
  kind       public.event_kind not null default 'otro',
  -- null = evento de club (ambos deportes)
  sport      public.sport_type,
  event_date date not null,
  start_time time,
  end_time   time,
  location   text not null default '' check (char_length(location) <= 200),
  notes      text not null default '' check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or (start_time is not null and end_time > start_time))
);
create index calendar_events_date_idx on public.calendar_events (event_date);

-- -----------------------------------------------------------------------------
-- Reuniones de la Estructura (actas)
-- sections: [{ "title": "…", "body": "…" }] (el índice del acta, en orden)
-- -----------------------------------------------------------------------------
create table public.meetings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 1 and 160),
  meeting_date date not null,
  event_id     uuid unique references public.calendar_events (id) on delete set null,
  summary      text not null default '' check (char_length(summary) <= 8000),
  sections     jsonb not null default '[]'::jsonb check (
    case when jsonb_typeof(sections) = 'array' then jsonb_array_length(sections) <= 30 else false end
  ),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meetings_date_idx on public.meetings (meeting_date desc);

create trigger audit_calendar_events before insert or update on public.calendar_events for each row execute function public.audit_fields();
create trigger audit_meetings        before insert or update on public.meetings        for each row execute function public.audit_fields();

-- Permisos y RLS: el staff lee, crea y edita; el autor o un admin borra ------------------
revoke all on public.calendar_events, public.meetings from anon, authenticated;
grant select, insert, update, delete on public.calendar_events, public.meetings to authenticated;

alter table public.calendar_events enable row level security;
alter table public.meetings        enable row level security;

create policy "calendar_events: staff lee"
  on public.calendar_events for select to authenticated
  using ((select public.is_active_staff()));
create policy "calendar_events: staff crea"
  on public.calendar_events for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "calendar_events: staff edita"
  on public.calendar_events for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "calendar_events: autor o admin borra"
  on public.calendar_events for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "meetings: staff lee"
  on public.meetings for select to authenticated
  using ((select public.is_active_staff()));
create policy "meetings: staff crea"
  on public.meetings for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "meetings: staff edita"
  on public.meetings for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "meetings: autor o admin borra"
  on public.meetings for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

-- Permisos de las funciones nuevas
revoke execute on function public.madrid_today() from public, anon;
revoke execute on function public.match_players_same_category() from public, anon, authenticated;
revoke execute on function public.matches_category_locked_with_squad() from public, anon, authenticated;
revoke execute on function public.training_sessions_category_locked_with_list() from public, anon, authenticated;
revoke execute on function public.finish_not_in_future() from public, anon, authenticated;
revoke execute on function public.save_match_day(uuid, jsonb, smallint, smallint, jsonb) from public, anon;
grant  execute on function public.madrid_today() to authenticated;
grant  execute on function public.save_match_day(uuid, jsonb, smallint, smallint, jsonb) to authenticated;
