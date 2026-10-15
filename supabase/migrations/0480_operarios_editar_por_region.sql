-- ─────────────────────────────────────────────────────────────────────────────
-- 0480 · SDD-0529 — Editar operarios de Venezuela: el rol se elige entre los de
-- la región del operario, el almacén de China sólo va con los de China, el
-- cambio de rol arrastra sus modos de la app y nada cambia en silencio; la
-- edición autoriza con la matriz de módulos y queda en la auditoría.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Antes de
--    aplicar, el Director lee en producción, READ ONLY, los md5 de prosrc, las
--    constraints de operario_pins y la ACL que el preflight exige
--    (.agents/handoffs/0529-operarios-venezuela-editar.md).
--    ORDEN: MIGRATE-FIRST. La app nueva lee operario_roles_por_region() para
--    armar el selector de rol y manda a admin_update_operario los roles de
--    Venezuela y el almacén vacío: sin esta migración el cajón «Editar» no
--    ofrece roles y no deja guardar a nadie. Con la migración y la app de
--    antes, los de China se siguen editando igual (sus roles y su almacén son
--    los mismos) y los de Venezuela siguen sin poder guardarse, como hoy.
--    Fusionar la PR NO autoriza aplicarla.
--
-- ── El defecto ──────────────────────────────────────────────
-- 1. admin_update_operario (0351) sólo acepta los roles 'operario' y
--    'supervisor': un operario de Venezuela (bodeguero o camionero, 0025) no se
--    puede guardar desde el Studio sin perder su rol. La app, además, exigía un
--    almacén de China, que los de Venezuela no tienen.
-- 2. Cambiaba la columna role y dejaba roles[] como estaba. Desde 0066 la app
--    del teléfono decide los modos con roles[] (lib/auth/operario-session.ts,
--    0067, 0328): editar el rol de un camionero a bodeguero no le cambiaba lo
--    que puede hacer en /m/ve.
-- 3. Ponía el almacén que llegara, sin mirar la región ni si existe o está
--    activo; y no validaba el nombre contra repetidos con un mensaje propio.
-- 4. Autorizaba con admin|operations escrito a mano (0351), mientras la app y
--    las otras RPC de Operarios (0475) deciden con la matriz de módulos; y no
--    dejaba evento (AUD-01 §2: cambio de roles y acceso).
--
-- ── La regla del rol, derivada de la base ───────────────────
-- operario_roles_por_region() es la ÚNICA fuente: la usa esta RPC para validar
-- y el Studio la lee para armar el selector (lib/studio/operario-queries.ts).
-- · operario_pins_role_check (0020, 0025): los cuatro roles.
-- · operario_pins_ve_role_requires_ve_region (0025): bodeguero y camionero sólo
--   en Venezuela; por eso China = operario y supervisor.
-- · Venezuela = bodeguero, camionero y supervisor: las RPC de despacho aceptan
--   supervisor junto a bodeguero o camionero (0184, 0328, 0067/0072) y el login
--   de /m/ve lo manda a la app de bodeguero. 'operario' en Venezuela lo admite
--   el CHECK, pero ninguna RPC de /m/ve lo acepta: entraría a una app donde no
--   puede hacer nada. No se ofrece; uno que ya lo tenga tiene que elegir otro
--   rol para guardar (no se le cambia solo).
-- El preflight exige esas constraints tal cual: si cambian, esta regla se
-- revisa en una migración nueva.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- · operario_roles_por_region(): jsonb {"cn": [...], "ve": [...]}, IMMUTABLE,
--   sin search_path, EXECUTE sólo para authenticated (el Studio la lee).
-- · admin_update_operario, reescrita desde su última definición (0351), con la
--   misma firma y search_path vacío:
--   - la matriz de primero (operarios_module_authorized, 0475), como alta,
--     restablecimiento y «Ver PIN»: sin permiso no hay oráculo de ids;
--   - lee la fila con FOR UPDATE: lo de antes del evento es lo que se cambia;
--   - el rol tiene que estar en operario_roles_por_region() de SU región (la
--     de la fila, no la del formulario); nunca hay un rol por defecto;
--   - roles[] sigue al rol si el operario tiene un solo modo; si tiene varios,
--     el rol tiene que ser uno de ellos y roles[] no cambia;
--   - China: almacén obligatorio, existente y activo (o el mismo que ya tenía,
--     aunque se haya desactivado). Venezuela: sin almacén;
--   - nombre obligatorio y sin repetir en el almacén (P0013);
--   - si nada cambia, no escribe ni deja evento;
--   - evento operario_updated en la misma transacción: rol, modos, almacén y
--     región antes y después, y la lista de campos cambiados; los nombres no
--     se copian al evento (AUD-01 §5: basta el id). Sin motivo obligatorio,
--     como membership_role_changed de D1 (0289).
--
-- ── Qué NO cambia ───────────────────────────────────────────
-- admin_set_operario_active (0475) conserva admin|operations escrito a mano y
-- sigue sin evento: desactivar es revocar un acceso y, con el precedente de
-- D1, pediría un motivo (decisión aparte). Alta, restablecimiento, «Ver PIN»,
-- el login (verify_operario_pin) y las filas de operarios no se tocan.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si admin_update_operario no tiene el cuerpo de 0351
-- (o el de esta migración al re-aplicar); si falta 0475 (la matriz y la
-- entidad operario); si las dependencias (get_user_tenant_id 0453,
-- assert_tenant_match 0012, append_audit_event 0294) no son las esperadas; si
-- operario_pins no tiene sus constraints de rol, región, almacén y modos; si el
-- enum de región no es (cn, ve); o si hay sobrecargas. Re-aplicarla no cambia
-- nada. El postflight exige los cuerpos, las firmas, el EXECUTE y el valor de
-- operario_roles_por_region().
-- LOCKS: ninguno sobre tablas (create or replace function y comentarios).
-- ROLLBACK: create or replace de admin_update_operario de 0351 (con
-- search_path = public) y drop de operario_roles_por_region(). El EXECUTE de
-- admin_update_operario queda como el de 0351.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_pins oid := pg_catalog.to_regclass('public.operario_pins');
  v_auth oid := pg_catalog.to_regrole('authenticated');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_fresh boolean := pg_catalog.to_regprocedure('public.operario_roles_por_region()') is null;
  v_expected record;
begin
  if v_auth is null or v_anon is null
     or exists (select 1 from pg_catalog.pg_roles r
       where r.oid in (v_auth, v_anon) and (r.rolsuper or r.rolbypassrls)) then
    raise exception '0480 abortado: roles API ausentes o con privilegios de superusuario';
  end if;

  -- Firmas: una sola de cada una; operario_roles_por_region sólo al re-aplicar.
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.pronamespace = 'public'::pg_catalog.regnamespace and p.proname = 'admin_update_operario') <> 1
     or (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.pronamespace = 'public'::pg_catalog.regnamespace and p.proname = 'operario_roles_por_region')
        <> (case when v_fresh then 0 else 1 end) then
    raise exception '0480 abortado: hay sobrecargas inesperadas de admin_update_operario u operario_roles_por_region';
  end if;

  -- Cuerpos: lo que se reemplaza (0351 o, al re-aplicar, 0480) y aquello en lo
  -- que la regla nueva se apoya (0475, 0453, 0012).
  for v_expected in select * from (values
    ('public.admin_update_operario(uuid,text,text,text,uuid)',
      case when v_fresh then '60bff5cc39274ac889d9cc05d9ebd344'          -- 0351
        else '3eed656106674ff1d1b6c79dcde60f86' end,                     -- 0480
      true, 'v',
      case when v_fresh then array['search_path=public']::text[] else array['search_path=""']::text[] end),
    ('public.operarios_module_authorized(uuid,text)', '299f276babe7177556c5d2105d45b2c0', -- 0475
      true, 's', array['search_path=""']::text[]),
    ('public.get_user_tenant_id()', '5ff0c51c26a49419c34abc78f1d95c37',                  -- 0453
      true, 's', array['search_path=""']::text[]),
    ('public.assert_tenant_match(uuid)', 'bf5e898bc3a6209c0a5dc75f89ba9333',             -- 0012
      true, 'v', array['search_path=public']::text[])
  ) e(signature, body, definer, volatility, config) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = v_expected.config) then
      raise exception '0480 abortado: % tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)',
        v_expected.signature;
    end if;
  end loop;
  if not v_fresh and not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.operario_roles_por_region()')
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = '47cad29a421017704ba6630b4f712d9c'
        and not p.prosecdef and p.provolatile = 'i'
        and p.proconfig = array['search_path=""']::text[]) then
    raise exception '0480 abortado: public.operario_roles_por_region() tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)';
  end if;
  if not pg_catalog.has_function_privilege(v_auth, 'public.admin_update_operario(uuid,text,text,text,uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege(v_anon, 'public.admin_update_operario(uuid,text,text,text,uuid)', 'EXECUTE') then
    raise exception '0480 abortado: EXECUTE de admin_update_operario no es el esperado';
  end if;

  -- operario_pins: la región es (cn, ve) y las constraints de las que sale la
  -- regla del rol, del almacén y de los modos son las de 0020/0023/0025/0066.
  if v_pins is null
     or (select pg_catalog.array_agg(e.enumlabel::text order by e.enumsortorder)
         from pg_catalog.pg_enum e where e.enumtypid = pg_catalog.to_regtype('public.operario_region'))
        is distinct from array['cn', 've']::text[] then
    raise exception '0480 abortado: falta operario_pins o el enum operario_region no es (cn, ve)';
  end if;
  for v_expected in select * from (values
    ('operario_pins_role_check',
      'CHECK ((role = ANY (ARRAY[''operario''::text, ''supervisor''::text, ''bodeguero''::text, ''camionero''::text])))'),
    ('operario_pins_ve_role_requires_ve_region',
      'CHECK (((region = ''ve''::operario_region) OR (role <> ALL (ARRAY[''bodeguero''::text, ''camionero''::text]))))'),
    ('operario_pins_cn_requires_warehouse',
      'CHECK (((region <> ''cn''::operario_region) OR (warehouse_id IS NOT NULL)))'),
    ('operario_pins_roles_check',
      'CHECK ((roles <@ ARRAY[''operario''::text, ''supervisor''::text, ''bodeguero''::text, ''camionero''::text]))')
  ) e(name, definition) loop
    if not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid = v_pins and c.conname = v_expected.name and c.contype = 'c' and c.convalidated
        and pg_catalog.replace(pg_catalog.pg_get_constraintdef(c.oid), 'public.', '') = v_expected.definition) then
      raise exception '0480 abortado: la constraint % de operario_pins no es la esperada', v_expected.name;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_attribute a
      where a.attrelid = v_pins and not a.attisdropped
        and (a.attname, a.atttypid) in (
          ('display_name', 'pg_catalog.text'::pg_catalog.regtype),
          ('display_name_cn', 'pg_catalog.text'::pg_catalog.regtype),
          ('role', 'pg_catalog.text'::pg_catalog.regtype),
          ('roles', 'pg_catalog._text'::pg_catalog.regtype),
          ('warehouse_id', 'pg_catalog.uuid'::pg_catalog.regtype),
          ('region', pg_catalog.to_regtype('public.operario_region')),
          ('tenant_id', 'pg_catalog.uuid'::pg_catalog.regtype))) <> 7 then
    raise exception '0480 abortado: operario_pins no tiene las columnas que edita esta RPC';
  end if;
  if pg_catalog.to_regclass('public.warehouses_cn') is null
     or (select pg_catalog.count(*) from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.to_regclass('public.warehouses_cn') and not a.attisdropped
           and (a.attname, a.atttypid) in (('id', 'pg_catalog.uuid'::pg_catalog.regtype),
             ('active', 'pg_catalog.bool'::pg_catalog.regtype))) <> 2 then
    raise exception '0480 abortado: falta warehouses_cn con id y active';
  end if;

  -- Auditoría: writer 0267/0294 con dueño y contexto seguros, y la entidad de 0475.
  if pg_catalog.to_regclass('public.entity_audit_log') is null
     or not exists (select 1 from pg_catalog.pg_proc p
       where p.oid = pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)')
         and p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole
         and p.proconfig = array['search_path=""']::text[]
         and not pg_catalog.has_function_privilege(v_auth, p.oid, 'EXECUTE')) then
    raise exception '0480 abortado: falta el writer de auditoría 0267/0294 o no conserva dueño y contexto';
  end if;
  if not exists (select 1 from public.audit_entity_types t
    where t.entity_type = 'operario' and t.status = 'active' and t.domain_code = 'access'
      and t.introduced_by_ref = 'migration:0475') then
    raise exception '0480 abortado: falta la entidad de auditoría operario de 0475';
  end if;
end;
$preflight$;

-- ── 1. Los roles de cada región: la única fuente ─────────────
create or replace function public.operario_roles_por_region()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select '{"cn": ["operario", "supervisor"], "ve": ["bodeguero", "camionero", "supervisor"]}'::jsonb
$function$;

comment on function public.operario_roles_por_region() is
  'SDD-0529: los roles que se le pueden dar a un operario de cada región, en el orden del selector del Studio. China: operario y supervisor (operario_pins_ve_role_requires_ve_region, 0025). Venezuela: bodeguero, camionero y supervisor (las RPC de despacho aceptan supervisor; ninguna acepta operario). La usan admin_update_operario y el Studio; no se escribe en otro lado.';

revoke all on function public.operario_roles_por_region() from public, anon, service_role;
grant execute on function public.operario_roles_por_region() to authenticated;

-- ── 2. Editar: 0351 + matriz, rol de la región, modos, almacén y auditoría ──
create or replace function public.admin_update_operario(
  p_operario_id uuid,
  p_display_name text,
  p_display_name_cn text,
  p_role text,
  p_warehouse_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_op record;
  v_nombre text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_nombre_cn text := nullif(pg_catalog.btrim(coalesce(p_display_name_cn, '')), '');
  v_modos text[];
  v_roles text[];
  v_cambios text[] := array[]::text[];
  v_event uuid;
begin
  -- De primero, como alta, restablecimiento y «Ver PIN» (0475): sin permiso no
  -- hay oráculo de ids.
  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;

  select op.tenant_id, op.region, op.role, op.roles, op.warehouse_id, op.display_name, op.display_name_cn
    into v_op
    from public.operario_pins op
   where op.id = p_operario_id
     for update;
  if v_op.tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  perform public.assert_tenant_match(v_op.tenant_id);

  if v_nombre = '' then
    raise exception 'Escribe el nombre del operario.' using errcode = 'P0011';
  end if;

  -- El rol, de los de SU región (la de la fila); nunca uno por defecto.
  if not coalesce((public.operario_roles_por_region() -> (v_op.region::text)) ? p_role, false) then
    raise exception 'Ese rol no corresponde a la región del operario. Elige uno de la lista.'
      using errcode = 'P0012';
  end if;

  -- Los modos de la app del teléfono (0066): con uno solo, siguen al rol; con
  -- varios, el rol tiene que ser uno de ellos y los modos no cambian.
  v_modos := coalesce(nullif(v_op.roles, array[]::text[]), array[v_op.role]);
  if p_role = v_op.role then
    v_roles := v_op.roles;
  elsif v_modos = array[v_op.role] then
    v_roles := array[p_role];
  elsif p_role = any (v_modos) then
    v_roles := v_op.roles;
  else
    raise exception 'Este operario entra con los modos %: su rol tiene que ser uno de ellos.',
      pg_catalog.array_to_string(v_modos, ', ')
      using errcode = 'P0012';
  end if;

  -- El almacén: China, uno de China que exista y esté activo (o el que ya
  -- tenía); Venezuela, ninguno, porque es despacho.
  if v_op.region = 'cn' then
    if p_warehouse_id is null then
      raise exception 'Elige el almacén de China del operario.' using errcode = 'P0023';
    end if;
    if p_warehouse_id is distinct from v_op.warehouse_id
       and not exists (select 1 from public.warehouses_cn w where w.id = p_warehouse_id and w.active) then
      raise exception 'Ese almacén no existe o ya no está activo. Elige otro.' using errcode = 'P0023';
    end if;
  elsif p_warehouse_id is not null then
    raise exception 'Los operarios de Venezuela no llevan almacén: son de despacho.' using errcode = 'P0023';
  end if;

  if v_nombre is distinct from v_op.display_name then
    v_cambios := v_cambios || 'display_name'::text;
  end if;
  if v_nombre_cn is distinct from v_op.display_name_cn then
    v_cambios := v_cambios || 'display_name_cn'::text;
  end if;
  if p_role is distinct from v_op.role then
    v_cambios := v_cambios || 'role'::text;
  end if;
  if v_roles is distinct from v_op.roles then
    v_cambios := v_cambios || 'roles'::text;
  end if;
  if p_warehouse_id is distinct from v_op.warehouse_id then
    v_cambios := v_cambios || 'warehouse_id'::text;
  end if;
  -- Guardar sin cambios no escribe ni deja evento.
  if pg_catalog.cardinality(v_cambios) = 0 then
    return;
  end if;

  begin
    update public.operario_pins
       set display_name = v_nombre,
           display_name_cn = v_nombre_cn,
           role = p_role,
           roles = v_roles,
           warehouse_id = p_warehouse_id
     where id = p_operario_id;
  exception
    when unique_violation then
      raise exception 'Ya hay un operario con ese nombre en ese almacén.' using errcode = 'P0013';
  end;

  -- AUD-01: el evento nace en esta transacción. Los nombres no se copian: basta el id.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id => v_op.tenant_id,
    p_entity_type => 'operario',
    p_entity_id => p_operario_id,
    p_actor_type => 'user',
    p_actor_id => auth.uid(),
    p_event_type => 'operario_updated',
    p_source => 'rpc',
    p_result => 'succeeded',
    p_reason => null,
    p_before_data => pg_catalog.jsonb_build_object('region', v_op.region, 'role', v_op.role,
      'roles', pg_catalog.to_jsonb(v_op.roles), 'warehouse_id', v_op.warehouse_id),
    p_after_data => pg_catalog.jsonb_build_object('region', v_op.region, 'role', p_role,
      'roles', pg_catalog.to_jsonb(v_roles), 'warehouse_id', p_warehouse_id),
    p_payload => pg_catalog.jsonb_build_object('cambios', pg_catalog.to_jsonb(v_cambios)),
    p_correlation_id => 'operario_updated:' || pg_catalog.gen_random_uuid()::text,
    p_schema_version => 1,
    p_sensitivity => 'internal'
  );
  if v_event is null then
    raise exception 'No se pudo auditar la edición del operario' using errcode = 'P0001';
  end if;
end;
$function$;

comment on function public.admin_update_operario(uuid, text, text, text, uuid) is
  'Edita nombre, nombre en chino, rol y almacén de un operario del tenant del caller. SDD-0529: autoriza con la matriz de módulos (operarios_module_authorized); el rol tiene que ser de los de su región (operario_roles_por_region) y arrastra sus modos si tiene uno solo; China lleva un almacén activo (o el que ya tenía) y Venezuela ninguno; sin cambios no escribe; audita operario_updated en la misma transacción, sin los nombres.';

-- `create or replace` conserva la ACL de 0351; se repite para leer el archivo solo.
revoke all on function public.admin_update_operario(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to authenticated;

do $postflight$
declare
  v_expected record;
begin
  for v_expected in select * from (values
    ('public.admin_update_operario(uuid,text,text,text,uuid)', '3eed656106674ff1d1b6c79dcde60f86', true, 'v'),
    ('public.operario_roles_por_region()', '47cad29a421017704ba6630b4f712d9c', false, 'i')
  ) e(signature, body, definer, volatility) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = array['search_path=""']::text[]) then
      raise exception '0480: postflight — % no quedó con el cuerpo, DEFINER, volatilidad o search_path de 0480',
        v_expected.signature;
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.pronamespace = 'public'::pg_catalog.regnamespace
        and p.proname in ('admin_update_operario', 'operario_roles_por_region')) <> 2 then
    raise exception '0480: postflight — quedaron sobrecargas de admin_update_operario u operario_roles_por_region';
  end if;

  -- EXECUTE: las dos para authenticated; ninguna para anon ni PUBLIC.
  for v_expected in select * from (values
    ('public.admin_update_operario(uuid,text,text,text,uuid)'),
    ('public.operario_roles_por_region()')
  ) e(signature) loop
    if not pg_catalog.has_function_privilege('authenticated', v_expected.signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_expected.signature, 'EXECUTE')
       or exists (select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) a
         where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
           and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception '0480: postflight — EXECUTE de % no es el esperado', v_expected.signature;
    end if;
  end loop;
  if pg_catalog.has_function_privilege('service_role', 'public.operario_roles_por_region()', 'EXECUTE') then
    raise exception '0480: postflight — service_role no necesita operario_roles_por_region()';
  end if;

  -- Una entrada por región, ni más ni menos.
  if (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(public.operario_roles_por_region()) k)
     is distinct from (select pg_catalog.array_agg(e.enumlabel::text order by e.enumlabel::text)
       from pg_catalog.pg_enum e where e.enumtypid = pg_catalog.to_regtype('public.operario_region')) then
    raise exception '0480: postflight — operario_roles_por_region() no tiene exactamente una entrada por región';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0480_operarios_editar_por_region.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0480_operarios_editar_por_region. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
