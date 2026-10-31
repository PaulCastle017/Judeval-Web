# JUDEVAL · App de entrenadores

Aplicación web privada para el equipo técnico de la Escuela Deportiva JUDEVAL (**fútbol sala ⚽ y voley 🏐**).
Basada en la guía «Acompañar, unir y hacer equipo»:

- **Deporte activo**: tras iniciar sesión se elige deporte y toda la app muestra solo sus datos. Se cambia desde la pastilla del menú, «Más» o «Mi perfil».
- **Inicio**: entrenamientos programados (próximos 14 días), seguimientos pendientes (con ➕ para crear uno) y jugadores «sin noticias individuales» en X días (X lo configura cada entrenador).
- **Jugadores**: ficha por categoría con disponibilidad, consideraciones físicas, asistencia, revisiones en las que se le menciona y cronología de notas
  (observaciones, conversaciones individuales, reconocimientos e incidencias) con seguimientos pendientes.
- **Entrenamientos**: planificación de cada sesión (fecha, hora, duración, categoría, notas y ejercicios opcionales). Sobre esa misma sesión se pasa lista.
- **Asistencia**: pasar lista desde el móvil (presente, ausente, justificado o lesionado), pregunta de cierre e historial con porcentajes.
- **Revisiones**: texto libre con lo que se ha visto o se quiere resaltar, con jugadores etiquetados opcionalmente.
- **Compromisos**: «Nuestro estilo Judeval», con estado (Objetivo Cumplido, Pendiente o No Conseguido) y filtros.
- **Guía rápida**: resumen de la guía.
- **Administración**: altas y bajas de entrenadores, roles, contraseñas y categorías.

Todo funciona con planes **gratuitos**: Supabase Free, Vercel Hobby y GitHub. No hace falta tarjeta.

---

## Arquitectura

```
Navegador (móvil / PC)
   │ HTTPS
   ▼
Vercel Hobby ── web estática (React + Vite + TypeScript)
   │ supabase-js con la clave PÚBLICA (anon/publishable)
   ▼
Supabase Free
   ├─ Auth: email + contraseña (registro público desactivado)
   ├─ PostgreSQL con Row Level Security en todas las tablas
   └─ Edge Function admin-users: gestión de cuentas (usa service_role SOLO en el servidor)
```

- No hay servidor propio: la web habla directamente con Postgres, y las **políticas RLS** deciden qué puede hacer cada usuario.
- Solo el *staff activo* puede ver o tocar datos. Los anónimos y las cuentas desactivadas no ven nada.
- Los entrenadores pueden leer y escribir jugadores, notas, asistencia, revisiones y compromisos.
- Solo el autor de una nota, o un admin, puede editarla o borrarla.
- Solo un admin puede borrar jugadores, gestionar categorías y gestionar cuentas.
- Nadie puede cambiarse su propio rol, porque los permisos de columna lo impiden.
- Las cuentas las crea un administrador desde la app con una contraseña temporal. No se usan invitaciones por email porque el correo integrado del plan gratuito de Supabase solo envía a miembros del proyecto.

```
src/
  auth/         sesión, perfil y guards (RequireAuth / RequireAdmin)
  components/   layout y componentes comunes (errores, carga, campos…)
  features/     una carpeta por sección: dashboard, players, attendance, reviews, commitments, guide, admin, profile
  lib/          cliente Supabase, validación (zod), errores, formatos y consultas comunes
  types/        tipos generados desde la base de datos
supabase/
  migrations/   esquema + seguridad (RLS)
  functions/    Edge Function admin-users
  tests/        tests de permisos (pgTAP)
  seed.sql      categorías y compromisos (sin datos personales)
  private/      seed con los jugadores reales: EXCLUIDO DE GIT
scripts/
  smoke-test.mjs  prueba end-to-end contra el Supabase local
```

---

## Seguridad y privacidad (léelo)

- **Nunca** subas a GitHub ni pongas en Vercel la clave `service_role` / `secret`, la contraseña de la base de datos ni tokens personales.
- En la web solo van `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Ambas son públicas por diseño.
- `.gitignore` excluye `.env*` (salvo `.env.example`), `analisis_jugadores.txt`, el PDF de la guía y `supabase/private/`. **Antes del primer commit comprueba `git status`** (ver más abajo).
- La app guarda **datos personales de menores**, algunos de salud. Recomendaciones:
  - El club es el responsable del tratamiento. Conviene que la dirección conozca qué se guarda y que las familias estén informadas según los protocolos de JUDEVAL.
  - Crea cuentas solo para quien las necesite y **desactívalas** cuando alguien deje el club (Admin → Desactivar).
  - Sigue la propia guía: describir conductas, no etiquetas, y no anotar diagnósticos no confirmados. Las observaciones iniciales se importaron tal cual del TXT; revisadlas y editadlas desde la ficha de cada jugador.
  - Crea el proyecto de Supabase en una **región de la UE**.

---

## 1. Desarrollo local

Necesitas **Node.js 20+** y **Docker Desktop** (para el Supabase local).

```bash
npm install
npm run db:start            # arranca Supabase en Docker; aplica migraciones y seeds
npx supabase status         # muestra la URL y las claves LOCALES
```

Crea `.env.local` (no se sube a Git) a partir de `.env.example` con los valores locales `API_URL` y `ANON_KEY`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY de supabase status>
```

Crea tu usuario administrador local:

1. Abre Supabase Studio en http://127.0.0.1:54323 → Authentication → Users → **Add user → Create new user**, con email, contraseña y «Auto Confirm User».
2. En Studio → SQL Editor, ejecuta:

   ```sql
   update public.profiles set role = 'admin', active = true, full_name = 'Tu Nombre'
   where email = 'tu@email.com';
   ```

3. Arranca la web con `npm run dev` y abre http://localhost:5173.

Comandos útiles:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Web en modo desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint / TypeScript / tests unitarios de validación |
| `npm run db:reset` | Recrea la BD local desde cero (migraciones + seeds) |
| `npm run db:test` | Tests de permisos RLS (pgTAP) |
| `npm run smoke` | Prueba end-to-end de API, permisos y Edge Function (solo local) |
| `npm run db:types` | Regenera `src/types/database.ts` tras cambiar el esquema |
| `npm run db:stop` | Para el Supabase local |

---

## 2. Supabase en la nube (plan Free)

1. Crea una cuenta en https://supabase.com (puedes entrar con GitHub). Pulsa **New project**:
   - Nombre: `judeval`. Plan: **Free**.
   - **Region**: Central EU (Frankfurt) o West EU (Paris).
   - **Database password**: genera una fuerte y guárdala en un gestor de contraseñas. No la pongas en ningún archivo del proyecto.
2. **Authentication → Sign In / Providers**:
   - Desactiva **«Allow new users to sign up»**. Así nadie puede registrarse por su cuenta.
   - Deja activado el proveedor **Email**.
   - Si aparece la opción, exige contraseñas de 8 caracteres como mínimo, con letras y números.
3. **Aplicar las migraciones** (crea las tablas y la seguridad). Desde la carpeta del proyecto:

   ```bash
   npx supabase login                               # abre el navegador para autorizar el CLI
   npx supabase link --project-ref <REF>            # <REF> = el id de la URL del proyecto; pide la contraseña de la BD
   npx supabase db push                             # aplica supabase/migrations/*
   ```

   Alternativa sin CLI: en **SQL Editor**, pega y ejecuta en orden el contenido de
   `supabase/migrations/20261029120000_schema.sql` y después el de `20261029120100_security.sql`.
4. **Datos iniciales**: en **SQL Editor**, ejecuta primero `supabase/seed.sql` (categorías y compromisos) y después
   `supabase/private/seed_players.sql` (los 24 jugadores con sus observaciones). El segundo solo inserta si la tabla está vacía.
5. **Desplegar la Edge Function** de gestión de usuarios:

   ```bash
   npx supabase functions deploy admin-users --no-verify-jwt
   ```

   `--no-verify-jwt` es intencionado: la función verifica la sesión por sí misma y además comprueba que quien llama es un admin activo. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase automáticamente, así que no tienes que configurar secretos.
6. **Primer administrador**:
   1. En **Authentication → Users → Add user → Create new user**, pon tu email y una contraseña y marca «Auto Confirm User».
   2. En **SQL Editor**, ejecuta:

      ```sql
      update public.profiles set role = 'admin', active = true, full_name = 'Tu Nombre'
      where email = 'tu@email.com';
      ```

7. **Claves para la web**: en **Project Settings → API Keys**, copia la **Project URL** y la clave **anon public**
   (o la *publishable key* `sb_publishable_…`). **No copies la `service_role` ni la `secret`.**

---

## 3. Git y GitHub

`git init` ya está hecho en la carpeta.

1. Crea una cuenta en https://github.com y un repositorio **privado** vacío (sin README), por ejemplo `judeval-entrenadores`.
2. En la carpeta del proyecto:

   ```bash
   git add .
   git status
   ```

   **Comprueba que en la lista NO aparecen** `.env.local`, `analisis_jugadores.txt`, `Guia_JUDEVAL_…pdf` ni nada dentro de `supabase/private/`. Si aparece alguno, para y revisa `.gitignore`.
3. Haz el primer commit y súbelo:

   ```bash
   git commit -m "App de entrenadores JUDEVAL"
   git remote add origin https://github.com/TU_USUARIO/judeval-entrenadores.git
   git push -u origin main
   ```

   La primera vez Git te pedirá iniciar sesión en GitHub desde el navegador.

---

## 4. Vercel (plan Hobby)

1. Crea una cuenta en https://vercel.com con **Continue with GitHub** y elige el plan **Hobby**, que es gratuito. No actives la prueba de Pro.
2. Pulsa **Add New → Project** y luego **Import** en el repositorio `judeval-entrenadores`. Vercel detecta Vite solo; `vercel.json` ya define el build, las rutas de la SPA y las cabeceras de seguridad.
3. En **Environment Variables**, añade las dos variables con los valores del paso 2.7:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Pulsa **Deploy**. Obtendrás una URL del tipo `https://judeval-entrenadores.vercel.app`.
5. En Supabase, entra en **Authentication → URL Configuration** y pon esa URL en **Site URL**.
6. Entra con tu usuario admin, ve a **Admin → + Nuevo entrenador** y crea las cuentas. Comunica cada contraseña temporal en persona o por un canal privado; cada entrenador debe cambiarla en **Mi perfil**.

Cada `git push` a `main` vuelve a desplegar la web automáticamente.

> Vercel Hobby está pensado para uso personal y no comercial. Para una herramienta interna sin ánimo de lucro es lo
> habitual; si el club lo necesitara en el futuro, Cloudflare Pages también es gratuito y admite uso comercial.

---

## 5. Mantenimiento

- **Pausa por inactividad**: el plan Free pausa el proyecto tras 7 días sin uso. Si la web deja de cargar datos, entra en el panel de Supabase y pulsa **Restore project**.
- **Copias de seguridad**: el plan Free no incluye backups descargables. Haz uno de vez en cuando (por ejemplo, cada mes):

  ```bash
  npx supabase db dump --linked --data-only -f backups/datos-AAAA-MM-DD.sql
  ```

  La carpeta `backups/` está excluida de Git. Guarda el archivo en un sitio seguro, porque contiene datos de menores.
- **Cambios en la base de datos**:
  1. Crea una migración nueva con `npx supabase migration new nombre` y prueba en local con `npm run db:reset`, `npm run db:test` y `npm run smoke`.
  2. Aplícala en la nube con `npx supabase db push`.
  3. Regenera los tipos con `npm run db:types`.
- **Días de entrenamiento**: Lunes y miércoles se dedujeron de las notas de disponibilidad, también para las categorías de voley (copiadas de las de fútbol sala). Revísalo en **Admin → Categorías**, donde además se elige el deporte de cada categoría.
- **Nueva temporada**: actualiza la temporada de las categorías y cambia el estado de los jugadores que se van a «Baja». Así se conserva su historial.

---

## 6. Publicar una actualización que cambia la base de datos

Cuando una versión incluye una migración nueva en `supabase/migrations/` (por ejemplo, `20261031120000_sports_trainings.sql`,
que añade deportes, entrenamientos planificados, revisiones libres y estados de compromisos), **el orden importa**:
la web nueva necesita la base de datos ya migrada.

1. **Copia de seguridad** (la migración de revisiones convierte las 6 respuestas antiguas en un único texto y elimina esas columnas):

   ```bash
   npx supabase db dump --linked --data-only -f backups/antes-de-migrar-AAAA-MM-DD.sql
   ```

2. **Aplicar la migración** en Supabase:

   ```bash
   npx supabase db push
   ```

   (Sin CLI: pega el contenido del archivo de la migración en **SQL Editor** y ejecútalo una vez.)
3. **Comprobar** en Supabase → Table Editor → `categories` que existen «Cadetes» y «Juveniles» de voley.
4. **Publicar la web**: `git add .`, `git commit -m "…"` y `git push`. Vercel la despliega solo en 1–2 minutos.

La Edge Function `admin-users` no cambia con esta migración y no hace falta volver a desplegarla.

> Trabajar en local con `.env.local` apuntando a producción modifica los datos reales. Para pruebas, usa el Supabase local
> (`npm run db:start`) y sus claves (`npx supabase status`).
