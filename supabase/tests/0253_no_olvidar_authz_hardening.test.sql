-- ─────────────────────────────────────────────────────────────
-- SDD-0025 · No-Olvidar — prueba contractual de AUTORIZACIÓN
--
-- Convierte en gate permanente las propiedades de seguridad que el review
-- adversarial de 2026-07-17/18 encontró rotas. Un review humano es una foto de
-- un día; esto corre siempre y no se degrada.
--
-- Cubre la frontera DB (RLS / GRANT / trigger) de las tres migraciones:
--   0251 (schema) → 0252 (RPCs SECURITY DEFINER) → 0253 (authz hardening).
--
-- ⚠️ ALCANCE — lo que esta prueba NO cubre:
--   · La lógica M-of-N del recovery y el anti-replay TOTP viven en TypeScript
--     (recovery.ts / session.ts); los cubren los tests Vitest de tests/no-olvidar.
--     Acá solo se verifica su respaldo en la DB (el CHECK >= 2 y los REVOKE que
--     impiden forjar el estado).
--   · Nada del núcleo libsodium. Eso sigue esperando al review cripto humano.
--
-- Fixture PostgreSQL desechable. Termina en ROLLBACK: cero datos persistidos.
-- Se ejecuta contra un contenedor local, NUNCA contra prod.
-- ─────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

begin;

-- ── Guard: jamás correr sobre una base que tenga los objetos reales ──
do $guard$
begin
  if to_regclass('public.no_olvidar_items') is not null
     or to_regclass('public.no_olvidar_user_keys') is not null
     or to_regclass('public.no_olvidar_access_log') is not null then
    raise exception 'Fixture 0253 rechazada: los objetos reales ya existen';
  end if;
end
$guard$;

-- ── Roles de Supabase ────────────────────────────────────────
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  -- BYPASSRLS es justamente lo que hacía inútiles las policies USING(false)
  -- del audit log (hallazgo C1). Sin este atributo la prueba no probaría nada.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$roles$;

grant usage on schema public to anon, authenticated, service_role;

-- ── Stub de Supabase Auth ────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

-- auth.uid() leída de un GUC para poder simular sesiones de usuario.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

-- ── Stub de la extensión Vault (0252 la usa) ─────────────────
create schema if not exists vault;

create table vault.secrets (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  secret      text,
  description text
);

create function vault.create_secret(
  new_secret      text,
  new_name        text default null,
  new_description text default ''
)
returns uuid
language sql
as $$
  insert into vault.secrets (name, secret, description)
  values (new_name, new_secret, new_description)
  returning id
$$;

-- ── Las tres migraciones bajo prueba ─────────────────────────
\ir ../migrations/0251_no_olvidar.sql
\ir ../migrations/0252_no_olvidar_hardening.sql
\ir ../migrations/0253_no_olvidar_authz_hardening.sql

-- ── Datos de trabajo ─────────────────────────────────────────
-- El trigger no_olvidar_on_auth_user_created crea la fila de user_keys sola
-- cuando el metadata trae tenant=dtd-cargo.
insert into auth.users (id, raw_user_meta_data) values
  ('20000000-0000-0000-0000-000000000001', '{"tenant":"dtd-cargo"}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', '{"tenant":"dtd-cargo"}'::jsonb),
  ('20000000-0000-0000-0000-000000000003', '{"tenant":"otro-tenant"}'::jsonb);

do $fixture_sanity$
begin
  if not exists (
    select 1 from public.no_olvidar_user_keys
    where user_id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST 0253: el trigger de signup no creó la fila de user_keys';
  end if;

  -- El guard de tenant del trigger: otro tenant NO obtiene fila.
  if exists (
    select 1 from public.no_olvidar_user_keys
    where user_id = '20000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'TEST 0253: el trigger creó fila para un tenant ajeno';
  end if;
end
$fixture_sanity$;

insert into public.no_olvidar_access_log (user_id, action, metadata)
values ('20000000-0000-0000-0000-000000000001', 'unlock', '{"seed":true}'::jsonb);

-- ═════════════════════════════════════════════════════════════
-- C1 · El audit log es realmente inmutable
--
-- El bug: las policies USING(false) de 0251 NO atan a service_role porque
-- tiene BYPASSRLS — y es el mismo rol que escribe el log. El fix de 0253 es un
-- trigger, que sí corre aunque el rol bypasee RLS.
-- ═════════════════════════════════════════════════════════════

-- Capa 1 — el mecanismo: ni siquiera el owner (superusuario del contenedor,
-- inmune a los REVOKE) puede mutar el log. Esto prueba el TRIGGER, no la ACL.
do $c1_trigger$
begin
  begin
    update public.no_olvidar_access_log set action = 'view';
    raise exception 'TEST 0253 C1: el trigger no bloqueó UPDATE del audit log';
  exception
    when insufficient_privilege then null;   -- errcode 42501 que alza el trigger
  end;

  begin
    delete from public.no_olvidar_access_log;
    raise exception 'TEST 0253 C1: el trigger no bloqueó DELETE del audit log';
  exception
    when insufficient_privilege then null;
  end;

  -- TRUNCATE no lo cubre un trigger FOR EACH ROW: necesita el de statement.
  begin
    truncate table public.no_olvidar_access_log;
    raise exception 'TEST 0253 C1: el trigger no bloqueó TRUNCATE del audit log';
  exception
    when insufficient_privilege then null;
  end;

  if not exists (select 1 from public.no_olvidar_access_log) then
    raise exception 'TEST 0253 C1: el intento destructivo borró historia';
  end if;
end
$c1_trigger$;

-- Capa 2 — el rol real: service_role tampoco puede, y SÍ conserva INSERT
-- (si perdiera el INSERT, audit.ts dejaría de poder escribir).
set local role service_role;

do $c1_service_role$
begin
  begin
    update public.no_olvidar_access_log set action = 'view';
    raise exception 'TEST 0253 C1: service_role mutó el audit log (BYPASSRLS)';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.no_olvidar_access_log;
    raise exception 'TEST 0253 C1: service_role borró del audit log (BYPASSRLS)';
  exception
    when insufficient_privilege then null;
  end;

  -- Append-only: escribir SÍ tiene que seguir funcionando, o audit.ts se queda
  -- sin poder registrar nada.
  insert into public.no_olvidar_access_log (user_id, action)
  values ('20000000-0000-0000-0000-000000000002', 'unlock');
end
$c1_service_role$;

reset role;

-- El INSERT de service_role entró (se verifica fuera del rol: service_role
-- tiene INSERT pero NO SELECT sobre el log — least privilege deliberado de
-- 0251, la lectura va por RLS de authenticated).
do $c1_append_ok$
begin
  if not exists (
    select 1 from public.no_olvidar_access_log
    where user_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'TEST 0253 C1: service_role perdió el INSERT del audit log';
  end if;

  if has_table_privilege('service_role', 'public.no_olvidar_access_log', 'SELECT') then
    raise exception 'TEST 0253 C1: service_role ganó SELECT sobre el audit log (era write-only a propósito)';
  end if;
end
$c1_append_ok$;

-- F4 · El audit log no puede tener FK a users/items: con ON DELETE CASCADE,
-- dar de baja a un empleado disparaba un DELETE sobre el log y el trigger de
-- inmutabilidad abortaba la baja entera.
do $f4$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.no_olvidar_access_log'::regclass
      and contype = 'f'
  ) then
    raise exception 'TEST 0253 F4: el audit log recuperó una FK — la baja de empleados se rompe';
  end if;

  -- La baja tiene que pasar, y el log sobrevivirle.
  delete from auth.users where id = '20000000-0000-0000-0000-000000000002';

  if not exists (
    select 1 from public.no_olvidar_access_log
    where user_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'TEST 0253 F4: la baja del empleado se llevó su auditoría';
  end if;
end
$f4$;

-- ═════════════════════════════════════════════════════════════
-- C2 · Sin escalada de privilegios por UPDATE directo a user_keys
--
-- El bug: GRANT UPDATE de columna completa + policy que solo validaba la fila
-- dejaba a un authenticated hacer, por PostgREST: role='admin' (auto-promoción),
-- locked_until=null (bypass del lockout) y last_unlock_at=now() (forja de
-- sesión = bypass de 2FA).
-- ═════════════════════════════════════════════════════════════
do $c2$
begin
  if has_table_privilege('authenticated', 'public.no_olvidar_user_keys', 'UPDATE') then
    raise exception 'TEST 0253 C2: authenticated recuperó UPDATE sobre user_keys (auto-promoción a admin)';
  end if;

  if has_table_privilege('authenticated', 'public.no_olvidar_user_keys', 'INSERT')
     or has_table_privilege('authenticated', 'public.no_olvidar_user_keys', 'DELETE') then
    raise exception 'TEST 0253 C2: authenticated tiene INSERT/DELETE sobre user_keys';
  end if;

  -- Lo legítimo tiene que seguir funcionando: leer lo propio.
  if not has_table_privilege('authenticated', 'public.no_olvidar_user_keys', 'SELECT') then
    raise exception 'TEST 0253 C2: authenticated perdió el SELECT de su propia fila';
  end if;

  -- La policy de UPDATE del dueño tiene que estar eliminada: si vuelve junto a
  -- un GRANT futuro, la escalada revive.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'no_olvidar_user_keys'
      and policyname = 'no_olvidar_user_keys_owner_update'
  ) then
    raise exception 'TEST 0253 C2: revivió la policy owner_update de user_keys';
  end if;

  -- setup/unlock escriben con service_role: sin esto el módulo no funciona.
  if not has_table_privilege('service_role', 'public.no_olvidar_user_keys', 'UPDATE') then
    raise exception 'TEST 0253 C2: service_role perdió el UPDATE de user_keys (rompe setup/unlock)';
  end if;
end
$c2$;

-- ═════════════════════════════════════════════════════════════
-- A1 · rotate_kek no es un confused deputy alcanzable por el cliente
--
-- El bug: autorizaba por el parámetro p_actor (elegido por quien llama), nunca
-- contra auth.uid() → cualquiera pasaba un UUID de admin y causaba DoS del
-- módulo + spoofing del audit.
-- ═════════════════════════════════════════════════════════════
do $a1$
begin
  if has_function_privilege('authenticated', 'public.no_olvidar_rotate_kek(text, uuid)', 'EXECUTE') then
    raise exception 'TEST 0253 A1: authenticated puede ejecutar rotate_kek (confused deputy)';
  end if;

  if has_function_privilege('anon', 'public.no_olvidar_rotate_kek(text, uuid)', 'EXECUTE') then
    raise exception 'TEST 0253 A1: anon puede ejecutar rotate_kek';
  end if;

  if not has_function_privilege('service_role', 'public.no_olvidar_rotate_kek(text, uuid)', 'EXECUTE') then
    raise exception 'TEST 0253 A1: service_role perdió rotate_kek (rompe la rotación)';
  end if;
end
$a1$;

-- ═════════════════════════════════════════════════════════════
-- A2 · No se puede forjar un recovery ya aprobado
--
-- El bug: authenticated tenía INSERT directo con un WITH CHECK que solo
-- validaba requester_user_id → se insertaba status='approved' con
-- approvals_required=0 y executeRecovery lo aceptaba sin las 2 firmas.
-- ═════════════════════════════════════════════════════════════
do $a2$
begin
  if has_table_privilege('authenticated', 'public.no_olvidar_recovery_requests', 'INSERT') then
    raise exception 'TEST 0253 A2: authenticated puede insertar recovery requests (bypass M-of-N)';
  end if;

  if has_table_privilege('authenticated', 'public.no_olvidar_recovery_requests', 'UPDATE')
     or has_table_privilege('authenticated', 'public.no_olvidar_recovery_requests', 'DELETE') then
    raise exception 'TEST 0253 A2: authenticated puede mutar recovery requests';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'no_olvidar_recovery_requests'
      and policyname = 'no_olvidar_recovery_requests_insert'
  ) then
    raise exception 'TEST 0253 A2: revivió la policy de INSERT de recovery';
  end if;

  if not has_table_privilege('service_role', 'public.no_olvidar_recovery_requests', 'INSERT') then
    raise exception 'TEST 0253 A2: service_role perdió el INSERT (rompe pedir recovery)';
  end if;
end
$a2$;

-- El respaldo en DB del M-of-N: la config no puede bajar el quórum a 1.
-- Sin este CHECK, la UI de admin permitía configurar 1 aprobación = un solo
-- admin completa un recovery ajeno.
do $mofn$
begin
  begin
    update public.no_olvidar_config set recovery_approvals_required = 1 where id = 1;
    raise exception 'TEST 0253: se pudo bajar el quórum M-of-N a 1 aprobación';
  exception
    when check_violation then null;
  end;
end
$mofn$;

-- ═════════════════════════════════════════════════════════════
-- F3 · Las funciones no son oráculos para roles anónimos
-- ═════════════════════════════════════════════════════════════
do $f3$
begin
  if has_function_privilege('anon', 'public.no_olvidar_check_admin(uuid)', 'EXECUTE') then
    raise exception 'TEST 0253 F3: anon puede ejecutar check_admin (oráculo de admins)';
  end if;

  if has_function_privilege('anon', 'public.no_olvidar_get_active_kek_version()', 'EXECUTE') then
    raise exception 'TEST 0253 F3: anon puede ejecutar get_active_kek_version';
  end if;

  if has_function_privilege('anon', 'public.no_olvidar_increment_failed_attempt(uuid)', 'EXECUTE') then
    raise exception 'TEST 0253 F3: anon puede incrementar intentos fallidos de otro';
  end if;

  -- Crear material de KEK es exclusivo de service_role.
  if has_function_privilege('authenticated', 'public.no_olvidar_create_kek_secret(text, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.no_olvidar_create_kek_secret(text, text, text)', 'EXECUTE') then
    raise exception 'TEST 0253 F3: un rol de cliente puede crear secretos de KEK';
  end if;

  if not has_function_privilege('service_role', 'public.no_olvidar_create_kek_secret(text, text, text)', 'EXECUTE') then
    raise exception 'TEST 0253 F3: service_role perdió create_kek_secret (rompe la rotación)';
  end if;
end
$f3$;

-- ═════════════════════════════════════════════════════════════
-- Higiene de SECURITY DEFINER: search_path fijo en todas.
-- Una SECURITY DEFINER con search_path mutable es secuestrable.
-- ═════════════════════════════════════════════════════════════
do $secdef$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'no\_olvidar\_%'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
      where cfg like 'search\_path=%'
    );

  if v_bad is not null then
    raise exception 'TEST 0253: SECURITY DEFINER sin search_path fijo: %', v_bad;
  end if;
end
$secdef$;

-- ═════════════════════════════════════════════════════════════
-- RLS habilitada en las 6 tablas del módulo
-- ═════════════════════════════════════════════════════════════
do $rls$
declare
  v_sin_rls text;
begin
  select string_agg(c.relname, ', ')
    into v_sin_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'no\_olvidar\_%'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_sin_rls is not null then
    raise exception 'TEST 0253: tablas del No-Olvidar sin RLS: %', v_sin_rls;
  end if;
end
$rls$;

rollback;

-- Cero residuo: si algo de esto no es NULL, el fixture ensució la base.
select
  to_regclass('public.no_olvidar_items') is null
  and to_regclass('public.no_olvidar_user_keys') is null
  and to_regclass('public.no_olvidar_access_log') is null
  and to_regclass('public.no_olvidar_recovery_requests') is null
  and to_regclass('public.no_olvidar_kek_versions') is null
  and to_regclass('public.no_olvidar_config') is null
  and to_regclass('auth.users') is null
  and to_regprocedure('public.no_olvidar_rotate_kek(text,uuid)') is null
  as no_olvidar_fixture_rolled_back;
