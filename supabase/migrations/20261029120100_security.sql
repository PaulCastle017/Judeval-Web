-- =============================================================================
-- JUDEVAL · Seguridad: permisos y Row Level Security
-- Regla general: solo el staff ACTIVO (profiles.active = true) puede leer o
-- escribir datos. Los usuarios anónimos no tienen ningún acceso.
-- =============================================================================

-- Funciones auxiliares ------------------------------------------------------------
-- security definer para poder consultar profiles sin recursión de RLS.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active and role = 'admin'
  );
$$;

-- Cualquier entrenador activo puede marcar como resuelto un seguimiento,
-- aunque la nota sea de otro autor (sin poder editar su contenido).
create or replace function public.set_note_follow_up_done(p_note_id uuid, p_done boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.player_notes
     set follow_up_done = p_done
   where id = p_note_id and follow_up;

  if not found then
    raise exception 'Nota no encontrada o sin seguimiento' using errcode = 'P0002';
  end if;
end;
$$;

-- Permisos de ejecución de funciones ---------------------------------------------------
revoke execute on function public.audit_fields()                                from public, anon, authenticated;
revoke execute on function public.handle_new_user()                             from public, anon, authenticated;
revoke execute on function public.handle_user_email_change()                    from public, anon, authenticated;
revoke execute on function public.is_active_staff()                             from public, anon;
revoke execute on function public.is_admin()                                    from public, anon;
revoke execute on function public.set_note_follow_up_done(uuid, boolean)        from public, anon;
revoke execute on function public.player_attendance_stats(uuid, date, date)     from public, anon;
grant  execute on function public.is_active_staff()                             to authenticated;
grant  execute on function public.is_admin()                                    to authenticated;
grant  execute on function public.set_note_follow_up_done(uuid, boolean)        to authenticated;
grant  execute on function public.player_attendance_stats(uuid, date, date)     to authenticated;

-- Permisos de tabla ----------------------------------------------------------------
-- anon: nada. authenticated: lo justo; RLS filtra las filas.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on
  public.categories,
  public.coach_categories,
  public.players,
  public.player_notes,
  public.training_sessions,
  public.attendance,
  public.team_commitments,
  public.staff_reviews,
  public.review_actions
to authenticated;

-- profiles: solo lectura y cambio del propio nombre. Rol y estado solo los
-- cambia la Edge Function admin-users (service_role).
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Activar RLS en todas las tablas ----------------------------------------------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.coach_categories  enable row level security;
alter table public.players           enable row level security;
alter table public.player_notes      enable row level security;
alter table public.training_sessions enable row level security;
alter table public.attendance        enable row level security;
alter table public.team_commitments  enable row level security;
alter table public.staff_reviews     enable row level security;
alter table public.review_actions    enable row level security;

-- profiles -------------------------------------------------------------------------
-- Un usuario inactivo puede ver su propio perfil (para mostrar «pendiente de activación»).
create policy "profiles: staff activo o uno mismo puede leer"
  on public.profiles for select to authenticated
  using ((select public.is_active_staff()) or id = (select auth.uid()));

create policy "profiles: cada uno actualiza su nombre"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_staff()))
  with check (id = (select auth.uid()));

-- categories (gestiona el admin) -----------------------------------------------------
create policy "categories: staff lee"
  on public.categories for select to authenticated
  using ((select public.is_active_staff()));
create policy "categories: admin crea"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "categories: admin edita"
  on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin borra"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- coach_categories (gestiona el admin) -------------------------------------------------
create policy "coach_categories: staff lee"
  on public.coach_categories for select to authenticated
  using ((select public.is_active_staff()));
create policy "coach_categories: admin crea"
  on public.coach_categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "coach_categories: admin borra"
  on public.coach_categories for delete to authenticated
  using ((select public.is_admin()));

-- players: staff lee/crea/edita; solo admin borra (lo normal es dar de baja) -----------
create policy "players: staff lee"
  on public.players for select to authenticated
  using ((select public.is_active_staff()));
create policy "players: staff crea"
  on public.players for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "players: staff edita"
  on public.players for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "players: admin borra"
  on public.players for delete to authenticated
  using ((select public.is_admin()));

-- player_notes: staff lee y crea; solo autor o admin edita/borra ------------------------
create policy "player_notes: staff lee"
  on public.player_notes for select to authenticated
  using ((select public.is_active_staff()));
create policy "player_notes: staff crea como autor"
  on public.player_notes for insert to authenticated
  with check ((select public.is_active_staff()) and author_id = (select auth.uid()));
create policy "player_notes: autor o admin edita"
  on public.player_notes for update to authenticated
  using ((select public.is_active_staff()) and (author_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_staff()));
create policy "player_notes: autor o admin borra"
  on public.player_notes for delete to authenticated
  using ((select public.is_active_staff()) and (author_id = (select auth.uid()) or (select public.is_admin())));

-- training_sessions: staff lee/crea/edita; creador o admin borra -------------------------
create policy "training_sessions: staff lee"
  on public.training_sessions for select to authenticated
  using ((select public.is_active_staff()));
create policy "training_sessions: staff crea"
  on public.training_sessions for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "training_sessions: staff edita"
  on public.training_sessions for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "training_sessions: creador o admin borra"
  on public.training_sessions for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

-- attendance: staff gestiona ----------------------------------------------------------
create policy "attendance: staff lee"
  on public.attendance for select to authenticated
  using ((select public.is_active_staff()));
create policy "attendance: staff crea"
  on public.attendance for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "attendance: staff edita"
  on public.attendance for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "attendance: staff borra"
  on public.attendance for delete to authenticated
  using ((select public.is_active_staff()));

-- team_commitments: staff gestiona -------------------------------------------------------
create policy "team_commitments: staff lee"
  on public.team_commitments for select to authenticated
  using ((select public.is_active_staff()));
create policy "team_commitments: staff crea"
  on public.team_commitments for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "team_commitments: staff edita"
  on public.team_commitments for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "team_commitments: staff borra"
  on public.team_commitments for delete to authenticated
  using ((select public.is_active_staff()));

-- staff_reviews: staff lee/crea/edita; creador o admin borra -------------------------------
create policy "staff_reviews: staff lee"
  on public.staff_reviews for select to authenticated
  using ((select public.is_active_staff()));
create policy "staff_reviews: staff crea"
  on public.staff_reviews for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "staff_reviews: staff edita"
  on public.staff_reviews for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "staff_reviews: creador o admin borra"
  on public.staff_reviews for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));

-- review_actions: staff gestiona ---------------------------------------------------------
create policy "review_actions: staff lee"
  on public.review_actions for select to authenticated
  using ((select public.is_active_staff()));
create policy "review_actions: staff crea"
  on public.review_actions for insert to authenticated
  with check ((select public.is_active_staff()));
create policy "review_actions: staff edita"
  on public.review_actions for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "review_actions: staff borra"
  on public.review_actions for delete to authenticated
  using ((select public.is_active_staff()));
