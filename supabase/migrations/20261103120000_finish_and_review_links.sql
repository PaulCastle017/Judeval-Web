-- =============================================================================
-- JUDEVAL · Finalizar entrenamientos y partidos, y revisión vinculada al evento
-- (una revisión como máximo por entrenamiento o partido).
-- =============================================================================

-- Finalizar / reabrir (finished_at null = abierto). Usan las políticas de edición existentes.
alter table public.training_sessions
  add column finished_at timestamptz,
  add column finished_by uuid references public.profiles (id) on delete set null;

alter table public.matches
  add column finished_at timestamptz,
  add column finished_by uuid references public.profiles (id) on delete set null;

-- Revisión vinculada a un entrenamiento o a un partido (o a ninguno) -------------------
alter table public.staff_reviews
  add column training_session_id uuid references public.training_sessions (id) on delete set null,
  add column match_id uuid references public.matches (id) on delete set null,
  add constraint staff_reviews_one_event check (training_session_id is null or match_id is null);

create unique index staff_reviews_training_session_key
  on public.staff_reviews (training_session_id) where training_session_id is not null;
create unique index staff_reviews_match_key
  on public.staff_reviews (match_id) where match_id is not null;

-- La revisión debe ser del mismo deporte que el evento al que se vincula
create or replace function public.staff_reviews_event_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sport public.sport_type;
begin
  if new.training_session_id is not null then
    select c.sport into v_sport
      from public.training_sessions s join public.categories c on c.id = s.category_id
     where s.id = new.training_session_id;
  elsif new.match_id is not null then
    select c.sport into v_sport
      from public.matches m join public.categories c on c.id = m.category_id
     where m.id = new.match_id;
  else
    return new;
  end if;
  if v_sport is distinct from new.sport then
    raise exception 'La revisión debe ser del mismo deporte que el evento' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger staff_reviews_event_sport
  before insert or update of training_session_id, match_id, sport on public.staff_reviews
  for each row execute function public.staff_reviews_event_sport();

-- save_review con vínculo opcional al evento (sustituye a la versión anterior).
-- Al editar, el vínculo existente se conserva si no se indica otro.
drop function public.save_review(uuid, public.sport_type, date, text, uuid[]);

create function public.save_review(
  p_id                  uuid,
  p_sport               public.sport_type,
  p_review_date         date,
  p_body                text,
  p_player_ids          uuid[],
  p_training_session_id uuid default null,
  p_match_id            uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.staff_reviews (sport, review_date, body, training_session_id, match_id)
    values (p_sport, p_review_date, p_body, p_training_session_id, p_match_id)
    returning id into v_id;
  else
    update public.staff_reviews
       set review_date = p_review_date,
           body = p_body,
           training_session_id = coalesce(p_training_session_id, training_session_id),
           match_id = coalesce(p_match_id, match_id)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Revisión no encontrada' using errcode = 'P0002';
    end if;
  end if;

  delete from public.review_players
   where review_id = v_id
     and player_id <> all (coalesce(p_player_ids, '{}'));

  insert into public.review_players (review_id, player_id)
  select v_id, pid from unnest(coalesce(p_player_ids, '{}')) as pid
  on conflict do nothing;

  return v_id;
end;
$$;

revoke execute on function public.staff_reviews_event_sport() from public, anon, authenticated;
revoke execute on function public.save_review(uuid, public.sport_type, date, text, uuid[], uuid, uuid) from public, anon;
grant  execute on function public.save_review(uuid, public.sport_type, date, text, uuid[], uuid, uuid) to authenticated;
