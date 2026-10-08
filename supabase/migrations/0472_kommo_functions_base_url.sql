-- ─────────────────────────────────────────────────────────────────────────────
-- 0472 · SDD-0505 — kommo_run_sync() y kommo_run_writeback_drain() leen la base
-- de la URL de las Edge Functions del secreto de Vault `functions_base_url`.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: MIGRATE-FIRST. Se aplica ANTES de integrar la PR de SDD-0505 y, sobre
--    todo, ANTES del dump con el que se arranca el servidor propio: así la copia
--    restaurada ya trae las funciones que leen el Vault. Es aditiva: sólo
--    `create or replace` de dos funciones ya existentes, con el cuerpo idéntico
--    salvo el origen de la URL. En Cloud, sin el secreto, se comportan EXACTAMENTE
--    como hoy, así que ni la app desplegada ni pg_cron la notan.
--
-- ── El acoplamiento ─────────────────────────────────────────
-- 0084 (línea 32) y 0136 (línea 171) escribieron a mano la URL de las Edge
-- Functions de Supabase Cloud: `https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/…`.
-- pg_cron llama a esas dos funciones (kommo-sync 1×/día; el drain del writeback
-- sigue sin agendar, 0136:190). En el servidor propio (SDD-0505) las Edge
-- Functions viven en `http://functions:9000` dentro del compose, detrás del
-- gateway en `/functions/v1/`: con la URL fija, el cron del servidor nuevo
-- seguiría llamando a Cloud. Una migración aplicada no se edita, así que la
-- base de la URL pasa a leerse de un secreto, igual que ya se lee kommo_cron_key.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- En las dos funciones, y nada más:
--   · declare: `v_base text;`
--   · `v_base := rtrim(coalesce(<secreto functions_base_url>, <URL de Cloud>), '/')`
--   · `url := v_base || '/kommo-sync'` / `url := v_base || '/kommo-writeback'`
-- El resto del cuerpo se copia VERBATIM de 0084 (líneas 11-43) y 0136 (líneas
-- 150-182): mismo retorno bigint, SECURITY DEFINER, search_path vacío, el mismo
-- lookup de kommo_cron_key con su `limit 1`, el mismo `raise notice`, los mismos
-- headers y el mismo tenant_id. lib/studio/__tests__/kommo-functions-base-url.migration.test.ts
-- compara ese texto contra 0084/0136 línea a línea. NO se toca el agendado:
-- ni se repite el `cron.schedule` de 0084:52 ni se descomenta el de 0136:190.
-- El `rtrim` tolera un secreto escrito con barra final sin producir `//`.
-- Con search_path vacío todo sigue calificado: vault., net., y
-- jsonb_build_object/rtrim/coalesce resuelven en pg_catalog.
--
-- ── Cómo se usa en el servidor propio ───────────────────────
-- Antes del corte, en el Vault del Supabase self-hosted:
--   select vault.create_secret('http://functions:9000', 'functions_base_url',
--     'Base de la URL de las Edge Functions para pg_cron (SDD-0505)');
-- `http://functions:9000` es el servicio `functions` del compose en la red
-- interna (el gateway enruta /functions/v1/* → http://functions:9000/*); también
-- sirve la URL pública `https://<host>/functions/v1`. El router de edge-runtime
-- verifica el JWT del header Authorization con el JWT_SECRET del stack cuando
-- FUNCTIONS_VERIFY_JWT=true, así que kommo_cron_key tiene que ser la service key
-- del stack nuevo (o FUNCTIONS_VERIFY_JWT=false). Cada llamada lee el Vault: un
-- cambio del secreto rige en la siguiente corrida del cron, sin reiniciar nada.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta si alguna de las dos funciones no existe o no tiene la forma de
-- 0084/0136 (bigint, DEFINER, search_path vacío, la URL de Cloud en el cuerpo):
-- acá no se crea nada desde cero. Antes de aplicar en producción, leer en modo
-- READ ONLY proowner, prosecdef, proconfig y md5(prosrc) de las dos funciones,
-- como pide el runbook. El postflight comprueba forma, ACL y que el cuerpo
-- nombre el secreto. LOCKS: sólo de catálogo (pg_proc); ninguno sobre tablas y
-- ninguna fila tocada. ROLLBACK: volver a correr los `create or replace` de
-- 0084:11-43 y 0136:150-182; mientras el secreto no exista, no hace falta.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_fn   text;
  v_path text;
begin
  for v_fn, v_path in
    select * from (values ('kommo_run_sync', '/kommo-sync'),
                          ('kommo_run_writeback_drain', '/kommo-writeback')) v(fn, path)
  loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.' || v_fn || '()')
        and p.prosecdef
        and p.prorettype = 'pg_catalog.int8'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.strpos(p.prosrc,
          'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1' || v_path) > 0) then
      raise exception '0472 abortado: public.%() ausente o con drift respecto a 0084/0136', v_fn;
    end if;
  end loop;
end;
$preflight$;

-- ── kommo_run_sync: 0084 líneas 11-43 + v_base ──────────────
create or replace function public.kommo_run_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_base   text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_sync] kommo_cron_key no está en Vault — salteo';
    return null;
  end if;

  -- Base de la URL: el secreto functions_base_url si existe (servidor propio);
  -- si no, la URL de Cloud de 0084. rtrim evita `//` con un secreto con barra.
  v_base := rtrim(coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url' limit 1),
    'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1'), '/');

  select net.http_post(
    url     := v_base || '/kommo-sync',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

comment on function public.kommo_run_sync() is
  'SDD-0043 Fase B: invoca kommo-sync (read-only) leyendo el service key de Vault (kommo_cron_key). La corre pg_cron. SDD-0505: la base de la URL sale del secreto de Vault functions_base_url; sin él, la URL de Supabase Cloud de 0084.';

-- ── kommo_run_writeback_drain: 0136 líneas 150-182 + v_base ─
create or replace function public.kommo_run_writeback_drain()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_base   text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_writeback_drain] kommo_cron_key no esta en Vault — salteo';
    return null;
  end if;

  -- Base de la URL: el secreto functions_base_url si existe (servidor propio);
  -- si no, la URL de Cloud de 0136. rtrim evita `//` con un secreto con barra.
  v_base := rtrim(coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url' limit 1),
    'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1'), '/');

  select net.http_post(
    url     := v_base || '/kommo-writeback',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

comment on function public.kommo_run_writeback_drain() is
  'SDD-0083: drena el outbox de Kommo invocando kommo-writeback con el service key de Vault (kommo_cron_key). La corre pg_cron. SDD-0505: la base de la URL sale del secreto de Vault functions_base_url; sin él, la URL de Supabase Cloud de 0136.';

-- `create or replace` conserva la ACL, pero el archivo tiene que leerse solo:
-- las dos las llama únicamente pg_cron/service_role, nunca la API.
revoke execute on function public.kommo_run_sync() from public, anon, authenticated;
grant  execute on function public.kommo_run_sync() to service_role;
revoke execute on function public.kommo_run_writeback_drain() from public, anon, authenticated;
grant  execute on function public.kommo_run_writeback_drain() to service_role;

do $postflight$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.oid in (
          pg_catalog.to_regprocedure('public.kommo_run_sync()'),
          pg_catalog.to_regprocedure('public.kommo_run_writeback_drain()'))
        and p.prosecdef
        and p.prorettype = 'pg_catalog.int8'::pg_catalog.regtype
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.strpos(p.prosrc, 'functions_base_url') > 0
        and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) <> 2 then
    raise exception '0472: postflight — las funciones de Kommo no quedaron DEFINER, con search_path vacío, leyendo functions_base_url o con la ACL esperada';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0472_kommo_functions_base_url.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0472_kommo_functions_base_url. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
