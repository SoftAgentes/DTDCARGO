-- ─────────────────────────────────────────────────────────────────────────────
-- 0475 · SDD-0515 — PIN de operarios endurecido: nadie lee pin_hash desde la
-- API, la matriz de módulos manda, cada alta y restablecimiento queda auditado
-- y no hay dos operarios activos con el mismo PIN en el mismo tenant y región.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Antes de
--    aplicar, el Director lee en producción, READ ONLY, los md5 de prosrc, las
--    ACL, las columnas y la policy que el preflight exige
--    (.agents/handoffs/0515-pin-operarios-endurecer.md). ORDEN: libre respecto
--    de la app; ningún código desplegado lee pin_hash con el cliente de usuario
--    ni depende de los símbolos nuevos. Fusionar la PR NO autoriza aplicarla.
--
-- ── El defecto ──────────────────────────────────────────────
-- 1. authenticated tiene SELECT de tabla sobre public.operario_pins (0021,
--    0023) y la única policy, «operario_pins select by admin of tenant», sólo
--    exige tenant_id = get_user_tenant_id(): cualquier miembro del personal del
--    tenant, con cualquier rol, lee pin_hash. Con 4 dígitos, el bcrypt se
--    revierte probando los 10.000 valores. Medido por el Director en el
--    catálogo de producción el 2026-10-14 17:36:43Z:
--    has_column_privilege('authenticated','public.operario_pins','pin_hash',
--    'select') = t. Los clientes del Portal no están expuestos (no tienen
--    membresía en user_tenants).
-- 2. admin_reset_operario_pin y admin_create_operario (0351) exigen el rol
--    admin|operations escrito a mano, mientras que la app decide con
--    moduleEditDenial(supabase, "operarios"): el default de ROLE_MODULE_ACCESS
--    (lib/studio/rbac.ts) más los desvíos por rol de
--    studio_role_module_overrides (0357). Un desvío que le quita Operarios a
--    operations no frena la RPC, y uno que se lo da a otro rol no la abre.
-- 3. Restablecer un PIN cambia una credencial y no deja rastro: no existe la
--    entidad 'operario' en audit_entity_types (AUD-01 §2).
-- 4. verify_operario_pin (0325) exige UNA sola coincidencia en tenant + región:
--    un PIN repetido entre dos operarios activos deja fuera a los dos.
-- 5. validate_operario_pin_format (0037) contesta con voseo («Elegí»).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- · operarios_module_authorized(tenant, 'view'|'edit'): el mismo patrón que
--   document_entity_authorized (0444) —membresía activa del auth.uid() en el
--   tenant, desvío de 0357 si existe, default de rbac.ts si no—, para el
--   módulo 'operarios'. Admin siempre; support nunca edita. Es la regla de
--   canAccessModule/canEditModule; 'operarios' no es LOCKED, no tiene lado de
--   almacén ni es de superadmin, así que moduleEditDenial no agrega otra.
--   ⚠️ El default ['operations'] queda DUPLICADO aquí y en rbac.ts, el mismo
--   trade-off que aceptó 0357; rbac.test.ts es la fuente. Si cambia
--   ROLE_MODULE_ACCESS.operarios, hace falta una migración hermana; la prueba
--   lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts lo exige.
-- · La policy SELECT de operario_pins pasa a exigir además ese permiso de
--   vista. El SELECT de tabla de authenticated y de service_role pasa a ser por
--   columna: todas menos pin_hash. pin_hash sólo lo leen las funciones SECURITY
--   DEFINER (el login y las de alta y restablecimiento). Las columnas futuras
--   no quedan concedidas solas.
-- · admin_reset_operario_pin y admin_create_operario se reescriben desde su
--   última definición (0351): el candado de rol de primero pasa a ser la
--   matriz; después del formato, operario_pin_assert_available() toma un lock
--   transaccional por (tenant, región) y rechaza con P0018 un PIN que coincida
--   con otro operario ACTIVO del mismo tenant y región; y el evento de
--   auditoría se escribe en la misma transacción, sin el PIN ni el hash: si no
--   se escribe, el PIN no cambia y el operario no se crea.
-- · audit_entity_types gana 'operario' (dominio access).
-- · validate_operario_pin_format se reescribe desde 0037 con «Elige» y con el
--   search_path = public que le puso 0210.
--
-- ── Qué NO cambia ───────────────────────────────────────────
-- verify_operario_pin (0325), admin_set_operario_active y admin_update_operario
-- (0351, siguen con admin|operations escrito a mano), assert_studio_role y las
-- escrituras de service_role. No se lee ni se toca ninguna fila de operarios.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si el md5(prosrc) (CRLF→LF) de cada función
-- reemplazada no es el de su última definición en el repo ni el de esta
-- migración; si las dependencias (get_user_tenant_id 0453, assert_tenant_match
-- 0012, verify_operario_pin 0325, append_audit_event 0294) no son las
-- esperadas; si operario_pins no tiene exactamente sus 14 columnas, RLS
-- activa sin FORCE, una sola policy (la de 0021 o la de 0475) y la ACL de
-- origen o la final; o si 'operario' ya está en el catálogo con otra forma.
-- Re-aplicarla no cambia nada. El postflight exige los cuerpos de 0475, la
-- ACL por columna, la policy, el catálogo y EXECUTE de las funciones.
-- LOCKS: ACCESS EXCLUSIVE sobre operario_pins por DROP/CREATE POLICY y por los
-- GRANT, hasta el COMMIT (milisegundos; el login espera, no falla, dentro del
-- lock_timeout de 5 s). Ninguna fila tocada salvo la del catálogo.
-- ROLLBACK: los create or replace de 0351 (admin_create_operario,
-- admin_reset_operario_pin) y de 0037 (con set search_path = public); revoke
-- del SELECT por columna y grant select de tabla a authenticated y
-- service_role; drop de la policy nueva y create de la de 0021; drop de
-- operario_pin_assert_available y de operarios_module_authorized. La fila
-- 'operario' de audit_entity_types se conserva: el catálogo no se borra.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_pins oid := pg_catalog.to_regclass('public.operario_pins');
  v_auth oid := pg_catalog.to_regrole('authenticated');
  v_service oid := pg_catalog.to_regrole('service_role');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_expected record;
  v_columns text[];
  v_policy record;
  v_fresh boolean;
begin
  if v_auth is null or v_service is null or v_anon is null
     or exists (select 1 from pg_catalog.pg_roles r
       where r.oid in (v_auth, v_anon) and (r.rolsuper or r.rolbypassrls)) then
    raise exception '0475 abortado: roles API ausentes o con privilegios de superusuario';
  end if;

  -- operario_pins: tabla con RLS sin FORCE (las funciones DEFINER la leen como
  -- dueño) y exactamente sus 14 columnas, para que el grant por columna no deje
  -- una afuera ni conceda una que no se revisó.
  if not exists (select 1 from pg_catalog.pg_class c
    where c.oid = v_pins and c.relkind = 'r' and c.relrowsecurity and not c.relforcerowsecurity) then
    raise exception '0475 abortado: public.operario_pins no existe o su RLS no es la esperada';
  end if;
  select pg_catalog.array_agg(a.attname::text order by a.attname) into v_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_pins and a.attnum > 0 and not a.attisdropped;
  if v_columns is distinct from array['active', 'created_at', 'display_name', 'display_name_cn',
      'id', 'last_login_at', 'pin_hash', 'region', 'role', 'roles', 'tenant_id', 'tms_driver_id',
      'updated_at', 'warehouse_id']::text[] then
    raise exception '0475 abortado: operario_pins no tiene exactamente sus 14 columnas (%)', v_columns;
  end if;
  if (select pg_catalog.array_agg(e.enumlabel::text order by e.enumsortorder)
      from pg_catalog.pg_enum e where e.enumtypid = pg_catalog.to_regtype('public.operario_region'))
     is distinct from array['cn', 've']::text[] then
    raise exception '0475 abortado: el enum operario_region no es (cn, ve)';
  end if;

  -- Una sola policy: la de 0021 (origen) o la de esta migración (re-aplicar).
  -- Cualquier otra podría reabrir la lectura por OR.
  if (select pg_catalog.count(*) from pg_catalog.pg_policy p where p.polrelid = v_pins) <> 1 then
    raise exception '0475 abortado: operario_pins no tiene exactamente una policy';
  end if;
  select p.polname, p.polcmd, p.polroles, p.polpermissive,
    pg_catalog.regexp_replace(pg_catalog.replace(coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ''),
      'public.', ''), '[\s()]', '', 'g') as qual
    into v_policy
  from pg_catalog.pg_policy p where p.polrelid = v_pins;
  v_fresh := v_policy.polname = 'operario_pins select by admin of tenant';
  if not v_policy.polpermissive or v_policy.polcmd <> 'r' or v_policy.polroles <> array[v_auth]::oid[]
     or not (
       (v_fresh and v_policy.qual = 'tenant_id=get_user_tenant_id')
       or (v_policy.polname = 'operario_pins select by operarios module'
           and v_policy.qual = 'tenant_id=SELECTget_user_tenant_idASget_user_tenant_idANDSELECToperarios_module_authorizedSELECTget_user_tenant_idASget_user_tenant_id,''view''::textASoperarios_module_authorized')
     ) then
    raise exception '0475 abortado: la policy de operario_pins no es la de 0021 ni la de 0475';
  end if;

  -- ACL: anon y PUBLIC sin nada; authenticated sólo SELECT (de tabla en el
  -- origen, por columna al re-aplicar); service_role escribe y lee.
  if exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = v_pins and a.grantee in (0, v_anon))
     or exists (select 1 from pg_catalog.pg_attribute att cross join lateral pg_catalog.aclexplode(att.attacl) a
      where att.attrelid = v_pins and a.grantee in (0, v_anon))
     or pg_catalog.has_table_privilege(v_auth, v_pins, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or not pg_catalog.has_table_privilege(v_service, v_pins, 'INSERT')
     or not pg_catalog.has_table_privilege(v_service, v_pins, 'UPDATE')
     or not pg_catalog.has_table_privilege(v_service, v_pins, 'DELETE') then
    raise exception '0475 abortado: la ACL de operario_pins no es la esperada';
  end if;
  if v_fresh then
    if not pg_catalog.has_table_privilege(v_auth, v_pins, 'SELECT')
       or not pg_catalog.has_table_privilege(v_service, v_pins, 'SELECT')
       or exists (select 1 from pg_catalog.pg_attribute att where att.attrelid = v_pins and att.attacl is not null) then
      raise exception '0475 abortado: el SELECT de origen de operario_pins no es de tabla';
    end if;
  elsif pg_catalog.has_column_privilege(v_auth, v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_column_privilege(v_service, v_pins, 'pin_hash', 'SELECT') then
    raise exception '0475 abortado: re-aplicación con pin_hash legible';
  end if;

  -- Funciones que se reemplazan: el cuerpo de su última definición en el repo
  -- o el de esta migración. Las nuevas: ausentes o con el cuerpo de 0475.
  for v_expected in select * from (values
    ('public.admin_create_operario(uuid,uuid,text,text,text,text)',
      array['f7e89f156817fc3d30eb4635090b0603',   -- 0351
            '664d6f43b2c38f2ecfc57834f2d5285e'],  -- 0475
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.admin_reset_operario_pin(uuid,text)',
      array['ea358b166dbd5c90dff337d473649da3',   -- 0351
            '9de66730a6786a5e51045579bb1835ba'],  -- 0475
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.validate_operario_pin_format(text)',
      array['62f64d916edf371cb7a2b8d4b784c18d',   -- 0037 (+ search_path de 0210)
            '5d21a590c47cc39ae99f2f853aedae82'],  -- 0475
      false, 'i', array['search_path=public']::text[]),
    -- Dependencias que no se reemplazan: la regla nueva se apoya en ellas.
    ('public.get_user_tenant_id()', array['5ff0c51c26a49419c34abc78f1d95c37'], true, 's',
      array['search_path=""']::text[]),                                  -- 0453
    ('public.assert_tenant_match(uuid)', array['bf5e898bc3a6209c0a5dc75f89ba9333'], true, 'v',
      array['search_path=public']::text[]),                              -- 0012
    ('public.verify_operario_pin(text,uuid,public.operario_region,text)',
      array['99c5f3e9eaae92bfe3987e1377d4734f'], true, 'v',
      array['search_path=public, extensions']::text[])                   -- 0325
  ) e(signature, bodies, definer, volatility, config) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = any (v_expected.bodies)
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = v_expected.config) then
      raise exception '0475 abortado: % tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)',
        v_expected.signature;
    end if;
  end loop;
  for v_expected in select * from (values
    ('public.operarios_module_authorized(uuid,text)', '299f276babe7177556c5d2105d45b2c0'),
    ('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', '9188d650ed78acafc732883df09d14a7')
  ) e(signature, body) loop
    if pg_catalog.to_regprocedure(v_expected.signature) is not null and not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body) then
      raise exception '0475 abortado: % ya existe con otro cuerpo', v_expected.signature;
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.admin_reset_operario_pin(uuid,text)')
      and pg_catalog.has_function_privilege(v_auth, p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege(v_anon, p.oid, 'EXECUTE'))
     or not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.admin_create_operario(uuid,uuid,text,text,text,text)')
      and pg_catalog.has_function_privilege(v_auth, p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege(v_anon, p.oid, 'EXECUTE')) then
    raise exception '0475 abortado: EXECUTE de las RPC de operario no es el de 0351';
  end if;

  -- Overrides de 0357: forma y candados que la regla da por ciertos. Sin leer filas.
  if pg_catalog.to_regclass('public.studio_role_module_overrides') is null
     or pg_catalog.has_table_privilege(v_auth, 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or pg_catalog.has_table_privilege(v_anon, 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception '0475 abortado: falta studio_role_module_overrides o su escritura está expuesta a la API';
  end if;
  for v_expected in select * from (values
    ('studio_role_module_overrides_pkey', 'PRIMARY KEY (tenant_id, role, module_id)'),
    ('studio_role_module_overrides_edit_implies_view', 'CHECK (((NOT can_edit) OR can_view))'),
    ('studio_role_module_overrides_role_check', 'CHECK ((role = ANY (ARRAY[''commercial''::text, ''operations''::text, ''accounting''::text, ''warehouse''::text, ''support''::text, ''marketing''::text])))')
  ) e(name, definition) loop
    if not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid = pg_catalog.to_regclass('public.studio_role_module_overrides')
        and c.conname = v_expected.name and c.convalidated
        and pg_catalog.pg_get_constraintdef(c.oid) = v_expected.definition) then
      raise exception '0475 abortado: constraint de overrides con drift: %', v_expected.name;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.studio_role_module_overrides')
        and a.attname in ('tenant_id', 'role', 'module_id', 'can_view', 'can_edit')
        and a.attnotnull and not a.attisdropped) <> 5 then
    raise exception '0475 abortado: columnas o NOT NULL de overrides con drift';
  end if;

  -- Auditoría: writer 0267/0294 con dueño y contexto seguros, y el catálogo.
  if pg_catalog.to_regclass('public.entity_audit_log') is null
     or pg_catalog.to_regclass('public.audit_entity_types') is null
     or not exists (select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)')
         and p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole
         and p.proconfig = array['search_path=""']::text[]
         and not pg_catalog.has_function_privilege(v_auth, p.oid, 'EXECUTE')) then
    raise exception '0475 abortado: falta el writer de auditoría 0267/0294 o no conserva dueño y contexto';
  end if;
  if exists (select 1 from public.audit_entity_types t
    where t.entity_type = 'operario'
      and not (t.status = 'active' and t.domain_code = 'access' and t.introduced_by_ref = 'migration:0475')) then
    raise exception '0475 abortado: el tipo de auditoría operario ya existe con otra forma; revisar su procedencia';
  end if;
end;
$preflight$;

-- ── 1. Catálogo de auditoría ─────────────────────────────────
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('operario', 'active', 'access', 1, 'migration:0475')
on conflict (entity_type) do nothing;

-- ── 2. La regla de la app, en la base ────────────────────────
-- Mismo cuerpo que document_entity_authorized (0444) con el contrato fijo del
-- módulo 'operarios'. El default es ROLE_MODULE_ACCESS.operarios de rbac.ts.
create or replace function public.operarios_module_authorized(
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with normalized as (
    select pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), contract as (
    select 'operarios'::text as module_id, array['operations']::text[] as default_roles
  ), decision as (
    select n.access, m.role, c.default_roles, o.can_view, o.can_edit
    from normalized n
    cross join membership m
    cross join contract c
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.role = 'admin' then true
      when d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else false
    end
    from decision d
  ), false)
$function$;

comment on function public.operarios_module_authorized(uuid, text) is
  'SDD-0515: ¿el auth.uid() puede ver (view) o editar (edit) el módulo Operarios en el tenant? Misma regla que canAccessModule/canEditModule de rbac.ts: admin siempre, support nunca edita, desvío de studio_role_module_overrides (0357) si existe, si no el default [operations]. El default está duplicado con rbac.ts; rbac.test.ts es la fuente.';

revoke all on function public.operarios_module_authorized(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.operarios_module_authorized(uuid, text) to authenticated, service_role;

-- ── 3. PIN libre en el tenant y la región ────────────────────
-- Privada: sólo la llaman las RPC DEFINER, como su dueño. Recibe el PIN en
-- claro porque es la única forma de compararlo con un bcrypt con sal propia.
create or replace function public.operario_pin_assert_available(
  p_tenant_id uuid,
  p_region public.operario_region,
  p_pin text,
  p_except_id uuid
) returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  -- Hasta el COMMIT: dos altas o restablecimientos concurrentes del mismo
  -- tenant y región con el mismo PIN no se cruzan sin verse.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'operario_pin:' || p_tenant_id::text || ':' || p_region::text, 0));
  if exists (
    select 1
    from public.operario_pins op
    where op.tenant_id = p_tenant_id
      and op.region = p_region
      and op.active
      and op.id is distinct from p_except_id
      and op.pin_hash = extensions.crypt(p_pin, op.pin_hash)
  ) then
    raise exception 'Ese PIN ya lo usa otro operario activo de la misma región. Usa otro o genera uno nuevo.'
      using errcode = 'P0018';
  end if;
end;
$function$;

comment on function public.operario_pin_assert_available(uuid, public.operario_region, text, uuid) is
  'SDD-0515: rechaza con P0018 un PIN que coincide con otro operario ACTIVO del mismo tenant y región (verify_operario_pin exige una sola coincidencia). Toma un advisory lock transaccional por (tenant, región). Sin EXECUTE para roles de API.';

revoke all on function public.operario_pin_assert_available(uuid, public.operario_region, text, uuid)
  from public, anon, authenticated, service_role;

-- ── 4. Formato del PIN: 0037 con tuteo y el search_path de 0210 ──
create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
set search_path = public
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elige uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

-- ── 5. Alta de operario: 0351 + matriz, PIN libre y auditoría ──
create or replace function public.admin_create_operario(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_display_name text,
  p_display_name_cn text,
  p_pin text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_region public.operario_region;
  v_event uuid;
begin
  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
  perform public.assert_tenant_match(p_tenant_id);
  perform public.validate_operario_pin_format(p_pin);

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Nombre requerido' using errcode = 'P0011';
  end if;
  if p_role not in ('operario', 'supervisor') then
    raise exception 'Rol inválido (operario | supervisor)' using errcode = 'P0012';
  end if;

  insert into public.operario_pins (
    tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role
  ) values (
    p_tenant_id, p_warehouse_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_display_name_cn, '')), ''),
    crypt(p_pin, gen_salt('bf')),
    p_role
  )
  returning id, region into v_id, v_region;

  perform public.operario_pin_assert_available(p_tenant_id, v_region, p_pin, v_id);

  -- AUD-01: el evento nace en esta transacción y sin el PIN ni el hash.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id => p_tenant_id,
    p_entity_type => 'operario',
    p_entity_id => v_id,
    p_actor_type => 'user',
    p_actor_id => auth.uid(),
    p_event_type => 'operario_created',
    p_source => 'rpc',
    p_result => 'succeeded',
    p_reason => null,
    p_before_data => null,
    p_after_data => pg_catalog.jsonb_build_object('credential', 'pin', 'region', v_region,
      'role', p_role, 'warehouse_id', p_warehouse_id, 'active', true),
    p_payload => '{}'::jsonb,
    p_correlation_id => 'operario_created:' || pg_catalog.gen_random_uuid()::text,
    p_schema_version => 1,
    p_sensitivity => 'restricted'
  );
  if v_event is null then
    raise exception 'No se pudo auditar el alta del operario' using errcode = 'P0001';
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un operario con ese nombre en ese warehouse'
      using errcode = 'P0013';
end;
$$;

-- ── 6. Restablecer PIN: 0351 + matriz, PIN libre y auditoría ──
create or replace function public.admin_reset_operario_pin(
  p_operario_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
  v_region public.operario_region;
  v_active boolean;
  v_event uuid;
begin
  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;

  select op.tenant_id, op.region, op.active into v_tenant_id, v_region, v_active
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;

  perform public.assert_tenant_match(v_tenant_id);
  perform public.validate_operario_pin_format(p_pin);
  perform public.operario_pin_assert_available(v_tenant_id, v_region, p_pin, p_operario_id);

  update public.operario_pins
     set pin_hash = crypt(p_pin, gen_salt('bf'))
   where id = p_operario_id;

  -- AUD-01: el evento nace en esta transacción y sin el PIN ni el hash.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id => v_tenant_id,
    p_entity_type => 'operario',
    p_entity_id => p_operario_id,
    p_actor_type => 'user',
    p_actor_id => auth.uid(),
    p_event_type => 'operario_pin_reset',
    p_source => 'rpc',
    p_result => 'succeeded',
    p_reason => null,
    p_before_data => null,
    p_after_data => pg_catalog.jsonb_build_object('credential', 'pin', 'region', v_region,
      'active', v_active),
    p_payload => '{}'::jsonb,
    p_correlation_id => 'operario_pin_reset:' || pg_catalog.gen_random_uuid()::text,
    p_schema_version => 1,
    p_sensitivity => 'restricted'
  );
  if v_event is null then
    raise exception 'No se pudo auditar el restablecimiento del PIN' using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.admin_create_operario(uuid, uuid, text, text, text, text) is
  'Crea un operario del tenant del caller. SDD-0515: autoriza con la matriz de módulos (operarios_module_authorized), rechaza con P0018 un PIN de otro operario activo del mismo tenant y región, y audita operario_created en la misma transacción sin el PIN.';
comment on function public.admin_reset_operario_pin(uuid, text) is
  'Restablece el PIN de un operario del tenant del caller. SDD-0515: autoriza con la matriz de módulos (operarios_module_authorized), rechaza con P0018 un PIN de otro operario activo del mismo tenant y región, y audita operario_pin_reset en la misma transacción sin el PIN.';

-- `create or replace` conserva la ACL; se repite la de 0351 para leer el archivo solo.
revoke all on function public.admin_create_operario(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_create_operario(uuid, uuid, text, text, text, text) to authenticated;
revoke all on function public.admin_reset_operario_pin(uuid, text) from public, anon;
grant execute on function public.admin_reset_operario_pin(uuid, text) to authenticated;

-- ── 7. Lectura: matriz en la policy y pin_hash fuera de la API ──
drop policy if exists "operario_pins select by admin of tenant" on public.operario_pins;
drop policy if exists "operario_pins select by operarios module" on public.operario_pins;
create policy "operario_pins select by operarios module"
  on public.operario_pins for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.operarios_module_authorized((select public.get_user_tenant_id()), 'view'))
  );

-- Revocar el SELECT de tabla revoca también los de columna: re-aplicar deja lo mismo.
revoke select on table public.operario_pins from authenticated, service_role;
grant select (id, tenant_id, warehouse_id, region, display_name, display_name_cn, role, roles,
  active, last_login_at, created_at, updated_at, tms_driver_id)
  on table public.operario_pins to authenticated, service_role;

do $postflight$
declare
  v_pins oid := pg_catalog.to_regclass('public.operario_pins');
  v_expected record;
  v_column text;
begin
  for v_expected in select * from (values
    ('public.admin_create_operario(uuid,uuid,text,text,text,text)', '664d6f43b2c38f2ecfc57834f2d5285e',
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.admin_reset_operario_pin(uuid,text)', '9de66730a6786a5e51045579bb1835ba',
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.validate_operario_pin_format(text)', '5d21a590c47cc39ae99f2f853aedae82',
      false, 'i', array['search_path=public']::text[]),
    ('public.operarios_module_authorized(uuid,text)', '299f276babe7177556c5d2105d45b2c0',
      true, 's', array['search_path=""']::text[]),
    ('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', '9188d650ed78acafc732883df09d14a7',
      false, 'v', array['search_path=""']::text[])
  ) e(signature, body, definer, volatility, config) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = v_expected.config) then
      raise exception '0475: postflight — % no quedó con el cuerpo, DEFINER, volatilidad o search_path de 0475',
        v_expected.signature;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege('authenticated', 'public.admin_create_operario(uuid,uuid,text,text,text,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.admin_reset_operario_pin(uuid,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.operarios_module_authorized(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.admin_create_operario(uuid,uuid,text,text,text,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.admin_reset_operario_pin(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.operarios_module_authorized(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', 'EXECUTE')
     or exists (select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) a
       where p.oid in (pg_catalog.to_regprocedure('public.admin_create_operario(uuid,uuid,text,text,text,text)'),
                       pg_catalog.to_regprocedure('public.admin_reset_operario_pin(uuid,text)'),
                       pg_catalog.to_regprocedure('public.operarios_module_authorized(uuid,text)'),
                       pg_catalog.to_regprocedure('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)'))
         and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception '0475: postflight — EXECUTE de las funciones de operario no es el esperado';
  end if;

  -- pin_hash: ni authenticated ni service_role ni anon; el resto, legible por
  -- authenticated y service_role sólo por columna.
  if pg_catalog.has_column_privilege('authenticated', v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_column_privilege('service_role', v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_column_privilege('anon', v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', v_pins, 'SELECT')
     or pg_catalog.has_table_privilege('service_role', v_pins, 'SELECT')
     or pg_catalog.has_any_column_privilege('anon', v_pins, 'SELECT') then
    raise exception '0475: postflight — pin_hash sigue legible o el SELECT sigue siendo de tabla';
  end if;
  foreach v_column in array array['id', 'tenant_id', 'warehouse_id', 'region', 'display_name',
    'display_name_cn', 'role', 'roles', 'active', 'last_login_at', 'created_at', 'updated_at', 'tms_driver_id'] loop
    if not pg_catalog.has_column_privilege('authenticated', v_pins, v_column, 'SELECT')
       or not pg_catalog.has_column_privilege('service_role', v_pins, v_column, 'SELECT') then
      raise exception '0475: postflight — falta el SELECT de %', v_column;
    end if;
  end loop;
  if not pg_catalog.has_table_privilege('service_role', v_pins, 'INSERT')
     or not pg_catalog.has_table_privilege('service_role', v_pins, 'UPDATE')
     or not pg_catalog.has_table_privilege('service_role', v_pins, 'DELETE') then
    raise exception '0475: postflight — service_role perdió la escritura de operario_pins';
  end if;

  if (select pg_catalog.count(*) from pg_catalog.pg_policy p where p.polrelid = v_pins) <> 1
     or not exists (select 1 from pg_catalog.pg_policy p
       where p.polrelid = v_pins and p.polname = 'operario_pins select by operarios module'
         and p.polcmd = 'r' and p.polpermissive
         and p.polroles = array[pg_catalog.to_regrole('authenticated')]::oid[]
         and pg_catalog.regexp_replace(pg_catalog.replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid),
           'public.', ''), '[\s()]', '', 'g')
           = 'tenant_id=SELECTget_user_tenant_idASget_user_tenant_idANDSELECToperarios_module_authorizedSELECTget_user_tenant_idASget_user_tenant_id,''view''::textASoperarios_module_authorized') then
    raise exception '0475: postflight — la policy de operario_pins no es la de 0475';
  end if;

  if not exists (select 1 from public.audit_entity_types t
    where t.entity_type = 'operario' and t.status = 'active' and t.domain_code = 'access'
      and t.introduced_by_ref = 'migration:0475') then
    raise exception '0475: postflight — falta el tipo de auditoría operario';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0475_pin_operarios_endurecer.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0475_pin_operarios_endurecer. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
