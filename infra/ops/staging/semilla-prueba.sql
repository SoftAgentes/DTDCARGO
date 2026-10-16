-- ─────────────────────────────────────────────────────────────────────────────
-- infra/ops/staging/semilla-prueba.sql — datos SINTÉTICOS del entorno de prueba
-- (SDD-0540, Fase 1; decisión D2 de Sam: «datos ficticios»).
--
-- Lo corre sembrar-prueba.sh como supabase_admin, después de las migraciones de
-- main. Las claves no viven aquí: el script antepone `\set clave_admin`,
-- `\set pin_ve` y `\set pin_cn` con valores generados en el servidor, que solo
-- se usan como :'variable' en sentencias normales (nunca dentro de un $$).
--
-- Reglas del §2.3, que scripts/__tests__/entorno-prueba-semilla.test.ts vigila
-- sobre este archivo y el bloque final vigila sobre la base:
--   · correos solo en dominios reservados (.test o .invalid);
--   · teléfonos en +1 202 555 0100 a 0199, el rango del plan norteamericano
--     reservado para ficción: un wa.me armado con ellos no le escribe a nadie;
--   · RIF y cédulas inventados, por encima de los números asignados, y la palabra
--     PRUEBA en cada nombre;
--   · nombres chinos inventados (nunca los de proveedores reales);
--   · determinista e idempotente: UUID fijos y `on conflict`. Dos corridas dejan
--     los mismos conteos;
--   · sin fila en kommo_connections ni secretos de Kommo en Vault (D8).
--
-- Roles que cubre: admin del Studio, operario VE y operario CN (PWA /m con PIN),
-- cliente del Portal (enlace mágico leído en Mailpit) y proveedor CN (link
-- público /p/<token> de una prealerta).
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

begin;

-- 0. Guardas: solo sobre una base de prueba recién migrada.
do $semilla_guarda$
begin
  if not exists (select 1 from public.tenants where slug = 'dtd') then
    raise exception 'semilla: falta el tenant dtd; ¿se aplicaron las migraciones de main?';
  end if;
  if exists (select 1 from auth.users
              where email is not null and email !~* '@([a-z0-9-]+[.])*(test|invalid)$') then
    raise exception 'semilla: hay usuarios con correos que no son de prueba: esta base no es la de prueba';
  end if;
end
$semilla_guarda$;

-- 1. Cuentas de Auth: admin del Studio (con clave) y cliente del Portal (sin
--    clave: entra por enlace mágico). Correo confirmado.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('05400000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@prueba.example.test', extensions.crypt(:'clave_admin', extensions.gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"tenant":"dtd-cargo"}'::jsonb, now(), now()),
  ('05400000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cliente@prueba.example.test', null, now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email = excluded.email,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at);

-- Identidades de correo (las crea GoTrue; en la prueba efímera sin GoTrue no existen).
do $semilla_identidades$
begin
  if pg_catalog.to_regclass('auth.identities') is not null then
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select u.id, u.id, u.id::text, 'email',
           jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
           now(), now(), now()
      from auth.users u
     where u.id in ('05400000-0000-4000-8000-000000000001', '05400000-0000-4000-8000-000000000002')
    on conflict (provider_id, provider) do nothing;
  end if;
end
$semilla_identidades$;

-- GoTrue no lee NULL en sus columnas de token (falla al listar usuarios): en
-- prueba todas las cuentas son sintéticas, así que se normalizan todas.
do $semilla_tokens$
declare
  col text;
begin
  for col in
    select c.column_name from information_schema.columns c
     where c.table_schema = 'auth' and c.table_name = 'users'
       and c.column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new',
                             'email_change_token_current', 'email_change', 'phone_change',
                             'phone_change_token', 'reauthentication_token')
  loop
    execute format('update auth.users set %I = %L where %I is null', col, '', col);
  end loop;
end
$semilla_tokens$;

-- 2. Admin del Studio.
insert into public.user_profiles (user_id, first_name, last_name, phone, position_label)
values ('05400000-0000-4000-8000-000000000001', 'Admin', 'PRUEBA', '+12025550101', 'Administración (prueba)')
on conflict (user_id) do update
  set first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone;

insert into public.user_tenants (user_id, tenant_id, role, region, warehouse_scope)
select '05400000-0000-4000-8000-000000000001'::uuid, t.id, 'admin', 've'::public.user_region, 'all'
  from public.tenants t where t.slug = 'dtd'
on conflict (user_id, tenant_id) do update
  set role = excluded.role, disabled_at = null;

-- 3. Cliente del Portal: ficha aprobada y acceso activo, ligado a su cuenta.
insert into public.clients (id, tenant_id, markbox, name, email, phone, rif, tier, notes,
                            registration_channel, portal_approved_at, city, state)
select '05400000-0000-4000-8000-000000000101'::uuid, t.id, 'DTD-9001', 'Cliente PRUEBA C.A.',
       'cliente@prueba.example.test', '+12025550102', 'J-99990001-0', 'regular'::public.client_tier,
       'Cliente sintético del entorno de prueba (SDD-0540). No es una persona.',
       'admin', now(), 'Valencia', 'Carabobo'
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set name = excluded.name, email = excluded.email, phone = excluded.phone,
      rif = excluded.rif, deleted_at = null,
      portal_approved_at = coalesce(public.clients.portal_approved_at, excluded.portal_approved_at);

insert into public.client_users (id, tenant_id, client_id, email, auth_user_id, status, bound_at)
select '05400000-0000-4000-8000-000000000102'::uuid, t.id, '05400000-0000-4000-8000-000000000101'::uuid,
       'cliente@prueba.example.test', '05400000-0000-4000-8000-000000000002'::uuid, 'active', now()
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set email = excluded.email, auth_user_id = excluded.auth_user_id, status = 'active',
      revoked_at = null;

-- 4. Operarios de la PWA: VE (bodeguero) y CN (operario de bodega). El PIN se
--    valida con la misma regla de la app y se guarda con bcrypt y cifrado con la
--    clave operario_pin_key de Vault (la crea la 0475).
select public.validate_operario_pin_format(:'pin_ve');
select public.validate_operario_pin_format(:'pin_cn');

insert into public.operario_pins (id, tenant_id, warehouse_id, display_name, display_name_cn,
                                  pin_hash, pin_cifrado, role, roles, region, active)
select '05400000-0000-4000-8000-000000000201'::uuid, t.id, null::uuid, 'Operario VE PRUEBA', null::text,
       extensions.crypt(:'pin_ve', extensions.gen_salt('bf')), public.operario_pin_cifrar(:'pin_ve'),
       'bodeguero', array['bodeguero']::text[], 've'::public.operario_region, true
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set pin_hash = excluded.pin_hash, pin_cifrado = excluded.pin_cifrado, active = true;

insert into public.operario_pins (id, tenant_id, warehouse_id, display_name, display_name_cn,
                                  pin_hash, pin_cifrado, role, roles, region, active)
select '05400000-0000-4000-8000-000000000202'::uuid, t.id,
       (select w.id from public.warehouses_cn w where w.active order by w.display_order, w.code limit 1),
       'Operario CN PRUEBA', '测试操作员',
       extensions.crypt(:'pin_cn', extensions.gen_salt('bf')), public.operario_pin_cifrar(:'pin_cn'),
       'operario', array['operario']::text[], 'cn'::public.operario_region, true
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set pin_hash = excluded.pin_hash, pin_cifrado = excluded.pin_cifrado, active = true;

-- 5. Proveedor CN del cliente y una prealerta con su link público /p/<token>.
insert into public.suppliers_cn (id, tenant_id, client_markbox, supplier_seq, name, city, wechat,
                                 contact, legal_name_cn, contact_name, contact_name_cn,
                                 contact_phone, contact_email, status)
select '05400000-0000-4000-8000-000000000301'::uuid, t.id, 'DTD-9001', 1,
       'Proveedor PRUEBA Yiwu', 'Yiwu', 'prueba_wx_0001', 'Contacto PRUEBA',
       '义乌测试样品贸易有限公司', 'Contacto PRUEBA', '测试联系人',
       '+12025550103', 'proveedor@prueba.example.test', 'aprobado'
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set name = excluded.name, contact_phone = excluded.contact_phone,
      contact_email = excluded.contact_email, deleted_at = null;

insert into public.prealertas (id, tenant_id, client_markbox, supplier_id, code, description,
                               boxes, est_value_usd, status, share_token)
select '05400000-0000-4000-8000-000000000302'::uuid, t.id, 'DTD-9001', '05400000-0000-4000-8000-000000000301'::uuid,
       'DTD-9001-1-1', 'Compra de PRUEBA: muestras sintéticas', 2, 100.00, 'anunciada',
       '05400000-0000-4000-8000-000000000303'::uuid
  from public.tenants t where t.slug = 'dtd'
on conflict (id) do update
  set share_token = excluded.share_token, deleted_at = null;

-- 6. Lo que las migraciones siembran como demo (clientes de la 0006, agentes de
--    aduana de la 0010, choferes de la 0011, nómina de la 0160…) trae correos y
--    teléfonos con formato real. En prueba se reemplazan por valores reservados,
--    en toda columna de texto de `public` cuyo nombre termina en email, phone,
--    telefono, whatsapp o celular (y phone_legacy). Determinista: md5 del valor.
do $semilla_reservados$
declare
  r record;
  fallas text := '';
begin
  for r in
    select c.table_name, c.column_name, c.column_name ~ 'mail' as es_correo
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.data_type in ('text', 'character varying')
       and c.is_generated = 'NEVER'
       and c.column_name ~ '(^|_)(email|phone|telefono|whatsapp|celular)(_legacy)?$'
     order by c.table_name, c.column_name
  loop
    begin
      if r.es_correo then
        execute format(
          'update public.%I set %I = %L || md5(%I) || %L where %I is not null and %I !~* %L',
          r.table_name, r.column_name, 'dato-', r.column_name, '@prueba.example.test',
          r.column_name, r.column_name, '@([a-z0-9-]+[.])*(test|invalid)$');
      else
        execute format(
          'update public.%I set %I = %L || lpad((abs(hashtext(%I)::bigint) %% 100)::text, 2, %L) where %I is not null and %I !~ %L',
          r.table_name, r.column_name, '+120255501', r.column_name, '0',
          r.column_name, r.column_name, '^[+]120255501[0-9]{2}$');
      end if;
    exception when others then
      fallas := fallas || format(' %s.%s (%s)', r.table_name, r.column_name, sqlerrm);
    end;
  end loop;
  if fallas <> '' then
    raise notice 'semilla: columnas que no se pudieron reemplazar:%', fallas;
  end if;
end
$semilla_reservados$;

-- 7. Comprobación final sobre la BASE (no solo sobre este archivo): ningún correo
--    fuera de los dominios reservados, ningún teléfono fuera del rango, sin Kommo.
do $semilla_comprobacion$
declare
  r record;
  n bigint;
  malas text := '';
begin
  for r in
    select c.table_name, c.column_name, c.column_name ~ 'mail' as es_correo
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.data_type in ('text', 'character varying')
       and c.column_name ~ '(^|_)(email|phone|telefono|whatsapp|celular)(_legacy)?$'
  loop
    if r.es_correo then
      execute format('select count(*) from public.%I where %I is not null and %I !~* %L',
                     r.table_name, r.column_name, r.column_name, '@([a-z0-9-]+[.])*(test|invalid)$') into n;
    else
      execute format('select count(*) from public.%I where %I is not null and %I !~ %L',
                     r.table_name, r.column_name, r.column_name, '^[+]120255501[0-9]{2}$') into n;
    end if;
    if n > 0 then
      malas := malas || format(' %s.%s=%s', r.table_name, r.column_name, n);
    end if;
  end loop;
  select count(*) into n from auth.users
   where email is not null and email !~* '@([a-z0-9-]+[.])*(test|invalid)$';
  if n > 0 then
    malas := malas || format(' auth.users.email=%s', n);
  end if;
  if malas <> '' then
    raise exception 'semilla: quedan correos o teléfonos fuera de lo reservado:%', malas;
  end if;
  if pg_catalog.to_regclass('public.kommo_connections') is not null then
    execute 'select count(*) from public.kommo_connections' into n;
    if n > 0 then
      raise exception 'semilla: kommo_connections tiene % filas; en prueba no hay Kommo (D8)', n;
    end if;
  end if;
  if exists (select 1 from vault.secrets
              where name in ('kommo_cron_key', 'kommo_token_dtd_v1', 'functions_base_url')) then
    raise exception 'semilla: Vault de prueba tiene claves de Kommo o functions_base_url (D8)';
  end if;
end
$semilla_comprobacion$;

-- 8. Conteos de la semilla (los compara la prueba de idempotencia).
select 'semilla_conteo' as dato,
       (select count(*) from auth.users where id::text like '05400000-%') as cuentas,
       (select count(*) from public.user_tenants where user_id::text like '05400000-%') as personal,
       (select count(*) from public.clients where id::text like '05400000-%') as clientes,
       (select count(*) from public.client_users where id::text like '05400000-%') as portal,
       (select count(*) from public.operario_pins where id::text like '05400000-%') as operarios,
       (select count(*) from public.suppliers_cn where id::text like '05400000-%') as proveedores,
       (select count(*) from public.prealertas where id::text like '05400000-%') as prealertas;

commit;
