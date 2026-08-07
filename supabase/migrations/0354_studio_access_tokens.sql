-- ─────────────────────────────────────────────────────────────
-- 0354 · SDD-0250 (corrección) · tokens propios de acceso al Studio
--
-- POR QUÉ EXISTE: la primera versión de "Enviar acceso" usaba el token de
-- recuperación de Supabase y lo canjeaba al ABRIR el enlace (un GET). Eso lo
-- rompía en producción de forma sistemática: el escáner de correo del
-- destinatario (Gmail) abre los enlaces del mensaje apenas llega, para revisar
-- que no sean maliciosos. Esa apertura automática consumía el token de un solo
-- uso, y cuando la persona hacía clic minutos después ya estaba gastado.
--
-- MEDIDO el 2026-08-06, experimento controlado sobre el mismo usuario:
--   · token generado CON envío de correo  → muerto en < 37 s, sin que nadie
--     hiciera clic (desapareció de auth.one_time_tokens)
--   · token generado SIN enviar correo    → seguía vivo a los 49 s
-- La única variable era el correo. Ver spec 0250 §Corrección.
--
-- LA REGLA QUE SE ROMPIÓ: un token de un solo uso NUNCA se consume en un GET.
-- Los GET los dispara cualquiera —escáneres de correo, vistas previas de
-- WhatsApp, buscadores— y deben ser idempotentes. El consumo va en el POST,
-- cuando la persona confirma.
--
-- ASÍ YA FUNCIONA `/invitar/<token>` en este repo desde SDD-0024: abrir sólo
-- BUSCA la invitación y muestra el formulario; el token se gasta al aceptar.
-- Esta tabla es el equivalente para alguien que YA es miembro y sólo necesita
-- volver a entrar.
--
-- NO SE AUTO-ANULAN LOS ANTERIORES a propósito. Con el token de Supabase,
-- generar uno nuevo mataba el viejo en silencio: el founder mandó dos enlaces
-- y el primero quedó muerto sin aviso. Acá todos los tokens vigentes de una
-- persona funcionan hasta que se usan o expiran. Son de un solo uso, viven 7
-- días y apuntan todos al mismo usuario, así que tener varios no agrega
-- superficie real — y elimina la trampa.
--
-- SIN RPC Y SIN GRANTS: la tabla la tocan únicamente las server actions con el
-- admin client (service_role). `authenticated` no necesita verla nunca, así que
-- se queda con RLS activa y CERO políticas = negado. Esto es deliberado, no un
-- olvido (ver la nota sobre el gap de service_role más abajo).
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.tenants') is null then
    raise exception '0354 requiere public.tenants';
  end if;
  if to_regclass('public.studio_access_tokens') is not null then
    raise notice '0354: la tabla ya existe, se re-aplican solo las garantías';
  end if;
end;
$preflight$;

create table if not exists public.studio_access_tokens (
  id          uuid primary key default extensions.gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  -- A quién le devuelve el acceso. on delete cascade: si se borra el usuario,
  -- sus tokens se van con él.
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Secreto en claro. Es el único lugar donde vive; viaja en la RUTA del
  -- enlace, no en la query, para sobrevivir al copiar/pegar y a WhatsApp.
  token       text not null unique,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  constraint studio_access_tokens_token_largo check (char_length(token) between 32 and 128)
);

comment on table public.studio_access_tokens is
  'Enlaces de acceso al Studio para miembros que ya existen (SDD-0250). Se consumen en el POST del formulario, NUNCA al abrir el enlace — un GET lo dispara cualquier escáner de correo. 0354.';

-- Búsqueda por token (el camino caliente: una lectura por apertura del enlace).
create unique index if not exists studio_access_tokens_token_idx
  on public.studio_access_tokens (token);

-- "¿Qué enlaces vigentes tiene esta persona?" para la UI de Usuarios.
create index if not exists studio_access_tokens_user_idx
  on public.studio_access_tokens (tenant_id, user_id, created_at desc);

alter table public.studio_access_tokens enable row level security;

-- service_role explícito. Sin esta política, `force_rls` puede dejar afuera
-- también al service_role (gap conocido del repo) y el flujo entero se cae en
-- silencio. `authenticated` NO lleva política: RLS activa sin política = negado,
-- que es exactamente lo que queremos.
drop policy if exists service_role_all_studio_access_tokens on public.studio_access_tokens;
create policy service_role_all_studio_access_tokens
  on public.studio_access_tokens
  for all to service_role
  using (true) with check (true);

revoke all on public.studio_access_tokens from public, anon, authenticated;
grant all on public.studio_access_tokens to service_role;

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
begin
  if to_regclass('public.studio_access_tokens') is null then
    raise exception '0354: la tabla no quedó creada';
  end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'studio_access_tokens' and rowsecurity
  ) then
    raise exception '0354: la RLS no quedó activa';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'studio_access_tokens'
      and 'authenticated' = any(roles)
  ) then
    raise exception '0354: authenticated no debe tener política sobre los tokens';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'studio_access_tokens'
      and 'service_role' = any(roles)
  ) then
    raise exception '0354: falta la política de service_role';
  end if;

  if has_table_privilege('authenticated', 'public.studio_access_tokens', 'SELECT') then
    raise exception '0354: authenticated no debe tener SELECT sobre los tokens';
  end if;
end;
$post$;
