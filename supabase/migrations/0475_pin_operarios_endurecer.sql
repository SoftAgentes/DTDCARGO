-- ─────────────────────────────────────────────────────────────────────────────
-- 0475 · SDD-0515 — PIN de operarios endurecido: nadie lee pin_hash ni el PIN
-- cifrado desde la API, la matriz de módulos manda, el PIN se puede ver con un
-- motivo y queda auditado, cada alta, restablecimiento y reactivación pide
-- motivo y deja su evento, y no hay dos operarios activos con el mismo PIN en
-- el mismo tenant y región.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio. Antes de
--    aplicar, el Director lee en producción, READ ONLY, los md5 de prosrc, las
--    ACL, las columnas, la policy y Vault que el preflight exige
--    (.agents/handoffs/0515-pin-operarios-endurecer.md).
--    ORDEN: MIGRATE-FIRST y desplegar la app enseguida. Las RPC de alta y
--    restablecimiento cambian de firma (motivo obligatorio): con la migración
--    aplicada y la app de antes, el alta y el restablecimiento responden «Escribe
--    el motivo…» hasta que se despliega la app nueva; con la app nueva y sin la
--    migración, fallarían con un error de PostgREST. Fusionar la PR NO autoriza
--    aplicarla.
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
--    studio_role_module_overrides (0357).
-- 3. Restablecer un PIN cambia una credencial y no deja rastro: no existe la
--    entidad 'operario' en audit_entity_types (AUD-01 §2).
-- 4. verify_operario_pin (0325) exige UNA sola coincidencia en tenant + región:
--    un PIN repetido entre dos operarios activos deja fuera a los dos; y
--    reactivar a un operario dado de baja podía devolverlo con un PIN que otro
--    ya usa.
-- 5. validate_operario_pin_format (0037) contesta con voseo («Elegí»).
--
-- ── Decisión de Sam y riesgo aceptado (2026-10-14, AskUserQuestion) ─────────
-- Opción elegida: «Sí, con un botón «Ver PIN» auditado». Lo que se le explicó:
-- «Además del hash (que sigue sin poder leerse), se guarda el PIN cifrado con
-- una clave del servidor. Un botón «Ver PIN» lo muestra sólo a los roles con
-- acceso a Operarios en la matriz, y cada vez que alguien lo ve queda en la
-- auditoría. Riesgo: quien lo vea puede entrar como ese operario, y la
-- auditoría ya no prueba quién hizo cada entrega. Los PIN actuales no se pueden
-- recuperar: hay que restablecerlos una vez para que empiecen a verse.»
-- Y «Sí, un motivo corto obligatorio (Recomendado)» para restablecer y para ver.
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
-- · PIN recuperable: columna pin_cifrado (bytea), con pgp_sym_encrypt de
--   pgcrypto (AES-256, sesión y sal aleatorias: dos PIN iguales no dan el mismo
--   texto cifrado) y la clave operario_pin_key de Vault, que esta migración crea
--   con 32 bytes aleatorios si no existe, como se crearon las de No-Olvidar y
--   Kommo. Se usa pgcrypto porque ya está instalado en extensions y es lo que el
--   repo usa para el PIN (crypt/gen_salt); Vault guarda la clave cifrada en
--   reposo y la sirve sólo a quien puede leer vault.decrypted_secrets. Los PIN
--   anteriores a 0475 quedan con pin_cifrado NULL hasta que se restablecen.
-- · Lectura: la policy SELECT de operario_pins exige además el permiso de vista
--   de la matriz. El SELECT de authenticated y de service_role pasa a ser por
--   columna: todas menos pin_hash y pin_cifrado. service_role deja de poder
--   insertar y sólo actualiza las columnas que no son credencial: pin_hash y
--   pin_cifrado sólo los escriben admin_create_operario y
--   admin_reset_operario_pin.
-- · admin_create_operario y admin_reset_operario_pin, reescritas desde 0351 con
--   firma nueva (p_motivo; y p_reactivar en el restablecimiento): la matriz de
--   primero, el motivo (4 a 300 caracteres, sin el PIN), el chequeo de PIN libre
--   con un lock por (tenant, región), el PIN cifrado y el evento en la misma
--   transacción, sin el PIN ni el hash: si no se escribe, nada cambia.
-- · admin_ver_operario_pin(operario, motivo): misma regla que restablecer,
--   motivo obligatorio, evento pin_visto en la misma transacción; devuelve el PIN
--   o NULL si es anterior a 0475.
-- · admin_set_operario_active (0351) ya no reactiva: P0019 pide restablecer con
--   p_reactivar, que da un PIN nuevo y libre. Desactivar no cambia, y su
--   autorización sigue escrita a mano (la matriz para editar y desactivar va en
--   una SDD aparte).
-- · audit_entity_types gana 'operario' (dominio access).
-- · validate_operario_pin_format se reescribe desde 0037 con «Elige» y con el
--   search_path = public que le puso 0210.
--
-- ── Qué NO cambia ───────────────────────────────────────────
-- verify_operario_pin (0325): el login sigue comparando contra pin_hash, y el
-- chequeo de PIN libre también, porque es lo que el login compara (descifrar
-- haría depender el chequeo de Vault y de que pin_cifrado esté al día).
-- admin_update_operario (0351), assert_studio_role y las filas de operarios.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si el md5(prosrc) (CRLF→LF) de cada función
-- reemplazada no es el de su última definición en el repo (o, al re-aplicar, el
-- de esta migración); si las dependencias (get_user_tenant_id 0453,
-- assert_tenant_match 0012, verify_operario_pin 0325, append_audit_event 0294,
-- pgcrypto, Vault) no son las esperadas; si operario_pins no tiene exactamente
-- sus columnas, RLS activa sin FORCE, una sola policy y la ACL de origen; o si
-- 'operario' o la clave de Vault ya existen sin venir de aquí. Re-aplicarla no
-- cambia nada. El postflight exige los cuerpos, las firmas, la ACL por columna,
-- la policy, el catálogo, la clave y el EXECUTE de cada función.
-- LOCKS: ACCESS EXCLUSIVE sobre operario_pins por ALTER TABLE, DROP/CREATE
-- POLICY y los GRANT, hasta el COMMIT (milisegundos; el login espera, no falla,
-- dentro del lock_timeout de 5 s). Ninguna fila de operarios tocada; una fila en
-- audit_entity_types y un secreto en Vault.
-- ROLLBACK: drop de admin_ver_operario_pin y de las firmas nuevas de alta y
-- restablecimiento; create de las de 0351 (con su ACL de 0021/0351);
-- create or replace de admin_set_operario_active de 0351 y del validador de
-- 0037 (con set search_path = public); revoke del SELECT/UPDATE por columna y
-- grant select de tabla a authenticated y select, insert, update a
-- service_role; drop de la policy nueva y create de la de 0021; drop de los
-- helpers. La columna pin_cifrado, la clave de Vault y la fila 'operario' se
-- conservan (dropear la columna borraría los PIN recuperables; el catálogo no
-- se borra).
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
  v_keys bigint;
begin
  if v_auth is null or v_service is null or v_anon is null
     or exists (select 1 from pg_catalog.pg_roles r
       where r.oid in (v_auth, v_anon) and (r.rolsuper or r.rolbypassrls)) then
    raise exception '0475 abortado: roles API ausentes o con privilegios de superusuario';
  end if;

  -- operario_pins: tabla con RLS sin FORCE (las funciones DEFINER la leen como
  -- dueño). Una sola policy: la de 0021 (origen) o la de 0475 (re-aplicar); de
  -- ella sale en qué estado está todo lo demás.
  if not exists (select 1 from pg_catalog.pg_class c
    where c.oid = v_pins and c.relkind = 'r' and c.relrowsecurity and not c.relforcerowsecurity) then
    raise exception '0475 abortado: public.operario_pins no existe o su RLS no es la esperada';
  end if;
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

  -- Columnas exactas: las 14 de producción, más pin_cifrado sólo al re-aplicar.
  select pg_catalog.array_agg(a.attname::text order by a.attname) into v_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_pins and a.attnum > 0 and not a.attisdropped;
  if v_columns is distinct from (case when v_fresh
      then array['active', 'created_at', 'display_name', 'display_name_cn', 'id', 'last_login_at',
        'pin_hash', 'region', 'role', 'roles', 'tenant_id', 'tms_driver_id', 'updated_at', 'warehouse_id']
      else array['active', 'created_at', 'display_name', 'display_name_cn', 'id', 'last_login_at',
        'pin_cifrado', 'pin_hash', 'region', 'role', 'roles', 'tenant_id', 'tms_driver_id', 'updated_at',
        'warehouse_id'] end)::text[] then
    raise exception '0475 abortado: operario_pins no tiene exactamente sus columnas (%)', v_columns;
  end if;
  if (select pg_catalog.array_agg(e.enumlabel::text order by e.enumsortorder)
      from pg_catalog.pg_enum e where e.enumtypid = pg_catalog.to_regtype('public.operario_region'))
     is distinct from array['cn', 've']::text[] then
    raise exception '0475 abortado: el enum operario_region no es (cn, ve)';
  end if;

  -- ACL: anon y PUBLIC sin nada; authenticated sólo SELECT; service_role
  -- escribe. En el origen todo es de tabla; al re-aplicar, por columna.
  if exists (select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = v_pins and a.grantee in (0, v_anon))
     or exists (select 1 from pg_catalog.pg_attribute att cross join lateral pg_catalog.aclexplode(att.attacl) a
      where att.attrelid = v_pins and a.grantee in (0, v_anon))
     or pg_catalog.has_table_privilege(v_auth, v_pins, 'INSERT')
     or pg_catalog.has_table_privilege(v_auth, v_pins, 'UPDATE')
     or pg_catalog.has_table_privilege(v_auth, v_pins, 'DELETE')
     or pg_catalog.has_table_privilege(v_auth, v_pins, 'TRUNCATE')
     or not pg_catalog.has_table_privilege(v_service, v_pins, 'DELETE') then
    raise exception '0475 abortado: la ACL de operario_pins no es la esperada';
  end if;
  if v_fresh then
    if not pg_catalog.has_table_privilege(v_auth, v_pins, 'SELECT')
       or not pg_catalog.has_table_privilege(v_service, v_pins, 'SELECT')
       or not pg_catalog.has_table_privilege(v_service, v_pins, 'INSERT')
       or not pg_catalog.has_table_privilege(v_service, v_pins, 'UPDATE')
       or exists (select 1 from pg_catalog.pg_attribute att where att.attrelid = v_pins and att.attacl is not null) then
      raise exception '0475 abortado: el SELECT de origen de operario_pins no es de tabla';
    end if;
  elsif pg_catalog.has_column_privilege(v_auth, v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_column_privilege(v_service, v_pins, 'pin_hash', 'SELECT')
     or pg_catalog.has_column_privilege(v_auth, v_pins, 'pin_cifrado', 'SELECT')
     or pg_catalog.has_column_privilege(v_service, v_pins, 'pin_cifrado', 'SELECT') then
    raise exception '0475 abortado: re-aplicación con pin_hash o pin_cifrado legibles';
  end if;

  -- Firmas: en el origen, las de 0351; al re-aplicar, las de 0475. Ninguna otra.
  if (select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.pronamespace = 'public'::pg_catalog.regnamespace
        and p.proname in ('admin_create_operario', 'admin_reset_operario_pin', 'admin_ver_operario_pin'))
     <> (case when v_fresh then 2 else 3 end) then
    raise exception '0475 abortado: hay sobrecargas inesperadas de las RPC de operario';
  end if;

  -- Cuerpos: el de su última definición en el repo (origen) o el de 0475.
  for v_expected in select * from (values
    ('public.admin_create_operario(uuid,uuid,text,text,text,text)', 'f7e89f156817fc3d30eb4635090b0603',   -- 0351
      true, 'v', array['search_path=public, extensions']::text[], true),
    ('public.admin_reset_operario_pin(uuid,text)', 'ea358b166dbd5c90dff337d473649da3',                   -- 0351
      true, 'v', array['search_path=public, extensions']::text[], true),
    ('public.admin_set_operario_active(uuid,boolean)', '9981fa8486c2e32e53ad4f805703a0dc',               -- 0351
      true, 'v', array['search_path=public']::text[], true),
    ('public.validate_operario_pin_format(text)', '62f64d916edf371cb7a2b8d4b784c18d',                    -- 0037 (+ 0210)
      false, 'i', array['search_path=public']::text[], true),
    ('public.admin_create_operario(uuid,uuid,text,text,text,text,text)', 'ce150274eda586c84d38e5c08fdd129b',
      true, 'v', array['search_path=public, extensions']::text[], false),
    ('public.admin_reset_operario_pin(uuid,text,text,boolean)', '15bd52e476ad5a2bb5683b921c2ee644',
      true, 'v', array['search_path=public, extensions']::text[], false),
    ('public.admin_set_operario_active(uuid,boolean)', '37130d853ce44a7455387e40b115df5b',
      true, 'v', array['search_path=public']::text[], false),
    ('public.validate_operario_pin_format(text)', '5d21a590c47cc39ae99f2f853aedae82',
      false, 'i', array['search_path=public']::text[], false),
    ('public.admin_ver_operario_pin(uuid,text)', '608f7f7daf17e0a7f93cc594a2761962',
      true, 'v', array['search_path=""']::text[], false),
    ('public.operarios_module_authorized(uuid,text)', '299f276babe7177556c5d2105d45b2c0',
      true, 's', array['search_path=""']::text[], false),
    ('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', '9188d650ed78acafc732883df09d14a7',
      false, 'v', array['search_path=""']::text[], false),
    ('public.operario_pin_cifrar(text)', '311fa9add0e2f89366bfc1efa1a61c2d',
      false, 'v', array['search_path=""']::text[], false),
    ('public.operario_pin_descifrar(bytea)', '8bbcce0e888b8593c1eabfc4a975464d',
      false, 'v', array['search_path=""']::text[], false),
    ('public.operario_motivo_valido(text,text)', 'f9f519a4f9f4da3594398fa1dc5d36c0',
      false, 'i', array['search_path=""']::text[], false)
  ) e(signature, body, definer, volatility, config, origin) loop
    -- Las de origen sólo se exigen en el origen; las de 0475, sólo al re-aplicar
    -- (en el origen tienen que no existir, salvo las dos que se reemplazan).
    if v_expected.origin = v_fresh and not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = v_expected.config) then
      raise exception '0475 abortado: % tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)',
        v_expected.signature;
    end if;
    if v_fresh and not v_expected.origin
       and v_expected.signature not in ('public.admin_set_operario_active(uuid,boolean)',
         'public.validate_operario_pin_format(text)')
       and pg_catalog.to_regprocedure(v_expected.signature) is not null then
      raise exception '0475 abortado: % ya existe antes de aplicar', v_expected.signature;
    end if;
  end loop;

  -- Dependencias que no se reemplazan: la regla nueva se apoya en ellas.
  for v_expected in select * from (values
    ('public.get_user_tenant_id()', '5ff0c51c26a49419c34abc78f1d95c37', true, 's',
      array['search_path=""']::text[]),                                  -- 0453
    ('public.assert_tenant_match(uuid)', 'bf5e898bc3a6209c0a5dc75f89ba9333', true, 'v',
      array['search_path=public']::text[]),                              -- 0012
    ('public.verify_operario_pin(text,uuid,public.operario_region,text)',
      '99c5f3e9eaae92bfe3987e1377d4734f', true, 'v',
      array['search_path=public, extensions']::text[])                   -- 0325
  ) e(signature, body, definer, volatility, config) loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
        and pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) = v_expected.body
        and p.prosecdef = v_expected.definer
        and p.provolatile::text = v_expected.volatility
        and p.proconfig = v_expected.config) then
      raise exception '0475 abortado: % tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)',
        v_expected.signature;
    end if;
  end loop;
  for v_expected in select * from (values
    ('public.admin_set_operario_active(uuid,boolean)'),
    (case when v_fresh then 'public.admin_reset_operario_pin(uuid,text)'
      else 'public.admin_reset_operario_pin(uuid,text,text,boolean)' end),
    (case when v_fresh then 'public.admin_create_operario(uuid,uuid,text,text,text,text)'
      else 'public.admin_create_operario(uuid,uuid,text,text,text,text,text)' end)
  ) e(signature) loop
    if not pg_catalog.has_function_privilege(v_auth, v_expected.signature, 'EXECUTE')
       or pg_catalog.has_function_privilege(v_anon, v_expected.signature, 'EXECUTE') then
      raise exception '0475 abortado: EXECUTE de % no es el esperado', v_expected.signature;
    end if;
  end loop;

  -- pgcrypto en extensions y Vault: lo que cifra y lo que guarda la clave.
  if pg_catalog.to_regprocedure('extensions.pgp_sym_encrypt(text,text,text)') is null
     or pg_catalog.to_regprocedure('extensions.pgp_sym_decrypt(bytea,text)') is null
     or pg_catalog.to_regprocedure('extensions.gen_random_bytes(integer)') is null
     or pg_catalog.to_regprocedure('extensions.crypt(text,text)') is null then
    raise exception '0475 abortado: pgcrypto no está en el schema extensions';
  end if;
  if pg_catalog.to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_catalog.pg_proc p
       where p.pronamespace = pg_catalog.to_regnamespace('vault') and p.proname = 'create_secret') then
    raise exception '0475 abortado: falta Vault (vault.create_secret y vault.decrypted_secrets)';
  end if;
  select pg_catalog.count(*) into v_keys from vault.decrypted_secrets s where s.name = 'operario_pin_key';
  if v_keys <> (case when v_fresh then 0 else 1 end) then
    raise exception '0475 abortado: la clave operario_pin_key de Vault ya existe sin venir de 0475, o falta al re-aplicar';
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

-- ── 1. Catálogo de auditoría y clave de Vault ────────────────
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('operario', 'active', 'access', 1, 'migration:0475')
on conflict (entity_type) do nothing;

-- La clave nace en la base: el valor no está en este archivo ni en ningún log.
do $vault_key$
begin
  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'operario_pin_key') then
    perform vault.create_secret(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'),
      'operario_pin_key',
      'SDD-0515 · clave simétrica del PIN recuperable de los operarios (operario_pins.pin_cifrado). Rotarla exige una migración que vuelva a cifrar.');
  end if;
end;
$vault_key$;

-- ── 2. PIN recuperable ───────────────────────────────────────
alter table public.operario_pins add column if not exists pin_cifrado bytea;

comment on column public.operario_pins.pin_cifrado is
  'SDD-0515: el PIN cifrado con pgp_sym_encrypt (AES-256) y la clave operario_pin_key de Vault, para «Ver PIN». NULL = PIN anterior a 0475: hay que restablecerlo para que se pueda ver. Ningún rol de la API lo lee; sólo lo escriben admin_create_operario y admin_reset_operario_pin.';

-- Privadas: sólo las llaman las RPC DEFINER, como su dueño. La clave no sale de aquí.
create or replace function public.operario_pin_cifrar(p_pin text)
returns bytea
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_key text;
begin
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'operario_pin_key';
  if v_key is null or pg_catalog.char_length(v_key) < 32 then
    raise exception 'Falta la clave operario_pin_key en Vault' using errcode = 'P0021';
  end if;
  return extensions.pgp_sym_encrypt(p_pin, v_key, 'cipher-algo=aes256');
end;
$function$;

create or replace function public.operario_pin_descifrar(p_cifrado bytea)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_key text;
begin
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'operario_pin_key';
  if v_key is null or pg_catalog.char_length(v_key) < 32 then
    raise exception 'Falta la clave operario_pin_key en Vault' using errcode = 'P0021';
  end if;
  return extensions.pgp_sym_decrypt(p_cifrado, v_key);
end;
$function$;

comment on function public.operario_pin_cifrar(text) is
  'SDD-0515: cifra un PIN con la clave operario_pin_key de Vault. Sin EXECUTE para roles de API.';
comment on function public.operario_pin_descifrar(bytea) is
  'SDD-0515: descifra operario_pins.pin_cifrado con la clave operario_pin_key de Vault. Sin EXECUTE para roles de API.';

revoke all on function public.operario_pin_cifrar(text) from public, anon, authenticated, service_role;
revoke all on function public.operario_pin_descifrar(bytea) from public, anon, authenticated, service_role;

-- ── 3. Motivo obligatorio (AUD-01): 4 a 300 caracteres y sin el PIN ──
create or replace function public.operario_motivo_valido(p_motivo text, p_pin text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
begin
  if pg_catalog.char_length(v_motivo) < 4 or pg_catalog.char_length(v_motivo) > 300 then
    raise exception 'Escribe el motivo: entre 4 y 300 caracteres.' using errcode = 'P0020';
  end if;
  if p_pin is not null and pg_catalog.strpos(v_motivo, p_pin) > 0 then
    raise exception 'No escribas el PIN en el motivo: queda en la auditoría.' using errcode = 'P0020';
  end if;
  return v_motivo;
end;
$function$;

comment on function public.operario_motivo_valido(text, text) is
  'SDD-0515: valida el motivo de alta, restablecimiento y «Ver PIN» (4 a 300 caracteres, sin el PIN) y lo devuelve recortado. Sin EXECUTE para roles de API.';

revoke all on function public.operario_motivo_valido(text, text) from public, anon, authenticated, service_role;

-- ── 4. La regla de la app, en la base ────────────────────────
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

-- ── 5. PIN libre en el tenant y la región ────────────────────
-- Privada. Recibe el PIN en claro porque es la única forma de compararlo con un
-- bcrypt con sal propia. Compara contra pin_hash, que es lo que compara el login.
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

-- ── 6. Formato del PIN: 0037 con tuteo y el search_path de 0210 ──
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

-- ── 7. Alta de operario: 0351 + matriz, motivo, PIN libre y cifrado, auditoría ──
drop function if exists public.admin_create_operario(uuid, uuid, text, text, text, text);

create or replace function public.admin_create_operario(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_display_name text,
  p_display_name_cn text,
  p_pin text,
  p_role text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_region public.operario_region;
  v_motivo text;
  v_event uuid;
begin
  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
  perform public.assert_tenant_match(p_tenant_id);
  perform public.validate_operario_pin_format(p_pin);
  v_motivo := public.operario_motivo_valido(p_motivo, p_pin);

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Nombre requerido' using errcode = 'P0011';
  end if;
  if p_role not in ('operario', 'supervisor') then
    raise exception 'Rol inválido (operario | supervisor)' using errcode = 'P0012';
  end if;

  insert into public.operario_pins (
    tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role, pin_cifrado
  ) values (
    p_tenant_id, p_warehouse_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_display_name_cn, '')), ''),
    crypt(p_pin, gen_salt('bf')),
    p_role,
    public.operario_pin_cifrar(p_pin)
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
    p_reason => v_motivo,
    p_before_data => null,
    p_after_data => pg_catalog.jsonb_build_object('credential', 'pin', 'region', v_region,
      'role', p_role, 'warehouse_id', p_warehouse_id, 'active', true, 'recoverable', true),
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

-- ── 8. Restablecer PIN: 0351 + matriz, motivo, PIN libre y cifrado, auditoría ──
-- p_reactivar: la única forma de reactivar a un operario dado de baja, siempre
-- con un PIN nuevo que ningún otro operario activo de su región usa.
drop function if exists public.admin_reset_operario_pin(uuid, text);

create or replace function public.admin_reset_operario_pin(
  p_operario_id uuid,
  p_pin text,
  p_motivo text default null,
  p_reactivar boolean default false
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
  v_motivo text;
  v_reactivado boolean;
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
  v_motivo := public.operario_motivo_valido(p_motivo, p_pin);
  perform public.operario_pin_assert_available(v_tenant_id, v_region, p_pin, p_operario_id);
  v_reactivado := coalesce(p_reactivar, false) and not v_active;

  update public.operario_pins
     set pin_hash = crypt(p_pin, gen_salt('bf')),
         pin_cifrado = public.operario_pin_cifrar(p_pin),
         active = active or v_reactivado
   where id = p_operario_id;

  -- AUD-01: el evento nace en esta transacción y sin el PIN ni el hash.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id => v_tenant_id,
    p_entity_type => 'operario',
    p_entity_id => p_operario_id,
    p_actor_type => 'user',
    p_actor_id => auth.uid(),
    p_event_type => case when v_reactivado then 'operario_reactivated' else 'operario_pin_reset' end,
    p_source => 'rpc',
    p_result => 'succeeded',
    p_reason => v_motivo,
    p_before_data => pg_catalog.jsonb_build_object('active', v_active),
    p_after_data => pg_catalog.jsonb_build_object('credential', 'pin', 'region', v_region,
      'active', v_active or v_reactivado, 'recoverable', true),
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

-- ── 9. Activar / desactivar: 0351, pero reactivar exige un PIN nuevo ──
create or replace function public.admin_set_operario_active(
  p_operario_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_active boolean;
begin
  perform public.assert_studio_role(array['admin', 'operations']);

  select op.tenant_id, op.active into v_tenant_id, v_active
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  perform public.assert_tenant_match(v_tenant_id);

  -- SDD-0515: un operario de baja no vuelve con su PIN viejo, que otro activo
  -- de su región puede estar usando. Se reactiva restableciendo el PIN.
  if p_active and not v_active then
    raise exception 'Para reactivar a un operario dale un PIN nuevo con «Restablecer PIN»: así no vuelve con un PIN repetido.'
      using errcode = 'P0019';
  end if;

  update public.operario_pins
     set active = p_active
   where id = p_operario_id;
end;
$$;

-- ── 10. Ver PIN: misma regla que restablecer, motivo y evento pin_visto ──
create or replace function public.admin_ver_operario_pin(
  p_operario_id uuid,
  p_motivo text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
  v_cifrado bytea;
  v_pin text;
  v_motivo text;
  v_event uuid;
begin
  -- De primero, como en restablecer: sin permiso no hay oráculo de ids.
  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
  v_motivo := public.operario_motivo_valido(p_motivo, null);

  select op.tenant_id, op.pin_cifrado into v_tenant_id, v_cifrado
    from public.operario_pins op where op.id = p_operario_id;
  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0014';
  end if;
  perform public.assert_tenant_match(v_tenant_id);

  -- NULL: PIN anterior a 0475, que nunca se guardó cifrado.
  if v_cifrado is not null then
    v_pin := public.operario_pin_descifrar(v_cifrado);
    perform public.operario_motivo_valido(v_motivo, v_pin);
  end if;

  -- AUD-01 / AUD-02: quién, a qué operario, el motivo y si había PIN; nunca el PIN.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id => v_tenant_id,
    p_entity_type => 'operario',
    p_entity_id => p_operario_id,
    p_actor_type => 'user',
    p_actor_id => auth.uid(),
    p_event_type => 'pin_visto',
    p_source => 'rpc',
    p_result => 'succeeded',
    p_reason => v_motivo,
    p_before_data => null,
    p_after_data => pg_catalog.jsonb_build_object('credential', 'pin', 'recoverable', v_pin is not null),
    p_payload => '{}'::jsonb,
    p_correlation_id => 'pin_visto:' || pg_catalog.gen_random_uuid()::text,
    p_schema_version => 1,
    p_sensitivity => 'restricted'
  );
  if v_event is null then
    raise exception 'No se pudo auditar la consulta del PIN' using errcode = 'P0001';
  end if;

  return v_pin;
end;
$function$;

comment on function public.admin_create_operario(uuid, uuid, text, text, text, text, text) is
  'Crea un operario del tenant del caller. SDD-0515: autoriza con la matriz de módulos (operarios_module_authorized), exige motivo, rechaza con P0018 un PIN de otro operario activo del mismo tenant y región, guarda el PIN cifrado y audita operario_created en la misma transacción sin el PIN.';
comment on function public.admin_reset_operario_pin(uuid, text, text, boolean) is
  'Restablece el PIN de un operario del tenant del caller y, con p_reactivar, lo reactiva. SDD-0515: autoriza con la matriz de módulos, exige motivo, rechaza con P0018 un PIN de otro operario activo del mismo tenant y región, guarda el PIN cifrado y audita operario_pin_reset u operario_reactivated en la misma transacción sin el PIN.';
comment on function public.admin_set_operario_active(uuid, boolean) is
  'Activa/desactiva un operario. SDD-0515: reactivar a uno dado de baja se hace con admin_reset_operario_pin(p_reactivar), que da un PIN nuevo; aquí responde P0019. Autorización todavía escrita a mano (0351).';
comment on function public.admin_ver_operario_pin(uuid, text) is
  'SDD-0515: «Ver PIN». Autoriza con la matriz (edición), exige motivo, audita pin_visto en la misma transacción sin el PIN y devuelve el PIN, o NULL si es anterior a 0475.';

-- Firmas nuevas: sin EXECUTE de PUBLIC, anon ni service_role (necesitan auth.uid()).
revoke all on function public.admin_create_operario(uuid, uuid, text, text, text, text, text) from public, anon, service_role;
grant execute on function public.admin_create_operario(uuid, uuid, text, text, text, text, text) to authenticated;
revoke all on function public.admin_reset_operario_pin(uuid, text, text, boolean) from public, anon, service_role;
grant execute on function public.admin_reset_operario_pin(uuid, text, text, boolean) to authenticated;
revoke all on function public.admin_ver_operario_pin(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_ver_operario_pin(uuid, text) to authenticated;
-- `create or replace` conserva la ACL de 0021/0351; se repite para leer el archivo solo.
revoke all on function public.admin_set_operario_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_operario_active(uuid, boolean) to authenticated;

-- ── 11. Lectura: matriz en la policy; pin_hash y pin_cifrado fuera de la API ──
drop policy if exists "operario_pins select by admin of tenant" on public.operario_pins;
drop policy if exists "operario_pins select by operarios module" on public.operario_pins;
create policy "operario_pins select by operarios module"
  on public.operario_pins for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.operarios_module_authorized((select public.get_user_tenant_id()), 'view'))
  );

-- Revocar de tabla revoca también los de columna: re-aplicar deja lo mismo.
revoke select, insert, update on table public.operario_pins from authenticated, service_role;
grant select (id, tenant_id, warehouse_id, region, display_name, display_name_cn, role, roles,
  active, last_login_at, created_at, updated_at, tms_driver_id)
  on table public.operario_pins to authenticated, service_role;
grant update (warehouse_id, region, display_name, display_name_cn, role, roles,
  active, last_login_at, updated_at, tms_driver_id)
  on table public.operario_pins to service_role;

do $postflight$
declare
  v_pins oid := pg_catalog.to_regclass('public.operario_pins');
  v_expected record;
  v_column text;
begin
  for v_expected in select * from (values
    ('public.admin_create_operario(uuid,uuid,text,text,text,text,text)', 'ce150274eda586c84d38e5c08fdd129b',
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.admin_reset_operario_pin(uuid,text,text,boolean)', '15bd52e476ad5a2bb5683b921c2ee644',
      true, 'v', array['search_path=public, extensions']::text[]),
    ('public.admin_set_operario_active(uuid,boolean)', '37130d853ce44a7455387e40b115df5b',
      true, 'v', array['search_path=public']::text[]),
    ('public.validate_operario_pin_format(text)', '5d21a590c47cc39ae99f2f853aedae82',
      false, 'i', array['search_path=public']::text[]),
    ('public.admin_ver_operario_pin(uuid,text)', '608f7f7daf17e0a7f93cc594a2761962',
      true, 'v', array['search_path=""']::text[]),
    ('public.operarios_module_authorized(uuid,text)', '299f276babe7177556c5d2105d45b2c0',
      true, 's', array['search_path=""']::text[]),
    ('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', '9188d650ed78acafc732883df09d14a7',
      false, 'v', array['search_path=""']::text[]),
    ('public.operario_pin_cifrar(text)', '311fa9add0e2f89366bfc1efa1a61c2d',
      false, 'v', array['search_path=""']::text[]),
    ('public.operario_pin_descifrar(bytea)', '8bbcce0e888b8593c1eabfc4a975464d',
      false, 'v', array['search_path=""']::text[]),
    ('public.operario_motivo_valido(text,text)', 'f9f519a4f9f4da3594398fa1dc5d36c0',
      false, 'i', array['search_path=""']::text[])
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
  if pg_catalog.to_regprocedure('public.admin_create_operario(uuid,uuid,text,text,text,text)') is not null
     or pg_catalog.to_regprocedure('public.admin_reset_operario_pin(uuid,text)') is not null
     or (select pg_catalog.count(*) from pg_catalog.pg_proc p
       where p.pronamespace = 'public'::pg_catalog.regnamespace
         and p.proname in ('admin_create_operario', 'admin_reset_operario_pin', 'admin_ver_operario_pin')) <> 3 then
    raise exception '0475: postflight — quedaron firmas viejas o sobrecargas de las RPC de operario';
  end if;

  -- EXECUTE: las RPC sólo para authenticated; los helpers privados para nadie de la API.
  for v_expected in select * from (values
    ('public.admin_create_operario(uuid,uuid,text,text,text,text,text)', true, false),
    ('public.admin_reset_operario_pin(uuid,text,text,boolean)', true, false),
    ('public.admin_ver_operario_pin(uuid,text)', true, false),
    ('public.admin_set_operario_active(uuid,boolean)', true, null),
    ('public.operarios_module_authorized(uuid,text)', true, true),
    ('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)', false, false),
    ('public.operario_pin_cifrar(text)', false, false),
    ('public.operario_pin_descifrar(bytea)', false, false),
    ('public.operario_motivo_valido(text,text)', false, false)
  ) e(signature, authenticated, service_role) loop
    if pg_catalog.has_function_privilege('authenticated', v_expected.signature, 'EXECUTE') <> v_expected.authenticated
       or pg_catalog.has_function_privilege('anon', v_expected.signature, 'EXECUTE')
       or (v_expected.service_role is not null
           and pg_catalog.has_function_privilege('service_role', v_expected.signature, 'EXECUTE') <> v_expected.service_role)
       or exists (select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) a
         where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
           and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception '0475: postflight — EXECUTE de % no es el esperado', v_expected.signature;
    end if;
  end loop;

  -- pin_hash y pin_cifrado: nadie de la API los lee ni service_role los escribe;
  -- el resto, legible por authenticated y service_role sólo por columna.
  foreach v_column in array array['pin_hash', 'pin_cifrado'] loop
    if pg_catalog.has_column_privilege('authenticated', v_pins, v_column, 'SELECT')
       or pg_catalog.has_column_privilege('service_role', v_pins, v_column, 'SELECT')
       or pg_catalog.has_column_privilege('anon', v_pins, v_column, 'SELECT')
       or pg_catalog.has_column_privilege('service_role', v_pins, v_column, 'UPDATE')
       or pg_catalog.has_column_privilege('service_role', v_pins, v_column, 'INSERT') then
      raise exception '0475: postflight — % sigue legible o escribible desde la API', v_column;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('authenticated', v_pins, 'SELECT')
     or pg_catalog.has_table_privilege('service_role', v_pins, 'SELECT')
     or pg_catalog.has_table_privilege('service_role', v_pins, 'INSERT')
     or pg_catalog.has_table_privilege('service_role', v_pins, 'UPDATE')
     or pg_catalog.has_any_column_privilege('anon', v_pins, 'SELECT') then
    raise exception '0475: postflight — el SELECT o la escritura de operario_pins siguen siendo de tabla';
  end if;
  foreach v_column in array array['id', 'tenant_id', 'warehouse_id', 'region', 'display_name',
    'display_name_cn', 'role', 'roles', 'active', 'last_login_at', 'created_at', 'updated_at', 'tms_driver_id'] loop
    if not pg_catalog.has_column_privilege('authenticated', v_pins, v_column, 'SELECT')
       or not pg_catalog.has_column_privilege('service_role', v_pins, v_column, 'SELECT') then
      raise exception '0475: postflight — falta el SELECT de %', v_column;
    end if;
  end loop;
  if not pg_catalog.has_column_privilege('service_role', v_pins, 'active', 'UPDATE')
     or not pg_catalog.has_table_privilege('service_role', v_pins, 'DELETE') then
    raise exception '0475: postflight — service_role perdió la escritura de lo que no es credencial';
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

  if not exists (select 1 from pg_catalog.pg_attribute a
    where a.attrelid = v_pins and a.attname = 'pin_cifrado' and not a.attisdropped
      and a.atttypid = 'pg_catalog.bytea'::pg_catalog.regtype and not a.attnotnull) then
    raise exception '0475: postflight — falta la columna pin_cifrado (bytea, nullable)';
  end if;
  if (select pg_catalog.count(*) from vault.decrypted_secrets s
      where s.name = 'operario_pin_key' and pg_catalog.char_length(s.decrypted_secret) >= 32) <> 1 then
    raise exception '0475: postflight — falta la clave operario_pin_key en Vault';
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
