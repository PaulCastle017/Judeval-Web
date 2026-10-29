-- =============================================================================
-- JUDEVAL · Esquema principal
-- Jugadores, notas de acompañamiento, asistencia y revisiones del equipo técnico.
-- La seguridad (RLS y permisos) está en la migración siguiente.
-- =============================================================================

-- Tipos ----------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'coach');
create type public.player_position as enum ('jugador', 'portero');
create type public.player_status as enum ('activo', 'lesionado', 'baja');
create type public.note_type as enum ('observacion', 'conversacion', 'reconocimiento', 'incidencia');
-- Áreas de conversación de la guía (sección 3)
create type public.note_topic as enum ('vida_fuera', 'bienestar', 'experiencia', 'necesidades', 'objetivos', 'grupo', 'otro');
create type public.attendance_status as enum ('presente', 'ausente', 'justificado', 'lesionado');

-- Auditoría genérica -----------------------------------------------------------
-- Rellena updated_at y, cuando hay un usuario autenticado, los campos de autoría.
-- En UPDATE impide modificar created_by / author_id / created_at.
create or replace function public.audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  j   jsonb := to_jsonb(new);
  uid uuid  := auth.uid();
begin
  if j ? 'updated_at' then
    j := j || jsonb_build_object('updated_at', now());
  end if;

  if tg_op = 'INSERT' then
    if uid is not null and j ? 'created_by' then
      j := j || jsonb_build_object('created_by', uid);
    end if;
    if uid is not null and j ? 'author_id' then
      j := j || jsonb_build_object('author_id', uid);
    end if;
  else
    if j ? 'created_by' then j := j || jsonb_build_object('created_by', to_jsonb(old) -> 'created_by'); end if;
    if j ? 'author_id'  then j := j || jsonb_build_object('author_id',  to_jsonb(old) -> 'author_id');  end if;
    if j ? 'created_at' then j := j || jsonb_build_object('created_at', to_jsonb(old) -> 'created_at'); end if;
  end if;

  if uid is not null and j ? 'updated_by' then
    j := j || jsonb_build_object('updated_by', uid);
  end if;
  if uid is not null and j ? 'recorded_by' then
    j := j || jsonb_build_object('recorded_by', uid);
  end if;

  new := jsonb_populate_record(new, j);
  return new;
end;
$$;

-- Perfiles del equipo técnico -------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '' check (char_length(full_name) <= 120),
  role       public.staff_role not null default 'coach',
  -- Una cuenta nueva NO tiene acceso hasta que un admin la activa.
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Crea el perfil al crear el usuario en Auth. Nunca toma rol ni estado de los metadatos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene el email del perfil sincronizado con Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Categorías -----------------------------------------------------------------
create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (char_length(trim(name)) between 1 and 60),
  schedule_text     text not null default '' check (char_length(schedule_text) <= 120),
  -- Días de entrenamiento en formato ISO: 1 = lunes … 7 = domingo
  training_weekdays smallint[] not null default '{}'
                    check (training_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_time        time,
  end_time          time,
  season            text not null default '2026/27' check (char_length(season) <= 20),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time)
);

-- Asignación de entrenadores a categorías (para filtros de la interfaz).
create table public.coach_categories (
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (coach_id, category_id)
);
create index coach_categories_category_idx on public.coach_categories (category_id);

-- Jugadores ------------------------------------------------------------------
create table public.players (
  id                      uuid primary key default gen_random_uuid(),
  category_id             uuid not null references public.categories (id) on delete restrict,
  first_name              text not null check (char_length(trim(first_name)) between 1 and 60),
  last_name               text not null default '' check (char_length(last_name) <= 80),
  -- Alias para distinguir jugadores con el mismo nombre, p. ej. «David (Portero)»
  display_name            text not null default '' check (char_length(display_name) <= 80),
  position                public.player_position not null default 'jugador',
  status                  public.player_status not null default 'activo',
  birth_year              smallint check (birth_year between 1990 and 2035),
  availability_notes      text not null default '' check (char_length(availability_notes) <= 500),
  physical_considerations text not null default '' check (char_length(physical_considerations) <= 1000),
  active                  boolean not null default true,
  created_by              uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index players_category_idx on public.players (category_id);

-- Notas de acompañamiento ------------------------------------------------------
create table public.player_notes (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players (id) on delete cascade,
  author_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  type           public.note_type not null default 'observacion',
  topic          public.note_topic,
  body           text not null check (char_length(trim(body)) between 1 and 4000),
  note_date      date not null default current_date,
  follow_up      boolean not null default false,
  follow_up_done boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index player_notes_player_idx on public.player_notes (player_id, note_date desc);
create index player_notes_pending_idx on public.player_notes (note_date) where follow_up and not follow_up_done;

-- Entrenamientos y asistencia --------------------------------------------------
create table public.training_sessions (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.categories (id) on delete cascade,
  session_date     date not null,
  notes            text not null default '' check (char_length(notes) <= 2000),
  -- Hábito 2.5 de la guía: cerrar con una pregunta breve
  closing_question text not null default '' check (char_length(closing_question) <= 300),
  closing_summary  text not null default '' check (char_length(closing_summary) <= 2000),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (category_id, session_date)
);
create index training_sessions_date_idx on public.training_sessions (session_date desc);

create table public.attendance (
  session_id  uuid not null references public.training_sessions (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  status      public.attendance_status not null,
  comment     text not null default '' check (char_length(comment) <= 300),
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (session_id, player_id)
);
create index attendance_player_idx on public.attendance (player_id);

-- Compromisos de equipo («Nuestro estilo Judeval») ----------------------------
create table public.team_commitments (
  id          uuid primary key default gen_random_uuid(),
  -- null = compromiso de toda la escuela
  category_id uuid references public.categories (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Revisiones del equipo técnico (sección 8 de la guía) -------------------------
create table public.staff_reviews (
  id                 uuid primary key default gen_random_uuid(),
  review_date        date not null default current_date,
  integration        text not null default '' check (char_length(integration) <= 4000),        -- ¿Quién parece más integrado y quién está quedando al margen?
  coherence          text not null default '' check (char_length(coherence) <= 4000),          -- ¿Estamos corrigiendo de forma coherente?
  positive_behaviors text not null default '' check (char_length(positive_behaviors) <= 4000), -- ¿Qué comportamientos positivos hemos reconocido?
  conflicts          text not null default '' check (char_length(conflicts) <= 4000),          -- ¿Algún conflicto que requiera seguimiento?
  privacy            text not null default '' check (char_length(privacy) <= 4000),            -- ¿Respetamos privacidad y protocolos?
  next_change        text not null default '' check (char_length(next_change) <= 4000),        -- ¿Qué pequeño cambio probamos?
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index staff_reviews_date_idx on public.staff_reviews (review_date desc);

create table public.review_actions (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.staff_reviews (id) on delete cascade,
  player_id   uuid references public.players (id) on delete set null,
  description text not null check (char_length(trim(description)) between 1 and 500),
  owner_id    uuid references public.profiles (id) on delete set null,
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index review_actions_review_idx on public.review_actions (review_id);
create index review_actions_open_idx on public.review_actions (due_date) where not done;

-- Triggers de auditoría ---------------------------------------------------------
create trigger audit_profiles          before update           on public.profiles          for each row execute function public.audit_fields();
create trigger audit_categories        before insert or update on public.categories        for each row execute function public.audit_fields();
create trigger audit_players           before insert or update on public.players           for each row execute function public.audit_fields();
create trigger audit_player_notes      before insert or update on public.player_notes      for each row execute function public.audit_fields();
create trigger audit_training_sessions before insert or update on public.training_sessions for each row execute function public.audit_fields();
create trigger audit_attendance        before insert or update on public.attendance        for each row execute function public.audit_fields();
create trigger audit_team_commitments  before insert or update on public.team_commitments  for each row execute function public.audit_fields();
create trigger audit_staff_reviews     before insert or update on public.staff_reviews     for each row execute function public.audit_fields();
create trigger audit_review_actions    before insert or update on public.review_actions    for each row execute function public.audit_fields();

-- Estadísticas de asistencia ----------------------------------------------------
-- security invoker: respeta RLS del usuario que la llama.
-- El porcentaje excluye las sesiones en las que el jugador estaba lesionado.
create or replace function public.player_attendance_stats(
  p_category_id uuid default null,
  p_from        date default null,
  p_to          date default null
)
returns table (
  player_id   uuid,
  total       integer,
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
    a.player_id,
    count(*)::integer,
    count(*) filter (where a.status = 'presente')::integer,
    count(*) filter (where a.status = 'ausente')::integer,
    count(*) filter (where a.status = 'justificado')::integer,
    count(*) filter (where a.status = 'lesionado')::integer,
    round(
      100.0 * count(*) filter (where a.status = 'presente')
      / nullif(count(*) filter (where a.status <> 'lesionado'), 0),
      1
    )
  from public.attendance a
  join public.training_sessions s on s.id = a.session_id
  where (p_category_id is null or s.category_id = p_category_id)
    and (p_from is null or s.session_date >= p_from)
    and (p_to is null or s.session_date <= p_to)
  group by a.player_id;
$$;
