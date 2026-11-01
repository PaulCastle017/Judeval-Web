-- =============================================================================
-- JUDEVAL · Resultado por sets en voley, alineación en el campo y biblioteca
-- de ejercicios. Solo añade objetos; los datos existentes siguen siendo válidos.
-- =============================================================================

-- Resultado de voley por sets -------------------------------------------------------
-- Reglamento al mejor de 5: entre 3 y 5 sets, sin empates, y el partido termina
-- justo cuando un equipo gana su 3.er set (3-0, 3-1 o 3-2).
create or replace function public.volley_sets_valid(p_sets jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  n    integer;
  won  integer := 0;
  lost integer := 0;
  s    jsonb;
  f    integer;
  a    integer;
begin
  if p_sets is null then
    return true;
  end if;
  if jsonb_typeof(p_sets) <> 'array' then
    return false;
  end if;
  n := jsonb_array_length(p_sets);
  if n < 3 or n > 5 then
    return false;
  end if;
  for i in 0 .. n - 1 loop
    s := p_sets -> i;
    if jsonb_typeof(s) <> 'object'
       or coalesce(s ->> 'for', '') !~ '^[0-9]{1,2}$'
       or coalesce(s ->> 'against', '') !~ '^[0-9]{1,2}$' then
      return false;
    end if;
    f := (s ->> 'for')::integer;
    a := (s ->> 'against')::integer;
    if f = a or won = 3 or lost = 3 then
      return false; -- set empatado o set jugado con el partido ya terminado
    end if;
    if f > a then won := won + 1; else lost := lost + 1; end if;
  end loop;
  return won = 3 or lost = 3;
end;
$$;

alter table public.matches
  add column sets jsonb check (public.volley_sets_valid(sets));

-- En voley el resultado se registra por sets y los sets ganados se copian a
-- goals_for / goals_against (así el resto de la app los muestra sin cambios).
-- En fútbol sala no se aceptan sets.
create or replace function public.matches_result_by_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sport public.sport_type;
  won     integer := 0;
  lost    integer := 0;
begin
  select sport into v_sport from public.categories where id = new.category_id;

  if v_sport = 'voley' then
    if new.sets is not null then
      if public.volley_sets_valid(new.sets) then
        for i in 0 .. jsonb_array_length(new.sets) - 1 loop
          if (new.sets -> i ->> 'for')::integer > (new.sets -> i ->> 'against')::integer then
            won := won + 1;
          else
            lost := lost + 1;
          end if;
        end loop;
        new.goals_for := won;
        new.goals_against := lost;
      end if; -- si no es válido, lo rechaza el CHECK
    elsif tg_op = 'INSERT'
       or new.goals_for is distinct from old.goals_for
       or new.goals_against is distinct from old.goals_against then
      -- (los partidos anteriores con marcador numérico se pueden seguir editando)
      if new.goals_for is not null then
        raise exception 'En voley el resultado se registra por sets' using errcode = '23514';
      end if;
    end if;
  elsif new.sets is not null then
    raise exception 'Los sets solo se usan en voley' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger matches_result_by_sport
  before insert or update on public.matches
  for each row execute function public.matches_result_by_sport();

-- Alineación: puesto de cada titular ------------------------------------------------
alter table public.match_players
  add column lineup_slot text check (
    lineup_slot in ('portero', 'cierre', 'ala_izq', 'ala_der', 'pivot', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6')
  );
create unique index match_players_lineup_slot_key
  on public.match_players (match_id, lineup_slot) where lineup_slot is not null;

-- El puesto debe ser del deporte del partido
create or replace function public.match_players_slot_by_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sport public.sport_type;
begin
  if new.lineup_slot is null then
    return new;
  end if;
  select c.sport into v_sport
    from public.matches m join public.categories c on c.id = m.category_id
   where m.id = new.match_id;
  if (v_sport = 'voley') <> (new.lineup_slot like 'p_') then
    raise exception 'Puesto % no válido para este deporte', new.lineup_slot using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger match_players_slot_by_sport
  before insert or update of lineup_slot on public.match_players
  for each row execute function public.match_players_slot_by_sport();

-- Guarda la alineación completa en una transacción: { "pivot": "<player_id>", ... }
create or replace function public.set_match_lineup(p_match_id uuid, p_slots jsonb)
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
  if jsonb_typeof(p_slots) <> 'object' then
    raise exception 'Alineación no válida' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct value) from jsonb_each_text(p_slots)) then
    raise exception 'Una persona no puede ocupar dos puestos' using errcode = '23505';
  end if;

  update public.match_players
     set lineup_slot = null
   where match_id = p_match_id and lineup_slot is not null;

  for r in select key, value from jsonb_each_text(p_slots) loop
    update public.match_players
       set lineup_slot = r.key
     where match_id = p_match_id and player_id = r.value::uuid;
    if not found then
      raise exception 'Solo se puede alinear a personas convocadas' using errcode = '23503';
    end if;
  end loop;
end;
$$;

-- Biblioteca de ejercicios (compartida por deporte) ----------------------------------
create table public.exercises (
  id              uuid primary key default gen_random_uuid(),
  sport           public.sport_type not null,
  title           text not null check (char_length(trim(title)) between 1 and 120),
  -- Solo enlaces https de YouTube o Instagram
  url             text check (url is null or url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com)/'),
  description     text not null default '' check (char_length(description) <= 4000),
  tags            text[] not null default '{}'
                  check (tags <@ array['calentamiento', 'tecnica', 'tactica', 'fisico', 'juego_reducido', 'vuelta_calma']::text[]),
  default_minutes smallint check (default_minutes between 1 and 300),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Enlace o texto explicativo (o ambos)
  check (url is not null or char_length(trim(description)) > 0)
);
create index exercises_sport_title_idx on public.exercises (sport, title);

create trigger audit_exercises
  before insert or update on public.exercises
  for each row execute function public.audit_fields();

revoke all on public.exercises from anon, authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
alter table public.exercises enable row level security;

create policy "exercises: staff lee"
  on public.exercises for select to authenticated
  using ((select public.is_active_staff()));
create policy "exercises: staff crea"
  on public.exercises for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "exercises: autor o admin edita"
  on public.exercises for update to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_staff()));
create policy "exercises: autor o admin borra"
  on public.exercises for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

-- Permisos de las funciones nuevas
revoke execute on function public.volley_sets_valid(jsonb) from public, anon;
revoke execute on function public.matches_result_by_sport() from public, anon, authenticated;
revoke execute on function public.match_players_slot_by_sport() from public, anon, authenticated;
revoke execute on function public.set_match_lineup(uuid, jsonb) from public, anon;
grant  execute on function public.volley_sets_valid(jsonb) to authenticated;
grant  execute on function public.set_match_lineup(uuid, jsonb) to authenticated;
