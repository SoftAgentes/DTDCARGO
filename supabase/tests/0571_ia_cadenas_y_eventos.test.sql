\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0571 (SDD-0704 F1-B): la cadena de hasta tres modelos por función y el registro de
-- cada intento. Fixtures ficticios y rollback: no toca prod. Los dobles (tenants, superadministradores, tenant de la
-- sesión, auditoría y auth.jwt) son los mismos del contrato de la 0570; la 0541 y la 0570 van reales.
--
-- Lo que se protege:
--   1. Aplicar la 0571 otra vez no falla.
--   2. Guardar la cadena: solo el superadministrador, con sesión y motivo; en la F1-B solo A1 y A2. De 1 a 3 puestos,
--      sin nulos, sin repetir y sin salir del catálogo (ni de otro proveedor). Guardar reemplaza la cadena entera.
--   3. Cada cambio deja su evento con el antes, el después y el motivo; los rechazados no dejan nada.
--   4. D-2 en la base: un proveedor chino en una función con datos de clientes falla en los tres puestos, aunque se
--      escriba directo; la marca de datos sale de la lista fija, no de quien escribe.
--   5. Un puesto con cuenta: el proveedor es el de la cuenta y la cuenta es del mismo tenant.
--   6. A1 con la sesión de quien redacta: lee la cadena de su tenant y anota intentos (solo códigos, sin texto).
--   7. Privilegios: anon nada; authenticated no escribe directo y la RLS le muestra solo lo suyo al superadmin;
--      service_role (A2) lee la cadena y agrega eventos, sin cambiar ni borrar.
--   8. El desarme deja la base sin la 0571 y la 0570 intacta; repetirlo no falla.

begin;

do $roles$
begin
  if pg_catalog.to_regclass('public.office_tasks') is not null or pg_catalog.to_regclass('public.tenants') is not null then
    raise exception 'TEST 0571 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
-- auth.jwt(): el aal de test.aal y, con test.amr, una autenticación por contraseña reciente, vieja o por otro método.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select pg_catalog.jsonb_build_object(
    'aal', coalesce(nullif(current_setting('test.aal', true), ''), 'aal1'),
    'amr', case coalesce(current_setting('test.amr', true), '')
      when 'reciente' then pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'method', 'password', 'timestamp', extract(epoch from pg_catalog.now())::bigint - 30))
      when 'vieja' then pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'method', 'password', 'timestamp', extract(epoch from pg_catalog.now())::bigint - 600))
      when 'otp' then pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'method', 'otp', 'timestamp', extract(epoch from pg_catalog.now())::bigint - 30))
      else '[]'::jsonb end)
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin()
  returns boolean language sql security definer stable set search_path = public
as $$ select exists (select 1 from public.platform_admins where user_id = (select auth.uid())) $$;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create table public.tenants (id uuid primary key);
create table public.tenant_users (user_id uuid primary key, tenant_id uuid not null references public.tenants(id));
create function public.get_user_tenant_id()
  returns uuid language sql security definer stable set search_path = public
as $$ select tenant_id from public.tenant_users where user_id = (select auth.uid()) $$;
grant execute on function public.get_user_tenant_id() to authenticated, service_role;

create table public.audit_entity_types (
  entity_type text primary key, status text not null, domain_code text not null,
  contract_version smallint not null default 1, introduced_by_ref text not null, deprecated_at timestamptz
);
create table public.entity_audit_log (
  id bigserial primary key, tenant_id uuid not null, entity_type text not null references public.audit_entity_types(entity_type),
  entity_id uuid not null, actor_type text not null, actor_id uuid, event_type text not null, source text not null,
  result text not null, reason text, before_data jsonb, after_data jsonb, payload jsonb
);
create function public.append_audit_event(
  p_tenant_id uuid, p_entity_type text, p_entity_id uuid, p_actor_type text, p_actor_id uuid, p_event_type text,
  p_source text, p_result text default 'succeeded', p_reason text default null, p_before_data jsonb default null,
  p_after_data jsonb default null, p_payload jsonb default '{}'::jsonb, p_correlation_id text default null,
  p_schema_version integer default 1, p_sensitivity text default 'internal')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_entity_id is null then raise exception 'doble append_audit_event: entity_id nulo'; end if;
  if p_reason is null or pg_catalog.char_length(p_reason) not between 4 and 1000 then
    raise exception 'doble append_audit_event: reason fuera de 4-1000';
  end if;
  insert into public.entity_audit_log (tenant_id, entity_type, entity_id, actor_type, actor_id, event_type, source, result,
                                       reason, before_data, after_data, payload)
  values (p_tenant_id, p_entity_type, p_entity_id, p_actor_type, p_actor_id, p_event_type, p_source, p_result,
          p_reason, p_before_data, p_after_data, p_payload);
  return p_entity_id;
end $$;

\ir ../migrations/0541_oficina_cable_tablas.sql
\ir ../migrations/0570_ia_catalogo_y_costo.sql
\ir ../migrations/0571_ia_cadenas_y_eventos.sql
-- Otra vez encima: no falla.
\ir ../migrations/0571_ia_cadenas_y_eventos.sql

-- Fixtures: un tenant, un superadministrador (SA) y un administrador normal (AD).
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000aaaa'), ('00000000-0000-0000-0000-00000000bbbb');
insert into public.tenant_users (user_id, tenant_id) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-00000000aaaa');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000005a1');

-- Ejecuta p_sql con un rol, una sesión y un nivel de AAL. Devuelve 'ok' o el mensaje del error.
create function pg_temp.como(p_rol text, p_uid text, p_aal text, p_sql text) returns text
language plpgsql as $$
declare
  v text := 'ok';
begin
  perform pg_catalog.set_config('test.uid', coalesce(p_uid, ''), true);
  perform pg_catalog.set_config('test.aal', coalesce(p_aal, ''), true);
  execute pg_catalog.format('set local role %I', p_rol);
  begin
    execute p_sql;
  exception when others then
    v := sqlerrm;
  end;
  reset role;
  perform pg_catalog.set_config('test.uid', '', true);
  perform pg_catalog.set_config('test.aal', '', true);
  return v;
end $$;

create function pg_temp.espera(p_resultado text, p_patron text, p_contrato text) returns void
language plpgsql as $$
begin
  if p_resultado is null or p_resultado not like p_patron then
    raise exception '%: se esperaba «%» y salió «%»', p_contrato, p_patron, p_resultado;
  end if;
end $$;

-- 1. La 0571 se aplicó dos veces (arriba) sin fallar.
do $c1$
begin
  if pg_catalog.to_regclass('public.ia_cadenas') is null or pg_catalog.to_regclass('public.ia_eventos') is null then
    raise exception 'CONTRATO 1: faltan las tablas de la 0571';
  end if;
end $c1$;

-- 2. Guardar la cadena: quién, qué función y qué forma.
do $c2$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
  ad text := '00000000-0000-0000-0000-0000000000ad';
begin
  perform pg_temp.espera(pg_temp.como('authenticated', null, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-sonnet-5-5'], 'motivo de prueba')$$),
    '%ia:sin_sesion%', 'CONTRATO 2 sin sesión');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-sonnet-5-5'], 'motivo de prueba')$$),
    '%ia:solo_superadmin%', 'CONTRATO 2 admin normal');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-sonnet-5-5'], 'no')$$),
    '%ia:motivo%', 'CONTRATO 2 motivo corto');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('oficina', array['anthropic'], array['claude-sonnet-5-5'], 'la oficina todavía no')$$),
    '%ia:funcion_no_editable%', 'CONTRATO 2 la Oficina no se edita en la F1-B');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array[]::text[], array[]::text[], 'cadena vacía')$$),
    '%ia:cadena_invalida%', 'CONTRATO 2 sin 1.º');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic','anthropic','anthropic','anthropic'],
      array['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5','claude-sonnet-4-6'], 'cuatro puestos')$$),
    '%ia:cadena_invalida%', 'CONTRATO 2 cuarto puesto');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-sonnet-5-5','claude-haiku-5-5'], 'largos distintos')$$),
    '%ia:cadena_invalida%', 'CONTRATO 2 largos distintos');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic', null], array['claude-sonnet-5-5', 'claude-haiku-5-5'], 'con un nulo')$$),
    '%ia:cadena_invalida%', 'CONTRATO 2 nulo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-inventado'], 'fuera del catálogo')$$),
    '%ia_cadenas_modelo_del_catalogo%', 'CONTRATO 2 modelo fuera del catálogo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['glm-5.3'], 'de otro proveedor')$$),
    '%ia_cadenas_modelo_del_catalogo%', 'CONTRATO 2 modelo de otro proveedor');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic','anthropic'], array['claude-sonnet-5-5','claude-sonnet-5-5'], 'repetido')$$),
    '%ia_cadenas_sin_repetir%', 'CONTRATO 2 modelo repetido');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic','anthropic','anthropic'],
      array['claude-sonnet-5-5','claude-haiku-5-5','claude-opus-5-5'], 'tres puestos')$$),
    'ok', 'CONTRATO 2 tres puestos');
  if (select pg_catalog.string_agg(modelo, ',' order by puesto) from public.ia_cadenas where funcion = 'a1_noticias')
     <> 'claude-sonnet-5-5,claude-haiku-5-5,claude-opus-5-5' then
    raise exception 'CONTRATO 2: el orden de los puestos no es el pedido';
  end if;
  -- Guardar de nuevo reemplaza la cadena entera.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-haiku-5-5'], 'uno solo')$$),
    'ok', 'CONTRATO 2 reemplazo');
  if (select pg_catalog.count(*) from public.ia_cadenas where funcion = 'a1_noticias') <> 1 then
    raise exception 'CONTRATO 2: guardar no reemplazó la cadena';
  end if;
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_cadena('a2_brief', array['anthropic','anthropic'], array['claude-sonnet-5-5','claude-haiku-5-5'], 'cadena del brief')$$),
    'ok', 'CONTRATO 2 A2');
end $c2$;

-- 3. Auditoría: cada cambio con antes, después y motivo; los rechazados no dejan evento.
do $c3$
begin
  if not exists (select 1 from public.entity_audit_log
                  where event_type = 'ia_cadena_guardada' and reason = 'uno solo'
                    and before_data -> 'cadena' -> 0 ->> 'modelo' = 'claude-sonnet-5-5'
                    and after_data -> 'cadena' -> 0 ->> 'modelo' = 'claude-haiku-5-5'
                    and pg_catalog.jsonb_array_length(after_data -> 'cadena') = 1) then
    raise exception 'CONTRATO 3: falta el evento con el antes y el después';
  end if;
  if exists (select 1 from public.entity_audit_log
              where event_type = 'ia_cadena_guardada' and reason in ('repetido', 'fuera del catálogo', 'cuatro puestos')) then
    raise exception 'CONTRATO 3: un cambio rechazado dejó evento';
  end if;
end $c3$;

-- 4. D-2 en la base, en los tres puestos, aunque se escriba directo (dueño, sin pasar por la función).
do $c4$
declare
  t uuid := '00000000-0000-0000-0000-00000000aaaa';
  p integer;
begin
  for p in 1..3 loop
    perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
      $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo, datos_clientes)
        values (%L, 'a5_documentos', %s, 'zai', 'glm-5.3', false)$$, t, p)),
      '%ia_cadenas_datos_no_chino%', pg_catalog.format('CONTRATO 4 chino con datos en el puesto %s', p));
    perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
      $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
        values (%L, 'oficina', %s, 'deepseek', 'deepseek-chat')$$, t, p)),
      '%ia_cadenas_datos_no_chino%', pg_catalog.format('CONTRATO 4 DeepSeek en la Oficina, puesto %s', p));
  end loop;
  -- Sin datos de clientes, un chino sí entra (la regla es por función).
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo, datos_clientes)
      values (%L, 'a8_analisis_chatwoot', 1, 'zai', 'glm-5.3', true)$$, t)),
    'ok', 'CONTRATO 4 chino sin datos');
  if (select datos_clientes from public.ia_cadenas where funcion = 'a8_analisis_chatwoot') then
    raise exception 'CONTRATO 4: la marca de datos la eligió quien escribe';
  end if;
  -- Pasar un puesto con datos a un chino por update también falla.
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
      values (%L, 'a3_actas', 1, 'anthropic', 'claude-haiku-5-5')$$, t)),
    'ok', 'CONTRATO 4 Anthropic con datos');
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1',
    $$update public.ia_cadenas set proveedor = 'zai', modelo = 'glm-4.6' where funcion = 'a3_actas'$$),
    '%ia_cadenas_datos_no_chino%', 'CONTRATO 4 update a chino con datos');
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
      values (%L, 'a1_noticias', 2, 'proveedor-x', 'claude-haiku-5-5')$$, t)),
    '%ia_cadenas_proveedor_valido%', 'CONTRATO 4 proveedor fuera de la lista');
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
      values (%L, 'a1_noticias', 4, 'anthropic', 'claude-opus-5-5')$$, t)),
    '%ia_cadenas_puesto_valido%', 'CONTRATO 4 cuarto puesto directo');
end $c4$;

-- 5. Un puesto que nombra una cuenta: mismo proveedor y mismo tenant.
do $c5$
declare
  t uuid := '00000000-0000-0000-0000-00000000aaaa';
  otro uuid := '00000000-0000-0000-0000-00000000bbbb';
  v_openai uuid;
  v_ajena uuid;
begin
  insert into public.ia_cuentas (tenant_id, alias, proveedor, uso, tipo_cobro)
  values (t, 'Cuenta OpenAI', 'openai', 'erp', 'por_token') returning id into v_openai;
  insert into public.ia_cuentas (tenant_id, alias, proveedor, uso, tipo_cobro)
  values (otro, 'Cuenta ajena', 'anthropic', 'erp', 'por_token') returning id into v_ajena;
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo, cuenta_id)
      values (%L, 'a2_brief', 3, 'anthropic', 'claude-opus-5-5', %L)$$, t, v_openai)),
    '%ia:proveedor_distinto_de_la_cuenta%', 'CONTRATO 5 proveedor distinto de la cuenta');
  perform pg_temp.espera(pg_temp.como(current_user::text, null, 'aal1', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo, cuenta_id)
      values (%L, 'a2_brief', 3, 'anthropic', 'claude-opus-5-5', %L)$$, t, v_ajena)),
    '%ia:cuenta_de_otro_tenant%', 'CONTRATO 5 cuenta de otro tenant');
end $c5$;

-- 6. A1 lee su cadena y anota intentos con la sesión de quien redacta.
do $c6$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
  ad text := '00000000-0000-0000-0000-0000000000ad';
  otro uuid := '00000000-0000-0000-0000-00000000bbbb';
begin
  insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
  values (otro, 'a1_noticias', 1, 'anthropic', 'claude-opus-5-5');
  perform pg_temp.espera(pg_temp.como('authenticated', null, 'aal1',
    $$select * from public.ia_cadena_de('a1_noticias')$$), '%ia:sin_sesion%', 'CONTRATO 6 cadena sin sesión');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select * from public.ia_cadena_de('a2_brief')$$), '%ia:funcion_no_editable%', 'CONTRATO 6 A2 no va por sesión');
  -- El admin normal (no superadmin) lee la cadena de SU tenant, y solo esa.
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $q$do $x$ begin
      if (select pg_catalog.string_agg(modelo, ',') from public.ia_cadena_de('a1_noticias')) <> 'claude-haiku-5-5' then
        raise exception 'CONTRATO 6: la cadena leída no es la del tenant';
      end if;
    end $x$ $q$), 'ok', 'CONTRATO 6 cadena del tenant');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a1_noticias', 1, 'anthropic', 'claude-haiku-5-5', 'proveedor_caido', 529, 'overloaded_error', null, null)$$),
    'ok', 'CONTRATO 6 anota un intento');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a1_noticias', 2, 'anthropic', 'claude-sonnet-5-5', 'ok', 200, null, 120, 80)$$),
    'ok', 'CONTRATO 6 anota el ok');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a1_noticias', 1, 'anthropic', 'claude-haiku-5-5', 'se cayó', null, null, null, null)$$),
    '%ia_eventos_resultado_valido%', 'CONTRATO 6 resultado fuera de la lista');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a1_noticias', 1, 'anthropic', 'claude-haiku-5-5', 'otro', 400, 'texto con espacios', null, null)$$),
    '%ia_eventos_codigo_valido%', 'CONTRATO 6 un código no es texto');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a2_brief', 1, 'anthropic', 'claude-haiku-5-5', 'ok', 200, null, null, null)$$),
    '%ia:funcion_no_editable%', 'CONTRATO 6 A2 no anota por sesión');
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $$select public.ia_registrar_evento('a1_noticias', 4, 'anthropic', 'claude-haiku-5-5', 'ok', 200, null, null, null)$$),
    '%ia_eventos_puesto_valido%', 'CONTRATO 6 cuarto puesto');
  if (select pg_catalog.count(*) from public.ia_eventos
       where tenant_id = '00000000-0000-0000-0000-00000000aaaa' and funcion = 'a1_noticias') <> 2 then
    raise exception 'CONTRATO 6: los intentos no quedaron en el tenant de la sesión';
  end if;
end $c6$;

-- 7. Privilegios y RLS.
do $c7$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
  ad text := '00000000-0000-0000-0000-0000000000ad';
begin
  perform pg_temp.espera(pg_temp.como('anon', null, null, $$select count(*) from public.ia_cadenas$$),
    '%permission denied%', 'CONTRATO 7 anon no lee la cadena');
  perform pg_temp.espera(pg_temp.como('anon', null, null, $$select * from public.ia_cadena_de('a1_noticias')$$),
    '%permission denied%', 'CONTRATO 7 anon no ejecuta');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$insert into public.ia_cadenas (tenant_id, funcion, puesto, proveedor, modelo)
      values (%L, 'a2_brief', 3, 'anthropic', 'claude-opus-5-5')$$, '00000000-0000-0000-0000-00000000aaaa')),
    '%permission denied%', 'CONTRATO 7 authenticated no escribe la cadena');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$insert into public.ia_eventos (tenant_id, funcion, puesto, proveedor, modelo, resultado)
      values (%L, 'a1_noticias', 1, 'anthropic', 'claude-opus-5-5', 'ok')$$, '00000000-0000-0000-0000-00000000aaaa')),
    '%permission denied%', 'CONTRATO 7 authenticated no escribe eventos directo');
  -- RLS: el admin normal no ve filas; el superadmin ve las de su tenant y no las del otro.
  perform pg_temp.espera(pg_temp.como('authenticated', ad, 'aal1',
    $q$do $x$ begin
      if (select count(*) from public.ia_cadenas) <> 0 or (select count(*) from public.ia_eventos) <> 0 then
        raise exception 'CONTRATO 7: el admin normal ve la cadena o los eventos';
      end if;
    end $x$ $q$), 'ok', 'CONTRATO 7 RLS admin normal');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $q$do $x$ begin
      if exists (select 1 from public.ia_cadenas where tenant_id <> '00000000-0000-0000-0000-00000000aaaa')
         or (select count(*) from public.ia_eventos) <> 2 then
        raise exception 'CONTRATO 7: el superadmin ve otro tenant o no ve el suyo';
      end if;
    end $x$ $q$), 'ok', 'CONTRATO 7 RLS superadmin');
  -- La clave de servicio (A2): lee la cadena y agrega eventos; no cambia la cadena ni borra eventos.
  perform pg_temp.espera(pg_temp.como('service_role', null, null,
    $$select count(*) from public.ia_cadenas where funcion = 'a2_brief'$$), 'ok', 'CONTRATO 7 service_role lee');
  perform pg_temp.espera(pg_temp.como('service_role', null, null, pg_catalog.format(
    $$insert into public.ia_eventos (tenant_id, funcion, puesto, proveedor, modelo, resultado, status)
      values (%L, 'a2_brief', 1, 'anthropic', 'claude-sonnet-5-5', 'ok', 200)$$, '00000000-0000-0000-0000-00000000aaaa')),
    'ok', 'CONTRATO 7 service_role agrega un evento');
  perform pg_temp.espera(pg_temp.como('service_role', null, null,
    $$delete from public.ia_eventos$$), '%permission denied%', 'CONTRATO 7 service_role no borra eventos');
  perform pg_temp.espera(pg_temp.como('service_role', null, null,
    $$update public.ia_cadenas set modelo = 'claude-opus-5-5'$$), '%permission denied%', 'CONTRATO 7 service_role no cambia la cadena');
  perform pg_temp.espera(pg_temp.como('service_role', null, null,
    $$select public.ia_guardar_cadena('a1_noticias', array['anthropic'], array['claude-haiku-5-5'], 'desde el servicio')$$),
    '%permission denied%', 'CONTRATO 7 service_role no usa la pantalla');
end $c7$;

-- 8. Desarme: la base queda sin la 0571; la 0570 sigue; repetirlo no falla.
\ir ../desarmes/0571_desarme.sql
\ir ../desarmes/0571_desarme.sql
do $c8$
begin
  if pg_catalog.to_regclass('public.ia_cadenas') is not null or pg_catalog.to_regclass('public.ia_eventos') is not null
     or pg_catalog.to_regprocedure('public.ia_cadena_de(text)') is not null
     or pg_catalog.to_regprocedure('public.ia_cadenas_coherente()') is not null then
    raise exception 'CONTRATO 8: el desarme dejó objetos de la 0571';
  end if;
  if pg_catalog.to_regclass('public.ia_cuentas') is null or pg_catalog.to_regclass('public.ia_catalogo_modelos') is null then
    raise exception 'CONTRATO 8: el desarme tocó la 0570';
  end if;
end $c8$;

\echo 'contrato 0571 en verde'
rollback;
