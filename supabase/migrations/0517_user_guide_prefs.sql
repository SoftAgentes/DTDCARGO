-- 0517 · SDD-0589 (E9 de SDD-0582, paso 9.3) · Estado de la guía por usuario.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Su diseño espera el OK
--    de Sam (fila 9.3 del checklist); aplicarla, en prueba o en producción, exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--
-- `public.user_guide_prefs`: una fila por (tenant, usuario) con el estado de la guía
-- de Studio: por recorrido, el último paso visto, si la terminó, si pidió no volver a
-- verla sola y cuándo la vio. Copia la forma de `user_dashboard_prefs` (0233): `jsonb`
-- validado en la acción (`validarEstadoGuia`) y RLS por dueño y tenant.
--
-- Una mejora sobre la 0233: la policy exige `user_tenants.disabled_at is null`, como
-- la 0200. Un usuario desactivado no lee ni escribe su fila.
--
-- Datos personales: solo ids de recorrido y de paso, booleanos y una fecha, ligados a
-- `user_id`. Describen si un empleado vio la guía. Se borra en cascada con el usuario
-- y con el tenant.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regclass('auth.users') is null
     or pg_catalog.to_regprocedure('public.touch_updated_at()') is null then
    raise exception '0517 requiere tenants, user_tenants, auth.users y touch_updated_at()';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.user_tenants'::regclass and attname = 'disabled_at' and not attisdropped
  ) then
    raise exception '0517 requiere user_tenants.disabled_at (0200)';
  end if;
  if pg_catalog.to_regclass('public.user_guide_prefs') is not null then
    raise exception '0517: user_guide_prefs ya existe; no se reaplica';
  end if;
end;
$preflight$;

create table public.user_guide_prefs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb
              check (jsonb_typeof(state) = 'object' and pg_catalog.pg_column_size(state) <= 16384),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on table public.user_guide_prefs is
  'SDD-0589 (9.3): estado de la guía de Studio por usuario, una fila por tenant y usuario. state = { v: 1, recorridos: { [id]: { pasoId, terminado, noMostrar, vistoEn } } }, validado en validarEstadoGuia(). RLS por dueño y tenant activo.';

create trigger user_guide_prefs_touch
  before update on public.user_guide_prefs
  for each row execute function public.touch_updated_at();

alter table public.user_guide_prefs enable row level security;

create policy user_guide_prefs_owner on public.user_guide_prefs
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and tenant_id in (
      select ut.tenant_id from public.user_tenants ut
      where ut.user_id = (select auth.uid()) and ut.disabled_at is null
    )
  )
  with check (
    user_id = (select auth.uid())
    and tenant_id in (
      select ut.tenant_id from public.user_tenants ut
      where ut.user_id = (select auth.uid()) and ut.disabled_at is null
    )
  );

revoke all on public.user_guide_prefs from public, anon, authenticated;
grant select, insert, update, delete on public.user_guide_prefs to authenticated;
grant all on public.user_guide_prefs to service_role;
