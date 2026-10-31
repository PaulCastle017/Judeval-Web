-- =============================================================================
-- JUDEVAL · Dos deportes (fútbol sala / voley), entrenamientos planificados,
-- revisiones en texto libre y estados en los compromisos.
--
-- El deporte vive en categories.sport; jugadores, sesiones, asistencia y notas
-- lo heredan de su categoría. Solo compromisos y revisiones (que pueden no
-- tener categoría) llevan columna propia.
-- =============================================================================

create type public.sport_type as enum ('futsal', 'voley');
create type public.commitment_status as enum ('pendiente', 'cumplido', 'no_conseguido');

-- Categorías --------------------------------------------------------------------
alter table public.categories add column sport public.sport_type not null default 'futsal';
alter table public.categories drop constraint categories_name_key;
alter table public.categories add constraint categories_sport_name_key unique (sport, name);
-- Permite claves foráneas compuestas (category_id, sport)
alter table public.categories add constraint categories_id_sport_key unique (id, sport);

-- Voley: mismas categorías y horarios que fútbol sala (editables después en Admin).
-- En una base vacía (entorno local) no inserta nada: lo hace seed.sql.
insert into public.categories (sport, name, schedule_text, training_weekdays, start_time, end_time, season, sort_order)
select 'voley', name, schedule_text, training_weekdays, start_time, end_time, season, sort_order
from public.categories
where sport = 'futsal' and name in ('Cadetes', 'Juveniles')
on conflict (sport, name) do nothing;

-- Entrenamientos planificados (reutilizan training_sessions) -----------------------
alter table public.training_sessions
  add column start_time time,
  add column duration_minutes smallint check (duration_minutes between 15 and 300),
  -- [{ "name": "...", "minutes": 10, "notes": "..." }]
  add column exercises jsonb not null default '[]'::jsonb check (
    case when jsonb_typeof(exercises) = 'array' then jsonb_array_length(exercises) <= 30 else false end
  );

-- Compromisos: deporte y estado ---------------------------------------------------------
alter table public.team_commitments
  add column sport public.sport_type not null default 'futsal',
  add column status public.commitment_status not null default 'pendiente';

update public.team_commitments t
   set sport = c.sport
  from public.categories c
 where c.id = t.category_id;

-- La categoría (si la hay) debe ser del mismo deporte que el compromiso.
alter table public.team_commitments drop constraint team_commitments_category_id_fkey;
alter table public.team_commitments
  add constraint team_commitments_category_sport_fkey
  foreign key (category_id, sport) references public.categories (id, sport)
  on delete cascade on update cascade;

-- «Nuestro estilo Judeval» también para voley
insert into public.team_commitments (category_id, sport, title, description, sort_order, active)
select null, 'voley', title, description, sort_order, active
from public.team_commitments
where sport = 'futsal' and category_id is null
  and not exists (select 1 from public.team_commitments where sport = 'voley');

-- Revisiones en texto libre ---------------------------------------------------------
alter table public.staff_reviews
  add column sport public.sport_type not null default 'futsal',
  add column body text not null default '' check (char_length(body) <= 8000);

-- Conserva las respuestas del formato anterior, con su pregunta como encabezado.
update public.staff_reviews
   set body = left(concat_ws(E'\n\n',
     case when trim(integration) <> '' then '¿Quién parece más integrado y quién está quedando al margen?' || E'\n' || integration end,
     case when trim(coherence) <> '' then '¿Estamos corrigiendo de forma coherente entre entrenadores?' || E'\n' || coherence end,
     case when trim(positive_behaviors) <> '' then '¿Qué comportamientos positivos hemos reconocido últimamente?' || E'\n' || positive_behaviors end,
     case when trim(conflicts) <> '' then '¿Hay algún conflicto que requiera seguimiento o coordinación?' || E'\n' || conflicts end,
     case when trim(privacy) <> '' then '¿Estamos respetando la privacidad y los protocolos de protección?' || E'\n' || privacy end,
     case when trim(next_change) <> '' then '¿Qué pequeño cambio podemos probar durante las próximas dos semanas?' || E'\n' || next_change end
   ), 8000);

alter table public.staff_reviews
  drop column integration,
  drop column coherence,
  drop column positive_behaviors,
  drop column conflicts,
  drop column privacy,
  drop column next_change;

create index staff_reviews_sport_date_idx on public.staff_reviews (sport, review_date desc);

-- Jugadores etiquetados en una revisión
create table public.review_players (
  review_id  uuid not null references public.staff_reviews (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, player_id)
);
create index review_players_player_idx on public.review_players (player_id);

revoke all on public.review_players from anon, authenticated;
grant select, insert, delete on public.review_players to authenticated;
alter table public.review_players enable row level security;

create policy "review_players: staff lee"
  on public.review_players for select to authenticated
  using ((select public.is_active_staff()));
create policy "review_players: staff etiqueta"
  on public.review_players for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "review_players: staff desetiqueta"
  on public.review_players for delete to authenticated
  using ((select public.is_active_staff()));

-- Guarda revisión + etiquetas en una sola transacción.
-- security invoker: aplica las mismas políticas RLS que una escritura normal.
create or replace function public.save_review(
  p_id          uuid,
  p_sport       public.sport_type,
  p_review_date date,
  p_body        text,
  p_player_ids  uuid[]
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
    insert into public.staff_reviews (sport, review_date, body)
    values (p_sport, p_review_date, p_body)
    returning id into v_id;
  else
    update public.staff_reviews
       set review_date = p_review_date, body = p_body
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

-- «Sin noticias individuales»: fecha de la última nota (creada o editada) de cada jugador.
create or replace function public.player_last_news(p_sport public.sport_type)
returns table (player_id uuid, last_news_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id,
         max(greatest(n.note_date, (n.updated_at at time zone 'Europe/Madrid')::date))
  from public.players p
  join public.categories c on c.id = p.category_id
  left join public.player_notes n on n.player_id = p.id
  where c.sport = p_sport and p.active and p.status <> 'baja'
  group by p.id;
$$;

revoke execute on function public.save_review(uuid, public.sport_type, date, text, uuid[]) from public, anon;
revoke execute on function public.player_last_news(public.sport_type) from public, anon;
grant  execute on function public.save_review(uuid, public.sport_type, date, text, uuid[]) to authenticated;
grant  execute on function public.player_last_news(public.sport_type) to authenticated;
