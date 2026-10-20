-- ─────────────────────────────────────────────────────────────
-- SDD-0566 · Cierre contable con superclave y reporte de excepciones
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0566. Aplicada sola no cambia lo que
--    se ve: todos los tenants quedan en modo 'superclave' sin superclave, que
--    bloquea igual que 0133, y la app desplegada no llama a las RPC nuevas.
--
-- Hasta acá (SDD-0080, 0133) un asiento con entry_date <= closing_date era
-- inmutable sin excepción: para corregir había que reabrir el período para
-- todos. Esta migración agrega, como en QuickBooks («Close the books»):
--
--   1. accounting_settings.closing_mode: 'superclave' (por defecto) o
--      'advertencia'. Sin superclave definida, 'superclave' bloquea igual que
--      hoy: la migración no debilita nada.
--   2. accounting_closing_secrets: la superclave del tenant, SOLO como hash
--      bcrypt (extensions.crypt + gen_salt('bf', 10), como el PIN de 0020).
--      Ningún rol de API la lee ni la escribe; solo funciones DEFINER.
--   3. accounting_closing_exceptions: cada cambio en período cerrado. La fila
--      ES el permiso: la RPC la inserta con un nonce y txid_current(), fija
--      dtd.excepcion_cierre = nonce y los triggers de 0133 aceptan el cambio
--      solo si esa fila existe en la transacción y es de ese asiento. Un
--      set_config hecho a mano no alcanza: la tabla no tiene escritura de API.
--   4. accounting_closing_events: el historial del cierre (fecha, modo,
--      superclave definida/cambiada/restablecida, intentos fallidos y
--      bloqueos). Nunca guarda el valor de la clave.
--   5. Las cuatro operaciones de asientos manuales en período cerrado, como
--      RPC SECURITY DEFINER con las guardas de tenant y de edición de
--      'accounting' (la matriz de lib/studio/rbac.ts, como 0477).
--
-- Un intento fallido NO lanza: devuelve {ok:false} para que la transacción
-- confirme el contador y el registro del intento. Si lanzara, el ROLLBACK se
-- llevaría el contador y la fuerza bruta no tendría límite.
--
-- La clave entra como parámetro, y el Postgres del VPS guarda en el log, con
-- sus parámetros completos, toda sentencia que pase de 10 s (auto_explain,
-- medido por el Director el 2026-10-19). Por eso, las ocho funciones que
-- reciben la clave (p_clave, p_actual, p_nueva) llevan `set lock_timeout =
-- '1s'`: ninguna espera más de un segundo por un bloqueo. De la API, solo
-- `authenticated` (que corta a los 8 s) llama a las seis públicas; nunca `anon`
-- ni `service_role`. Las dos internas no tienen EXECUTE para ningún rol de API.
--
-- MIGRATE-FIRST: se aplica antes de fusionar, con la previa de solo lectura,
-- el OK nominal de Sam y docs/runbooks/aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

-- Locks: ACCESS EXCLUSIVE breve sobre accounting_settings (columna nueva con
-- default constante, sin reescritura) y los de reemplazar dos funciones; no
-- toca filas del mayor. Como 0467, 0471 y 0492:
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  -- Primero: si el cierre con superclave ya existe, la 0493 ya se aplicó. Va
  -- antes que las huellas, porque los triggers de 0133 ya son los de 0493 y
  -- abortaría con «otro cuerpo», que confunde.
  if to_regclass('public.accounting_closing_secrets') is not null
     or to_regclass('public.accounting_closing_exceptions') is not null
     or to_regclass('public.accounting_closing_events') is not null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'accounting_settings' and column_name = 'closing_mode'
     ) then
    raise exception '0493 abortado: el cierre con superclave ya existe';
  end if;

  -- Las funciones que se reemplazan (los triggers de 0133) y las que se
  -- invocan: firma, seguridad, volatilidad, search_path y cuerpo vigentes (md5
  -- del prosrc con CRLF→LF, o sin espacios). Otro cuerpo aborta sin cambiar
  -- nada: reemplazar un trigger que en producción es otro sería perder lo que
  -- tiene. Los search_path de los triggers son los de 0210 (y 0275/0284/0287/0288).
  --
  -- DERIVA DE 0133, medida por el Director en producción el 2026-10-20 (solo
  -- el catálogo): los dos triggers vivos son el cuerpo del repo SIN sus
  -- comentarios internos y SIN tildes en los mensajes («Periodo», «periodo»,
  -- «lineas»). El archivo 0133 se editó después de aplicarse, en la época de
  -- Cloud; la lógica es idéntica, también el «%s». Por eso cada trigger acepta
  -- dos cuerpos conocidos: el del repo (el que reconstruyen las pruebas) y el
  -- vivo. Cualquier otro sigue abortando. La 0133 no se toca: está sellada.
  for v_expected in select * from (values
    ('public.journal_entries_validate_closing()', false, 'v', 'search_path=public',
     array['bba82f1ee57c6a32f186a2b9dbeda94a',     -- 0133 del repo
           '26b81a55480d3bafb57450efc17663a6'],    -- vivo en producción (903 caracteres)
     array['59e9825c471c993e2f4856e0207c7a71',
           '1dd58682fc49a595900ff03d5030ba21']),
    ('public.journal_lines_validate_closing()', false, 'v', 'search_path=public',
     array['007f258ea5596a49999f772fea17b152',     -- 0133 del repo
           '5e7e21f09f53520aba46c5bbf10c2cfc'],    -- vivo en producción (408 caracteres)
     array['d8554d69c2e659b8c36ee081346b9471',
           '7c2b64a2a68194420ff4d2fe0e672274']),
    ('public.get_accounting_closing_date(uuid)', true, 's', 'search_path=public',
     array['7e5d5609120f003e2c21b89601cbc5a5'], array['30b1f37e5cd45a428dd39ed8054e21a2']),   -- 0133
    ('public.journal_entry_is_closed(uuid)', true, 's', 'search_path=public',
     array['8114d6c6b43a00dea3731722c9bc7208'], array['e616e73575bce4960468518af3971e23']),   -- 0133
    ('public.next_entry_code(uuid)', true, 'v', 'search_path=public',
     array['6954cb3efb9db4ca131266964d4ed524'], array['30ce8b9d8606d79b2f20bc07f3a6ac73']),   -- 0078
    ('public.get_user_tenant_id()', true, 's', 'search_path=""',
     array['5ff0c51c26a49419c34abc78f1d95c37'], array['4ce5acd04a577f91ca77b74ebc622c49'])    -- 0453
  ) e(signature, definer, volatility, config, body_md5s, body_md5s_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
      and p.prosecdef = v_expected.definer
      and p.provolatile::text = v_expected.volatility
      and p.proconfig = array[v_expected.config]::text[];
    if v_md5 is null then
      raise exception '0493: dependencia ausente o con otra firma, seguridad, volatilidad o search_path: %',
        v_expected.signature;
    end if;
    if not (v_md5 = any (v_expected.body_md5s))
       and not coalesce(v_md5_normalized = any (v_expected.body_md5s_normalized), false) then
      raise exception '0493 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if to_regclass('public.studio_role_module_overrides') is null
     or to_regclass('public.user_tenants') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception '0493 requiere studio_role_module_overrides, user_tenants y auth.uid()';
  end if;
  if to_regclass('public.accounting_settings') is null
     or to_regprocedure('public.journal_entries_validate_closing()') is null
     or to_regprocedure('public.journal_lines_validate_closing()') is null
     or to_regprocedure('public.journal_entry_is_closed(uuid)') is null
     or to_regprocedure('public.get_accounting_closing_date(uuid)') is null
     or to_regprocedure('public.next_entry_code(uuid)') is null then
    raise exception '0493 abortado: falta el cierre de período de 0133 o next_entry_code de 0078';
  end if;
  if to_regprocedure('extensions.crypt(text,text)') is null
     or to_regprocedure('extensions.gen_salt(text,integer)') is null
     or to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception '0493 abortado: falta pgcrypto en el esquema extensions';
  end if;
end;
$preflight$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. El modo del cierre                                     ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.accounting_settings
  add column closing_mode text not null default 'superclave'
    constraint accounting_settings_closing_mode_check
    check (closing_mode in ('superclave', 'advertencia'));

comment on column public.accounting_settings.closing_mode is
  'SDD-0566: cómo se cambia un período cerrado. superclave = advertencia + superclave + motivo (sin superclave definida no se puede, como en 0133); advertencia = advertencia + motivo. Solo el admin lo cambia (policies de 0133).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Tablas: superclave, excepciones e historial            ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.accounting_closing_secrets (
  tenant_id       uuid primary key references public.tenants(id) on delete cascade,
  -- Hash bcrypt. El texto de la superclave nunca se guarda.
  secret_hash     text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until    timestamptz,
  set_by          uuid references auth.users(id) on delete set null,
  set_at          timestamptz not null default now()
);

comment on table public.accounting_closing_secrets is
  'SDD-0566: superclave del cierre contable por tenant, solo como hash bcrypt. Sin acceso para ningún rol de API: la leen y escriben solo las funciones DEFINER de 0493.';

alter table public.accounting_closing_secrets enable row level security;
revoke all on table public.accounting_closing_secrets from public, anon, authenticated, service_role;

create table public.accounting_closing_exceptions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  -- Sin FK: el reporte conserva la excepción aunque el asiento cambie.
  entry_id      uuid not null,
  entry_code    text not null,
  entry_date    date not null,
  closing_date  date not null,
  operation     text not null check (operation in ('crear', 'asentar', 'anular', 'eliminar')),
  authorized_by text not null check (authorized_by in ('superclave', 'advertencia')),
  reason        text not null check (pg_catalog.char_length(pg_catalog.btrim(reason)) between 4 and 1000),
  amount_before numeric(14,2) not null,
  amount_after  numeric(14,2) not null,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- El permiso: válido solo en la transacción que lo creó.
  nonce         text not null,
  txid          bigint not null
);

comment on table public.accounting_closing_exceptions is
  'SDD-0566: reporte «Excepciones al cierre». Cada fila es también el permiso de un solo uso que los triggers de 0133 aceptan (nonce + txid de la transacción). Solo la escriben las RPC DEFINER de 0493.';

create index accounting_closing_exceptions_tenant_idx
  on public.accounting_closing_exceptions (tenant_id, created_at desc);
create index accounting_closing_exceptions_entry_idx
  on public.accounting_closing_exceptions (entry_id, txid);

alter table public.accounting_closing_exceptions enable row level security;
revoke all on table public.accounting_closing_exceptions from public, anon, authenticated, service_role;
-- El nonce y el txid no se leen: no sirven fuera de su transacción, pero no hay
-- por qué mostrarlos.
grant select (id, tenant_id, entry_id, entry_code, entry_date, closing_date, operation,
  authorized_by, reason, amount_before, amount_after, user_id, created_at)
  on public.accounting_closing_exceptions to authenticated;
create policy accounting_closing_exceptions_tenant_select
  on public.accounting_closing_exceptions for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create table public.accounting_closing_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  kind       text not null check (kind in (
    'fecha_cambiada', 'modo_cambiado', 'superclave_definida', 'superclave_cambiada',
    'superclave_restablecida', 'intento_fallido', 'superclave_bloqueada'
  )),
  -- Fechas o modos. Nunca la superclave.
  old_value  text,
  new_value  text,
  reason     text,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.accounting_closing_events is
  'SDD-0566: historial del cierre contable: cambios de fecha y modo, superclave definida, cambiada o restablecida, intentos fallidos y bloqueos. Nunca guarda el valor de la clave. Solo lo escriben funciones y triggers DEFINER de 0493.';

create index accounting_closing_events_tenant_idx
  on public.accounting_closing_events (tenant_id, created_at desc);

alter table public.accounting_closing_events enable row level security;
revoke all on table public.accounting_closing_events from public, anon, authenticated, service_role;
grant select on public.accounting_closing_events to authenticated;
create policy accounting_closing_events_tenant_select
  on public.accounting_closing_events for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Guardas: ¿quién edita contabilidad? ¿quién es admin?   ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Mismo cuerpo que naviera_avance_module_authorized (0477), con el contrato de
-- 'accounting' de ROLE_MODULE_ACCESS (lib/studio/rbac.ts: solo 'accounting',
-- más admin). Defaults duplicados con rbac.ts.
create function public.contabilidad_edicion_autorizada(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select m.role, o.can_edit
    from membership m
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = 'accounting'
  )
  select coalesce((
    select case
      when d.role = 'admin' then true
      when d.role = 'support' then false
      else coalesce(d.can_edit, d.role = 'accounting')
    end
    from decision d
  ), false)
$function$;

comment on function public.contabilidad_edicion_autorizada(uuid) is
  'SDD-0566: ¿auth.uid() puede EDITAR accounting en el tenant? Regla de canEditModule (rbac.ts), como 0477. Sin EXECUTE para roles de API.';

revoke all on function public.contabilidad_edicion_autorizada(uuid)
  from public, anon, authenticated, service_role;

create function public.cierre_es_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and pg_catalog.lower(pg_catalog.btrim(ut.role)) = 'admin'
      and ut.disabled_at is null
  )
$function$;

comment on function public.cierre_es_admin(uuid) is
  'SDD-0566: ¿auth.uid() es admin activo del tenant? Para la superclave. Sin EXECUTE para roles de API.';

revoke all on function public.cierre_es_admin(uuid)
  from public, anon, authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Verificar la superclave (interna)                      ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Devuelve null si la clave es la correcta, o el motivo: 'sin_superclave',
-- 'bloqueada' o 'incorrecta'. Toma la fila con FOR UPDATE: dos intentos en
-- paralelo no se saltan el contador. Sin fila compara igual contra un hash
-- recién hecho, para tardar lo mismo. Cada cinco fallidos seguidos bloquean, y
-- cada bloqueo dura el doble que el anterior (15 minutos, 30, 1 hora… hasta 24
-- horas). NO lanza: quien la llama confirma la transacción con el contador.
create function public.cierre_verificar_superclave(p_tenant_id uuid, p_clave text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_secret   public.accounting_closing_secrets%rowtype;
  v_ok       boolean;
  v_fallidos integer;
  v_minutos  integer;
begin
  select * into v_secret
  from public.accounting_closing_secrets s
  where s.tenant_id = p_tenant_id
  for update;

  if not found then
    perform extensions.crypt(coalesce(p_clave, ''), extensions.gen_salt('bf', 10));
    return 'sin_superclave';
  end if;

  if v_secret.locked_until is not null and v_secret.locked_until > pg_catalog.now() then
    return 'bloqueada';
  end if;

  v_ok := p_clave is not null
    and extensions.crypt(p_clave, v_secret.secret_hash) = v_secret.secret_hash;

  if v_ok then
    update public.accounting_closing_secrets
    set failed_attempts = 0, locked_until = null
    where tenant_id = p_tenant_id;
    return null;
  end if;

  insert into public.accounting_closing_events (tenant_id, kind, user_id)
  values (p_tenant_id, 'intento_fallido', (select auth.uid()));

  -- Cada 5 fallidos seguidos, un bloqueo que dura el doble que el anterior: 15
  -- minutos, 30, 1 hora… hasta 24 horas. El contador NO vuelve a 0 al bloquear:
  -- solo un acierto o restablecer lo limpian. Con 15 minutos fijos salían unos
  -- 480 intentos por día contra una clave de 8 caracteres.
  v_fallidos := v_secret.failed_attempts + 1;
  if v_fallidos % 5 = 0 then
    v_minutos := least(15 * (2 ^ least(v_fallidos / 5 - 1, 7))::integer, 1440);
    update public.accounting_closing_secrets
    set failed_attempts = v_fallidos,
        locked_until = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutos)
    where tenant_id = p_tenant_id;
    insert into public.accounting_closing_events (tenant_id, kind, new_value, user_id)
    values (p_tenant_id, 'superclave_bloqueada',
      case when v_minutos < 60 then v_minutos || ' minutos'
           when v_minutos = 60 then '1 hora'
           else (v_minutos / 60) || ' horas' end,
      (select auth.uid()));
  else
    update public.accounting_closing_secrets
    set failed_attempts = v_fallidos
    where tenant_id = p_tenant_id;
  end if;
  return 'incorrecta';
end;
$function$;

comment on function public.cierre_verificar_superclave(uuid, text) is
  'SDD-0566: verifica la superclave con bcrypt, FOR UPDATE, contador y bloqueo que escala (cada 5 fallidos: 15 min, 30, 1 h… hasta 24 h; el contador solo vuelve a 0 con un acierto o restablecer). Devuelve null o el motivo; no lanza. Sin EXECUTE para roles de API.';

revoke all on function public.cierre_verificar_superclave(uuid, text)
  from public, anon, authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Autorizar una excepción (interna): la fila es el permiso ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.autorizar_excepcion_al_cierre(
  p_tenant_id     uuid,
  p_entry_id      uuid,
  p_entry_code    text,
  p_entry_date    date,
  p_operation     text,
  p_clave         text,
  p_reason        text,
  p_amount_before numeric,
  p_amount_after  numeric
) returns text
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_closing date := public.get_accounting_closing_date(p_tenant_id);
  v_mode    text;
  v_motivo  text;
  v_nonce   text;
begin
  if v_closing is null or p_entry_date > v_closing then
    return 'no_cerrado';
  end if;
  -- El motivo, antes que la clave: uno inválido no gasta un intento.
  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 4 and 1000 then
    raise exception 'El motivo debe tener entre 4 y 1000 caracteres.' using errcode = '22023', hint = 'dtd-cierre';
  end if;

  select s.closing_mode into v_mode
  from public.accounting_settings s
  where s.tenant_id = p_tenant_id;

  if coalesce(v_mode, 'superclave') = 'superclave' then
    v_motivo := public.cierre_verificar_superclave(p_tenant_id, p_clave);
    if v_motivo is not null then
      return v_motivo;
    end if;
  end if;

  v_nonce := pg_catalog.encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.accounting_closing_exceptions (
    tenant_id, entry_id, entry_code, entry_date, closing_date, operation, authorized_by,
    reason, amount_before, amount_after, user_id, nonce, txid
  ) values (
    p_tenant_id, p_entry_id, p_entry_code, p_entry_date, v_closing, p_operation,
    coalesce(v_mode, 'superclave'), pg_catalog.btrim(p_reason), p_amount_before, p_amount_after,
    (select auth.uid()), v_nonce, pg_catalog.txid_current()
  );

  perform pg_catalog.set_config('dtd.excepcion_cierre', v_nonce, true);
  return null;
end;
$function$;

comment on function public.autorizar_excepcion_al_cierre(uuid, uuid, text, date, text, text, text, numeric, numeric) is
  'SDD-0566: verifica el modo y la superclave, inserta la excepción (el permiso) y fija dtd.excepcion_cierre en la transacción. Devuelve null o el motivo. Sin EXECUTE para roles de API.';

revoke all on function public.autorizar_excepcion_al_cierre(uuid, uuid, text, date, text, text, text, numeric, numeric)
  from public, anon, authenticated, service_role;

-- ¿Hay una excepción de ESTA transacción para ese asiento? Lo preguntan los
-- triggers de 0133. Sin la fila no alcanza con fijar el GUC a mano.
create function public.excepcion_al_cierre_vigente(p_entry_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.accounting_closing_exceptions x
    where x.entry_id = p_entry_id
      and x.nonce = nullif(pg_catalog.current_setting('dtd.excepcion_cierre', true), '')
      and x.txid = pg_catalog.txid_current()
  )
$function$;

comment on function public.excepcion_al_cierre_vigente(uuid) is
  'SDD-0566: ¿la transacción actual tiene la excepción (nonce + txid) para ese asiento? La usan los triggers de cierre.';

revoke all on function public.excepcion_al_cierre_vigente(uuid) from public, anon;
grant execute on function public.excepcion_al_cierre_vigente(uuid) to authenticated, service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Los triggers de 0133 aceptan la excepción              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Reescritos desde su última definición (0133; search_path fijado en 0210 y
-- las reparaciones de historia 0275/0284/0287/0288). Mismo chequeo de OLD y
-- NEW; se agrega la excepción y se corrige el «%s» del mensaje de 0133.

create or replace function public.journal_entries_validate_closing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_closing_date date;
  v_tenant_id    uuid := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;
  v_entry_id     uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_old_date     date := case when tg_op = 'INSERT' then null else old.entry_date end;
  v_new_date     date := case when tg_op = 'DELETE' then null else new.entry_date end;
begin
  v_closing_date := public.get_accounting_closing_date(v_tenant_id);

  if v_closing_date is not null
     and ((v_old_date is not null and v_old_date <= v_closing_date)
       or (v_new_date is not null and v_new_date <= v_closing_date))
     and not public.excepcion_al_cierre_vigente(v_entry_id) then
    -- 0133 decía «%s»: RAISE solo entiende «%» y salía «modificars».
    raise exception
      'Período contable cerrado: no se puede % un asiento en período cerrado (cierre: %).',
      case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'borrar' end,
      v_closing_date
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.journal_entries_validate_closing() is
  'SDD-0080 + SDD-0566: bloquea INSERT/UPDATE/DELETE de journal_entries con entry_date <= closing_date, salvo con la excepción de la transacción (accounting_closing_exceptions). raise check_violation.';

create or replace function public.journal_lines_validate_closing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entry_id uuid := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
begin
  -- Una línea no cambia de asiento. En 0133 el UPDATE solo miraba new.entry_id:
  -- mover una línea de un asiento cerrado a uno abierto sacaba la línea del
  -- período cerrado sin excepción. Ningún código cambia entry_id: se borra la
  -- línea y se crea en el otro asiento.
  if tg_op = 'UPDATE' and new.entry_id is distinct from old.entry_id then
    raise exception 'Una línea no cambia de asiento: bórrala y créala en el otro.'
      using errcode = 'check_violation';
  end if;
  if coalesce(public.journal_entry_is_closed(v_entry_id), false)
     and not public.excepcion_al_cierre_vigente(v_entry_id) then
    raise exception
      'Período contable cerrado: no se pueden modificar las líneas de un asiento cerrado.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.journal_lines_validate_closing() is
  'SDD-0080 + SDD-0566: bloquea INSERT/UPDATE/DELETE de líneas de un asiento en período cerrado, salvo con la excepción de la transacción. Una línea nunca cambia de entry_id.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. Historial de la fecha y el modo                        ║
-- ╚═══════════════════════════════════════════════════════════╝

create function public.accounting_settings_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.closing_date is not null then
      insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
      values (new.tenant_id, 'fecha_cambiada', null, new.closing_date::text, (select auth.uid()));
    end if;
    if new.closing_mode is distinct from 'superclave' then
      insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
      values (new.tenant_id, 'modo_cambiado', 'superclave', new.closing_mode, (select auth.uid()));
    end if;
    return new;
  end if;

  -- Borrar la fila reabre el período (y el modo vuelve a 'superclave'). Queda
  -- en el historial, salvo cuando se borra el tenant entero: ahí el historial
  -- se va con él en cascada y escribirle un evento violaría su FK.
  if tg_op = 'DELETE' then
    if exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      if old.closing_date is not null then
        insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
        values (old.tenant_id, 'fecha_cambiada', old.closing_date::text, null, (select auth.uid()));
      end if;
      if old.closing_mode is distinct from 'superclave' then
        insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
        values (old.tenant_id, 'modo_cambiado', old.closing_mode, 'superclave', (select auth.uid()));
      end if;
    end if;
    return old;
  end if;

  if new.closing_date is distinct from old.closing_date then
    insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
    values (new.tenant_id, 'fecha_cambiada', old.closing_date::text, new.closing_date::text, (select auth.uid()));
  end if;
  if new.closing_mode is distinct from old.closing_mode then
    insert into public.accounting_closing_events (tenant_id, kind, old_value, new_value, user_id)
    values (new.tenant_id, 'modo_cambiado', old.closing_mode, new.closing_mode, (select auth.uid()));
  end if;
  return new;
end;
$function$;

comment on function public.accounting_settings_historial() is
  'SDD-0566: escribe en accounting_closing_events cada cambio de la fecha de cierre y del modo, con auth.uid(), también al borrar la fila (salvo con el tenant entero).';

revoke all on function public.accounting_settings_historial() from public, anon, authenticated, service_role;

create trigger accounting_settings_historial_trg
  after insert or update or delete on public.accounting_settings
  for each row execute function public.accounting_settings_historial();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. La superclave: definir, cambiar, restablecer, estado   ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Definir (si no hay) o cambiar (dando la actual). Solo el admin.
create function public.fijar_superclave_de_cierre(p_actual text, p_nueva text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_existe boolean;
  v_motivo text;
begin
  if v_tenant is null or not public.cierre_es_admin(v_tenant) then
    raise exception 'Solo el admin del tenant define la superclave del cierre.'
      using errcode = '42501', hint = 'dtd-cierre';
  end if;
  -- bcrypt usa solo los primeros 72 bytes: más larga, dos claves distintas serían la misma.
  if p_nueva is null or pg_catalog.char_length(p_nueva) not between 8 and 64
     or pg_catalog.octet_length(p_nueva) > 72 then
    raise exception 'La superclave debe tener entre 8 y 64 caracteres (con muchas tildes o eñes, menos).'
      using errcode = '22023', hint = 'dtd-cierre';
  end if;

  select true into v_existe
  from public.accounting_closing_secrets s
  where s.tenant_id = v_tenant;

  if coalesce(v_existe, false) then
    v_motivo := public.cierre_verificar_superclave(v_tenant, p_actual);
    if v_motivo is not null then
      return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);
    end if;
    update public.accounting_closing_secrets
    set secret_hash = extensions.crypt(p_nueva, extensions.gen_salt('bf', 10)),
        failed_attempts = 0, locked_until = null,
        set_by = (select auth.uid()), set_at = pg_catalog.now()
    where tenant_id = v_tenant;
    insert into public.accounting_closing_events (tenant_id, kind, user_id)
    values (v_tenant, 'superclave_cambiada', (select auth.uid()));
  else
    insert into public.accounting_closing_secrets (tenant_id, secret_hash, set_by)
    values (v_tenant, extensions.crypt(p_nueva, extensions.gen_salt('bf', 10)), (select auth.uid()));
    insert into public.accounting_closing_events (tenant_id, kind, user_id)
    values (v_tenant, 'superclave_definida', (select auth.uid()));
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

comment on function public.fijar_superclave_de_cierre(text, text) is
  'SDD-0566: define la superclave del cierre o la cambia dando la actual (con su contador y bloqueo). Solo admin. Guarda solo el hash bcrypt.';

revoke all on function public.fijar_superclave_de_cierre(text, text) from public, anon, service_role;
grant execute on function public.fijar_superclave_de_cierre(text, text) to authenticated;

-- Restablecer sin la actual (olvido), con motivo. Solo el admin, que de todos
-- modos puede reabrir el período moviendo la fecha. Queda en el historial.
create function public.restablecer_superclave_de_cierre(p_nueva text, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_reason text := nullif(pg_catalog.btrim(p_motivo), '');
begin
  if v_tenant is null or not public.cierre_es_admin(v_tenant) then
    raise exception 'Solo el admin del tenant restablece la superclave del cierre.'
      using errcode = '42501', hint = 'dtd-cierre';
  end if;
  -- bcrypt usa solo los primeros 72 bytes: más larga, dos claves distintas serían la misma.
  if p_nueva is null or pg_catalog.char_length(p_nueva) not between 8 and 64
     or pg_catalog.octet_length(p_nueva) > 72 then
    raise exception 'La superclave debe tener entre 8 y 64 caracteres (con muchas tildes o eñes, menos).'
      using errcode = '22023', hint = 'dtd-cierre';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 10 and 1000 then
    raise exception 'El motivo del restablecimiento debe tener entre 10 y 1000 caracteres.'
      using errcode = '22023', hint = 'dtd-cierre';
  end if;

  insert into public.accounting_closing_secrets (tenant_id, secret_hash, set_by)
  values (v_tenant, extensions.crypt(p_nueva, extensions.gen_salt('bf', 10)), (select auth.uid()))
  on conflict (tenant_id) do update
    set secret_hash = excluded.secret_hash, failed_attempts = 0, locked_until = null,
        set_by = excluded.set_by, set_at = pg_catalog.now();
  insert into public.accounting_closing_events (tenant_id, kind, reason, user_id)
  values (v_tenant, 'superclave_restablecida', v_reason, (select auth.uid()));

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

comment on function public.restablecer_superclave_de_cierre(text, text) is
  'SDD-0566: restablece la superclave sin la actual, con motivo; limpia el contador y el bloqueo. Solo admin. Queda en el historial.';

revoke all on function public.restablecer_superclave_de_cierre(text, text) from public, anon, service_role;
grant execute on function public.restablecer_superclave_de_cierre(text, text) to authenticated;

-- El estado, sin el hash: para la pantalla.
create function public.estado_cierre_contable()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'closing_date', s.closing_date,
    'closing_mode', coalesce(s.closing_mode, 'superclave'),
    'superclave_definida', x.tenant_id is not null,
    'bloqueada_hasta', case when x.locked_until > pg_catalog.now() then x.locked_until end
  )
  from (select public.get_user_tenant_id() as tenant_id) t
  left join public.accounting_settings s on s.tenant_id = t.tenant_id
  left join public.accounting_closing_secrets x on x.tenant_id = t.tenant_id
  where t.tenant_id is not null
$function$;

comment on function public.estado_cierre_contable() is
  'SDD-0566: fecha, modo, si hay superclave y si está bloqueada, para el tenant del usuario. Nunca el hash.';

revoke all on function public.estado_cierre_contable() from public, anon, service_role;
grant execute on function public.estado_cierre_contable() to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9. Las cuatro operaciones en período cerrado              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cada una, en UNA transacción: guardas → verificación y excepción → cambio →
-- limpia el permiso. Un fallo de la superclave devuelve {ok:false, motivo}
-- (no lanza) para que el contador y el intento queden confirmados.

-- Total del debe de un asiento (el antes y el después del reporte).
create function public.cierre_total_del_asiento(p_entry_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(pg_catalog.sum(l.debit), 0)::numeric(14,2)
  from public.journal_lines l
  where l.entry_id = p_entry_id
$function$;

revoke all on function public.cierre_total_del_asiento(uuid) from public, anon, authenticated, service_role;

-- Crear un asiento manual con fecha cerrada. p_entrada:
-- {entry_date, memo, asentar, lineas: [{account_id, debit, credit, line_memo}]}
create function public.crear_asiento_en_cierre(p_entrada jsonb, p_clave text, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant  uuid := public.get_user_tenant_id();
  v_date    date;
  v_memo    text := nullif(pg_catalog.btrim(p_entrada ->> 'memo'), '');
  v_asentar boolean := coalesce((p_entrada ->> 'asentar')::boolean, false);
  v_lineas  jsonb := p_entrada -> 'lineas';
  v_debe    numeric := 0;
  v_haber   numeric := 0;
  v_validas jsonb := '[]'::jsonb;
  v_guardado_debe  numeric;
  v_guardado_haber numeric;
  v_linea   jsonb;
  v_d       numeric;
  v_c       numeric;
  v_id      uuid := gen_random_uuid();
  v_code    text;
  v_motivo  text;
begin
  if v_tenant is null or not public.contabilidad_edicion_autorizada(v_tenant) then
    raise exception 'No tienes permiso para editar la contabilidad.' using errcode = '42501', hint = 'dtd-cierre';
  end if;
  begin
    v_date := (p_entrada ->> 'entry_date')::date;
  exception when others then
    raise exception 'La fecha del asiento no es válida.' using errcode = '22023', hint = 'dtd-cierre';
  end;
  if v_date is null then
    raise exception 'La fecha del asiento no es válida.' using errcode = '22023', hint = 'dtd-cierre';
  end if;
  if pg_catalog.jsonb_typeof(v_lineas) is distinct from 'array' or pg_catalog.jsonb_array_length(v_lineas) < 2 then
    raise exception 'Un asiento necesita al menos 2 líneas.' using errcode = '22023', hint = 'dtd-cierre';
  end if;
  for v_linea in select * from pg_catalog.jsonb_array_elements(v_lineas) loop
    v_d := coalesce((v_linea ->> 'debit')::numeric, 0);
    v_c := coalesce((v_linea ->> 'credit')::numeric, 0);
    -- Antes de cualquier comparación: en Postgres 'NaN' > 0 y NaN = NaN son
    -- verdaderos, y numeric(14,2) redondea al guardar. Un importe que no es un
    -- número finito con hasta 2 decimales no entra: 0.005 + 0.005 contra 0.01
    -- cuadraba aquí y se guardaba como 0.02 contra 0.01. El tope de
    -- numeric(14,2) deja afuera a Infinity y también a NaN, que Postgres ordena
    -- por encima de todo número. Los negativos los ataja la regla siguiente.
    if v_d > 999999999999.99 or v_c > 999999999999.99
       or v_d <> pg_catalog.round(v_d, 2) or v_c <> pg_catalog.round(v_c, 2) then
      raise exception 'Cada importe es un número de hasta 2 decimales.'
        using errcode = '22023', hint = 'dtd-cierre';
    end if;
    if v_d < 0 or v_c < 0 or (v_d > 0 and v_c > 0) or (v_d = 0 and v_c = 0) then
      raise exception 'Cada línea lleva debe o haber, positivo, y no los dos.' using errcode = '22023', hint = 'dtd-cierre';
    end if;
    if not exists (
      select 1 from public.accounts a
      where a.id = (v_linea ->> 'account_id')::uuid and a.tenant_id = v_tenant and a.is_postable
    ) then
      raise exception 'Una cuenta del asiento no existe o no recibe asientos.' using errcode = '22023', hint = 'dtd-cierre';
    end if;
    v_debe := v_debe + v_d;
    v_haber := v_haber + v_c;
    -- Se inserta lo que se validó, no el JSON de entrada.
    v_validas := v_validas || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'account_id', (v_linea ->> 'account_id')::uuid, 'debit', v_d, 'credit', v_c,
      'line_memo', nullif(pg_catalog.btrim(v_linea ->> 'line_memo'), '')));
  end loop;
  if v_debe <= 0 or v_debe <> v_haber then
    raise exception 'El asiento no balancea.' using errcode = '22023', hint = 'dtd-cierre';
  end if;

  v_code := public.next_entry_code(v_tenant);

  v_motivo := public.autorizar_excepcion_al_cierre(
    v_tenant, v_id, v_code, v_date, 'crear', p_clave, p_motivo, 0, v_debe);
  if v_motivo is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', pg_catalog.btrim(p_motivo), true);

  insert into public.journal_entries (id, tenant_id, entry_code, entry_date, memo, status, source, posted_at)
  values (v_id, v_tenant, v_code, v_date, v_memo,
    case when v_asentar then 'asentado' else 'borrador' end::public.entry_status, 'manual',
    case when v_asentar then pg_catalog.now() end);

  insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo)
  select v_id, (l ->> 'account_id')::uuid, (l ->> 'debit')::numeric, (l ->> 'credit')::numeric,
    l ->> 'line_memo'
  from pg_catalog.jsonb_array_elements(v_validas) l;

  -- Defensa en profundidad: lo guardado tiene que cuadrar igual que lo validado.
  select coalesce(sum(jl.debit), 0), coalesce(sum(jl.credit), 0)
    into v_guardado_debe, v_guardado_haber
  from public.journal_lines jl where jl.entry_id = v_id;
  if v_guardado_debe <> v_debe or v_guardado_haber <> v_haber then
    raise exception 'El asiento guardado no balancea.' using errcode = '22023', hint = 'dtd-cierre';
  end if;

  perform pg_catalog.set_config('dtd.excepcion_cierre', '', true);
  return pg_catalog.jsonb_build_object('ok', true, 'entry_id', v_id, 'entry_code', v_code);
end;
$function$;

-- Asentar un borrador de fecha cerrada.
create function public.asentar_asiento_en_cierre(p_entry_id uuid, p_clave text, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_entry  public.journal_entries%rowtype;
  v_debe   numeric;
  v_haber  numeric;
  v_lineas integer;
  v_motivo text;
begin
  if v_tenant is null or not public.contabilidad_edicion_autorizada(v_tenant) then
    raise exception 'No tienes permiso para editar la contabilidad.' using errcode = '42501', hint = 'dtd-cierre';
  end if;
  select * into v_entry from public.journal_entries e
  where e.id = p_entry_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if v_entry.status <> 'borrador' then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  select pg_catalog.round(coalesce(pg_catalog.sum(l.debit), 0), 2),
         pg_catalog.round(coalesce(pg_catalog.sum(l.credit), 0), 2), pg_catalog.count(*)
    into v_debe, v_haber, v_lineas
  from public.journal_lines l where l.entry_id = p_entry_id;
  if v_lineas < 2 or v_debe <= 0 or v_debe <> v_haber then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'descuadre');
  end if;

  v_motivo := public.autorizar_excepcion_al_cierre(
    v_tenant, v_entry.id, v_entry.entry_code, v_entry.entry_date, 'asentar', p_clave, p_motivo, 0, v_debe);
  if v_motivo is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', pg_catalog.btrim(p_motivo), true);
  update public.journal_entries
  set status = 'asentado', posted_at = pg_catalog.now()
  where id = v_entry.id;

  perform pg_catalog.set_config('dtd.excepcion_cierre', '', true);
  return pg_catalog.jsonb_build_object('ok', true, 'entry_id', v_entry.id);
end;
$function$;

-- Anular un asiento de fecha cerrada. El motivo es también el de la auditoría,
-- como void_journal_entry_with_audit_reason (0294).
create function public.anular_asiento_en_cierre(p_entry_id uuid, p_clave text, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_entry  public.journal_entries%rowtype;
  v_total  numeric;
  v_motivo text;
begin
  if v_tenant is null or not public.contabilidad_edicion_autorizada(v_tenant) then
    raise exception 'No tienes permiso para editar la contabilidad.' using errcode = '42501', hint = 'dtd-cierre';
  end if;
  select * into v_entry from public.journal_entries e
  where e.id = p_entry_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if v_entry.status <> 'asentado' then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  v_total := public.cierre_total_del_asiento(v_entry.id);

  v_motivo := public.autorizar_excepcion_al_cierre(
    v_tenant, v_entry.id, v_entry.entry_code, v_entry.entry_date, 'anular', p_clave, p_motivo, v_total, 0);
  if v_motivo is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', pg_catalog.btrim(p_motivo), true);
  update public.journal_entries set status = 'anulado' where id = v_entry.id;

  perform pg_catalog.set_config('dtd.excepcion_cierre', '', true);
  return pg_catalog.jsonb_build_object('ok', true, 'entry_id', v_entry.id);
end;
$function$;

-- Eliminar (soft delete) un borrador de fecha cerrada.
create function public.eliminar_borrador_en_cierre(p_entry_id uuid, p_clave text, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '1s'
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_entry  public.journal_entries%rowtype;
  v_total  numeric;
  v_motivo text;
begin
  if v_tenant is null or not public.contabilidad_edicion_autorizada(v_tenant) then
    raise exception 'No tienes permiso para editar la contabilidad.' using errcode = '42501', hint = 'dtd-cierre';
  end if;
  select * into v_entry from public.journal_entries e
  where e.id = p_entry_id and e.tenant_id = v_tenant and e.deleted_at is null
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if v_entry.status <> 'borrador' then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  v_total := public.cierre_total_del_asiento(v_entry.id);

  v_motivo := public.autorizar_excepcion_al_cierre(
    v_tenant, v_entry.id, v_entry.entry_code, v_entry.entry_date, 'eliminar', p_clave, p_motivo, v_total, 0);
  if v_motivo is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'motivo', v_motivo);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', pg_catalog.btrim(p_motivo), true);
  update public.journal_entries set deleted_at = pg_catalog.now() where id = v_entry.id;

  perform pg_catalog.set_config('dtd.excepcion_cierre', '', true);
  return pg_catalog.jsonb_build_object('ok', true, 'entry_id', v_entry.id);
end;
$function$;

comment on function public.crear_asiento_en_cierre(jsonb, text, text) is
  'SDD-0566: crea un asiento manual con fecha en período cerrado, con la excepción y su motivo. {ok, motivo?, entry_id?, entry_code?}.';
comment on function public.asentar_asiento_en_cierre(uuid, text, text) is
  'SDD-0566: asienta un borrador de período cerrado, con la excepción y su motivo. {ok, motivo?}.';
comment on function public.anular_asiento_en_cierre(uuid, text, text) is
  'SDD-0566: anula un asiento de período cerrado, con la excepción y su motivo (también de auditoría). {ok, motivo?}.';
comment on function public.eliminar_borrador_en_cierre(uuid, text, text) is
  'SDD-0566: elimina (soft delete) un borrador de período cerrado, con la excepción y su motivo. {ok, motivo?}.';

revoke all on function public.crear_asiento_en_cierre(jsonb, text, text) from public, anon, service_role;
revoke all on function public.asentar_asiento_en_cierre(uuid, text, text) from public, anon, service_role;
revoke all on function public.anular_asiento_en_cierre(uuid, text, text) from public, anon, service_role;
revoke all on function public.eliminar_borrador_en_cierre(uuid, text, text) from public, anon, service_role;
grant execute on function public.crear_asiento_en_cierre(jsonb, text, text) to authenticated;
grant execute on function public.asentar_asiento_en_cierre(uuid, text, text) to authenticated;
grant execute on function public.anular_asiento_en_cierre(uuid, text, text) to authenticated;
grant execute on function public.eliminar_borrador_en_cierre(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0493_cierre_contable_superclave.sql
-- ─────────────────────────────────────────────────────────────
