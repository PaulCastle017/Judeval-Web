-- =============================================================================
-- JUDEVAL · Partidos (con convocatoria, asistencia y resultado) y recordatorio
-- de la encuesta de asistencia por WhatsApp.
-- Solo añade objetos: no modifica ni borra nada existente.
-- =============================================================================

create type public.match_venue as enum ('local', 'visitante');

-- Partidos ------------------------------------------------------------------------
-- El deporte lo hereda de la categoría.
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories (id) on delete cascade,
  match_date    date not null,
  start_time    time,
  opponent      text not null check (char_length(trim(opponent)) between 1 and 120),
  location      text not null default '' check (char_length(location) <= 200),
  venue         public.match_venue not null default 'local',
  competition   text not null default '' check (char_length(competition) <= 120),
  notes         text not null default '' check (char_length(notes) <= 2000),
  goals_for     smallint check (goals_for between 0 and 99),
  goals_against smallint check (goals_against between 0 and 99),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- El resultado va completo o no va
  check ((goals_for is null) = (goals_against is null))
);
create index matches_category_date_idx on public.matches (category_id, match_date);

-- Convocatoria (existe la fila = convocado) y asistencia al partido
create table public.match_players (
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  status      public.attendance_status,
  comment     text not null default '' check (char_length(comment) <= 300),
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_players_player_idx on public.match_players (player_id);

-- Encuesta de WhatsApp: una fila = encuesta enviada para esa categoría en ese turno
-- (slot_date = martes o domingo del turno).
create table public.poll_reminders (
  category_id uuid not null references public.categories (id) on delete cascade,
  slot_date   date not null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (category_id, slot_date),
  check (extract(isodow from slot_date) in (2, 7))
);

create trigger audit_matches        before insert or update on public.matches        for each row execute function public.audit_fields();
create trigger audit_match_players  before insert or update on public.match_players  for each row execute function public.audit_fields();
create trigger audit_poll_reminders before insert or update on public.poll_reminders for each row execute function public.audit_fields();

-- Permisos y RLS ----------------------------------------------------------------
revoke all on public.matches, public.match_players, public.poll_reminders from anon, authenticated;
grant select, insert, update, delete on public.matches, public.match_players to authenticated;
grant select, insert, delete on public.poll_reminders to authenticated;

alter table public.matches        enable row level security;
alter table public.match_players  enable row level security;
alter table public.poll_reminders enable row level security;

create policy "matches: staff lee"
  on public.matches for select to authenticated
  using ((select public.is_active_staff()));
create policy "matches: staff crea"
  on public.matches for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "matches: staff edita"
  on public.matches for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "matches: creador o admin borra"
  on public.matches for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "match_players: staff lee"
  on public.match_players for select to authenticated
  using ((select public.is_active_staff()));
create policy "match_players: staff convoca"
  on public.match_players for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "match_players: staff pasa lista"
  on public.match_players for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "match_players: staff desconvoca"
  on public.match_players for delete to authenticated
  using ((select public.is_active_staff()));

create policy "poll_reminders: staff lee"
  on public.poll_reminders for select to authenticated
  using ((select public.is_active_staff()));
create policy "poll_reminders: staff marca"
  on public.poll_reminders for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "poll_reminders: staff deshace"
  on public.poll_reminders for delete to authenticated
  using ((select public.is_active_staff()));

-- Convocatoria en una sola transacción. Conserva la asistencia de quien sigue convocado.
create or replace function public.set_match_squad(p_match_id uuid, p_player_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.matches where id = p_match_id) then
    raise exception 'Partido no encontrado' using errcode = 'P0002';
  end if;

  delete from public.match_players
   where match_id = p_match_id
     and player_id <> all (coalesce(p_player_ids, '{}'));

  insert into public.match_players (match_id, player_id)
  select p_match_id, pid from unnest(coalesce(p_player_ids, '{}')) as pid
  on conflict do nothing;
end;
$$;

-- Estadísticas de partidos por jugador (security invoker: respeta RLS).
-- El porcentaje excluye los partidos en los que estaba lesionado y los no marcados.
create or replace function public.player_match_stats(
  p_category_id uuid default null,
  p_from        date default null,
  p_to          date default null
)
returns table (
  player_id   uuid,
  called_up   integer,
  presente    integer,
  ausente     integer,
  justificado integer,
  lesionado   integer,
  rate        numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    mp.player_id,
    count(*)::integer,
    count(*) filter (where mp.status = 'presente')::integer,
    count(*) filter (where mp.status = 'ausente')::integer,
    count(*) filter (where mp.status = 'justificado')::integer,
    count(*) filter (where mp.status = 'lesionado')::integer,
    round(
      100.0 * count(*) filter (where mp.status = 'presente')
      / nullif(count(*) filter (where mp.status is not null and mp.status <> 'lesionado'), 0),
      1
    )
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where (p_category_id is null or m.category_id = p_category_id)
    and (p_from is null or m.match_date >= p_from)
    and (p_to is null or m.match_date <= p_to)
  group by mp.player_id;
$$;

revoke execute on function public.set_match_squad(uuid, uuid[]) from public, anon;
revoke execute on function public.player_match_stats(uuid, date, date) from public, anon;
grant  execute on function public.set_match_squad(uuid, uuid[]) to authenticated;
grant  execute on function public.player_match_stats(uuid, date, date) to authenticated;
