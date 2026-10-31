-- Datos iniciales SIN información personal (sí se suben a Git).
-- Los jugadores se cargan aparte con supabase/private/seed_players.sql (excluido de Git).

-- Días ISO: 1 = lunes … 7 = domingo.
-- Lunes y miércoles deducidos de las notas de disponibilidad: revisar desde Admin > Categorías.
insert into public.categories (sport, name, schedule_text, training_weekdays, start_time, end_time, season, sort_order)
values
  ('futsal', 'Cadetes',   'Lunes y miércoles · 17:00–18:30', '{1,3}', '17:00', '18:30', '2026/27', 1),
  ('futsal', 'Juveniles', 'Lunes y miércoles · 18:30–20:00', '{1,3}', '18:30', '20:00', '2026/27', 2),
  ('voley',  'Cadetes',   'Lunes y miércoles · 17:00–18:30', '{1,3}', '17:00', '18:30', '2026/27', 1),
  ('voley',  'Juveniles', 'Lunes y miércoles · 18:30–20:00', '{1,3}', '18:30', '20:00', '2026/27', 2)
on conflict (sport, name) do nothing;

-- «Nuestro estilo Judeval» (Guía de Acompañamiento y Convivencia, sección 5), para cada deporte
insert into public.team_commitments (sport, category_id, title, description, sort_order)
select s.sport, null, t.title, t.description, t.sort_order
from (values ('futsal'::public.sport_type), ('voley'::public.sport_type)) as s(sport)
cross join (values
  ('Nos respetamos',       'Podemos corregirnos y discrepar sin insultar ni humillar.', 1),
  ('Nadie sobra',          'Ayudamos a integrarse a quien llega y no dejamos a nadie aislado a propósito.', 2),
  ('Cada uno aporta',      'El nivel futbolístico no determina cuánto vale alguien dentro del grupo.', 3),
  ('Nos responsabilizamos','Cumplimos los compromisos que asumimos y, cuando fallamos, intentamos reparar el daño.', 4)
) as t(title, description, sort_order)
where not exists (select 1 from public.team_commitments c where c.sport = s.sport);
