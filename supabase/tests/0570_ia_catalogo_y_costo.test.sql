\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0570 (SDD-0704 F1-A): catálogo, cuentas con tipo de cobro, tarifa por modelo y
-- tope del mes de la pantalla «IA», con la Oficina incluida. Fixtures ficticios y rollback: no toca prod.
--
-- Las tablas de las que depende (tenants, el catálogo y el registro de auditoría) son réplicas mínimas;
-- append_audit_event es un doble que anota la fila. La 0541 (task_events, office_paused) va real.
--
-- Lo que se protege:
--   1. Aplicar la 0570 otra vez no falla; el catálogo queda sembrado y el origen sale del proveedor (D-2).
--   2. Solo el superadministrador escribe, con sesión, tenant y motivo (4-200).
--   3. Cuentas: plan fijo exige tope de llamadas; la cuenta de la Oficina no es china y es una sola.
--   4. AAL2 para aflojar en cuentas: alta en plan fijo, por token → plan fijo, subir o quitar el tope de llamadas.
--      Apretar (bajarlo, plan fijo → por token) no lo pide.
--   5. Modelos: fuera del catálogo o de otro proveedor no entra; por token exige tarifa, plan fijo no la lleva.
--      AAL2 para la primera tarifa de la cuenta (el previo es el .env), para un alta con tarifa menor que la mayor
--      declarada, para bajar una tarifa y para quitar un modelo con tarifa. Subirla o un alta mayor no lo pide.
--   6. Topes: el primero (previo = .env) y subirlo piden AAL2; bajarlo no; la Oficina no pasa de 15 USD; quitarlo
--      pide AAL2.
--   7. Auditoría: cada cambio deja su evento con antes, después y motivo.
--   8. ia_costo_oficina() (service_role) devuelve el tope, la cuenta y las tarifas de la Oficina.
--   9. Tokens y llamadas: task_events acepta los tokens; la auto-pausa por llamadas SOLO pausa, al 80 %.
--  10. ia_gasto_del_mes(): por modelo, solo para el superadministrador.
--  11. Privilegios: anon nada; authenticated lee (con RLS) y no escribe tablas; no ejecuta las del despachador;
--      service_role no ejecuta las de la pantalla.
--  12. El desarme deja la base sin objetos de la 0570; repetirlo no falla.
--  13. La barrera (D-5 de Sam, 2026-11-21): aflojar pasa con AAL2 o con la contraseña de hace menos de 5 minutos
--      (amr «password»); una contraseña vieja u otro método no alcanzan. La auditoría guarda el método.

begin;

do $roles$
begin
  if pg_catalog.to_regclass('public.office_tasks') is not null or pg_catalog.to_regclass('public.tenants') is not null then
    raise exception 'TEST 0570 requiere una base PostgreSQL desechable vacía';
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
-- Otra vez encima: no falla.
\ir ../migrations/0570_ia_catalogo_y_costo.sql

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

-- 1. Catálogo sembrado y origen atado al proveedor.
do $c1$
begin
  if (select count(*) from public.ia_catalogo_modelos) <> 7 then
    raise exception 'CONTRATO 1: el catálogo no quedó sembrado con 7 modelos';
  end if;
  begin
    insert into public.ia_catalogo_modelos values ('zai', 'glm-x', 'no_chino');
    raise exception 'CONTRATO 1: un modelo de zai entró como no chino';
  exception when check_violation then null;
  end;
  begin
    insert into public.ia_catalogo_modelos values ('anthropic', 'otro', 'chino');
    raise exception 'CONTRATO 1: un modelo de anthropic entró como chino';
  exception when check_violation then null;
  end;
end $c1$;

-- 2. Quién escribe.
select pg_temp.espera(pg_temp.como('authenticated', null, 'aal2',
  $$select public.ia_guardar_tope('oficina', 3, 'motivo de prueba')$$), '%ia:sin_sesion%', 'CONTRATO 2 sin sesión');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000000ad', 'aal2',
  $$select public.ia_guardar_tope('oficina', 3, 'motivo de prueba')$$), '%ia:solo_superadmin%', 'CONTRATO 2 admin normal');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal2',
  $$select public.ia_guardar_tope('oficina', 3, 'no')$$), '%ia:motivo%', 'CONTRATO 2 motivo corto');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal2',
  $$select public.ia_guardar_tope('oficina', 3, ' con espacios ')$$), '%ia:motivo%', 'CONTRATO 2 motivo sin recortar');

-- 3 y 4. Cuentas.
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal2',
  $$select public.ia_guardar_cuenta(null, 'Oficina china', 'zai', 'oficina', 'por_token', null, 'prueba D-2')$$),
  '%ia_cuentas_oficina_no_china%', 'CONTRATO 3 oficina china');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal2',
  $$select public.ia_guardar_cuenta(null, 'Plan sin tope', 'zai', 'erp', 'plan_fijo', null, 'prueba D-4')$$),
  '%ia_cuentas_plan_fijo_con_tope%', 'CONTRATO 3 plan fijo sin tope');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal1',
  $$select public.ia_guardar_cuenta(null, 'Plan de análisis', 'zai', 'erp', 'plan_fijo', 150, 'alta del plan')$$),
  '%ia:requiere_aal2%', 'CONTRATO 4 alta plan fijo sin AAL2');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal2',
  $$select public.ia_guardar_cuenta(null, 'Plan de análisis', 'zai', 'erp', 'plan_fijo', 150, 'alta del plan')$$),
  'ok', 'CONTRATO 4 alta plan fijo con AAL2');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal1',
  $$select public.ia_guardar_cuenta(null, 'Oficina Anthropic', 'anthropic', 'oficina', 'por_token', null, 'alta de la oficina')$$),
  'ok', 'CONTRATO 4 alta por token sin AAL2');
select pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000005a1', 'aal1',
  $$select public.ia_guardar_cuenta(null, 'Otra oficina', 'openai', 'oficina', 'por_token', null, 'segunda oficina')$$),
  '%ia_cuentas_una_oficina%', 'CONTRATO 3 una sola oficina');

do $c4$
declare
  v_plan uuid := (select id from public.ia_cuentas where alias = 'Plan de análisis');
  v_ofi uuid := (select id from public.ia_cuentas where alias = 'Oficina Anthropic');
  sa text := '00000000-0000-0000-0000-0000000005a1';
begin
  -- Plan fijo: subir el tope de llamadas afloja; bajarlo no.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'plan_fijo', 200, 'subir llamadas')$$, v_plan)),
    '%ia:requiere_aal2%', 'CONTRATO 4 subir tope de llamadas sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'plan_fijo', 100, 'bajar llamadas')$$, v_plan)),
    'ok', 'CONTRATO 4 bajar tope de llamadas sin AAL2');
  -- Plan fijo → por token aprieta (vuelve a sumar USD): sin AAL2 pasa, y deja de exigir el tope de llamadas.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'por_token', 100, 'pasar a por token')$$, v_plan)),
    'ok', 'CONTRATO 4 plan fijo a por token sin AAL2');
  -- Quitar el tope de llamadas afloja.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'por_token', null, 'quitar llamadas')$$, v_plan)),
    '%ia:requiere_aal2%', 'CONTRATO 4 quitar tope de llamadas sin AAL2');
  -- Por token → plan fijo afloja.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Oficina Anthropic', 'anthropic', 'oficina', 'plan_fijo', 500, 'a plan fijo')$$, v_ofi)),
    '%ia:requiere_aal2%', 'CONTRATO 4 por token a plan fijo sin AAL2');
end $c4$;

-- 5. Modelos y tarifas.
do $c5$
declare
  v_ofi uuid := (select id from public.ia_cuentas where alias = 'Oficina Anthropic');
  v_plan uuid := (select id from public.ia_cuentas where alias = 'Plan de análisis');
  sa text := '00000000-0000-0000-0000-0000000005a1';
begin
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'gpt-inventado', 1, 2, 'fuera del catálogo')$$, v_ofi)),
    '%foreign key%', 'CONTRATO 5 modelo fuera del catálogo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'glm-5.3', 1, 2, 'de otro proveedor')$$, v_ofi)),
    '%foreign key%', 'CONTRATO 5 modelo de otro proveedor');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-sonnet-5-5', null, null, 'por token sin tarifa')$$, v_ofi)),
    '%ia:por_token_sin_tarifa%', 'CONTRATO 5 por token sin tarifa');
  -- Primera tarifa de la cuenta: el previo es el .env → AAL2 siempre.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-sonnet-5-5', 3, 15, 'primera tarifa')$$, v_ofi)),
    '%ia:requiere_aal2%', 'CONTRATO 5 primera tarifa sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-sonnet-5-5', 3, 15, 'primera tarifa')$$, v_ofi)),
    'ok', 'CONTRATO 5 primera tarifa con AAL2');
  -- Alta con tarifa menor que la mayor declarada: afloja.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-haiku-5-5', 1, 5, 'alta más barata')$$, v_ofi)),
    '%ia:requiere_aal2%', 'CONTRATO 5 alta con tarifa menor sin AAL2');
  -- Alta con tarifa mayor o igual: no afloja.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-opus-5-5', 5, 25, 'alta más cara')$$, v_ofi)),
    'ok', 'CONTRATO 5 alta con tarifa mayor sin AAL2');
  -- Subir una tarifa: no afloja. Bajarla: sí.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-sonnet-5-5', 4, 16, 'subir tarifa')$$, v_ofi)),
    'ok', 'CONTRATO 5 subir tarifa sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'claude-sonnet-5-5', 3, 16, 'bajar tarifa')$$, v_ofi)),
    '%ia:requiere_aal2%', 'CONTRATO 5 bajar tarifa sin AAL2');
  -- Quitar un modelo con tarifa: afloja.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_borrar_modelo(%L, 'quitar el opus')$$,
    (select id from public.ia_modelos where modelo = 'claude-opus-5-5'))),
    '%ia:requiere_aal2%', 'CONTRATO 5 quitar modelo sin AAL2');
  -- Plan fijo no lleva tarifa.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'plan_fijo', 100, 'de vuelta a plan fijo')$$, v_plan)),
    'ok', 'CONTRATO 5 de vuelta a plan fijo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'glm-5.3', 1, 2, 'plan con tarifa')$$, v_plan)),
    '%ia:plan_fijo_con_tarifa%', 'CONTRATO 5 plan fijo con tarifa');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_modelo(%L, 'glm-5.3', null, null, 'plan sin tarifa')$$, v_plan)),
    'ok', 'CONTRATO 5 plan fijo sin tarifa ni AAL2');
  -- Una cuenta con modelos sin tarifa no pasa a por token.
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1', pg_catalog.format(
    $$select public.ia_guardar_cuenta(%L, 'Plan de análisis', 'zai', 'erp', 'por_token', 100, 'a por token con modelos')$$, v_plan)),
    '%ia:por_token_sin_tarifa%', 'CONTRATO 5 por token con modelos sin tarifa');
end $c5$;

-- 6. Topes.
do $c6$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
begin
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 3, 'primer tope')$$), '%ia:requiere_aal2%', 'CONTRATO 6 primer tope sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$select public.ia_guardar_tope('oficina', 16, 'sobre el techo')$$), '%ia_topes_techo_oficina%', 'CONTRATO 6 techo de 15');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$select public.ia_guardar_tope('oficina', 3, 'primer tope')$$), 'ok', 'CONTRATO 6 primer tope con AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 2, 'bajar tope')$$), 'ok', 'CONTRATO 6 bajar sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 2.5, 'subir tope')$$), '%ia:requiere_aal2%', 'CONTRATO 6 subir sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_borrar_tope('oficina', 'volver al entorno')$$), '%ia:requiere_aal2%', 'CONTRATO 6 quitar sin AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$select public.ia_guardar_tope('otra', 2, 'función desconocida')$$), '%ia_topes_funcion_valida%', 'CONTRATO 6 función desconocida');
  if (select tope_usd from public.ia_topes where funcion = 'oficina') <> 2 then
    raise exception 'CONTRATO 6: el tope de la Oficina no quedó en 2';
  end if;
end $c6$;

-- 7. Auditoría.
do $c7$
declare
  v record;
begin
  select * into v from public.entity_audit_log where event_type = 'ia_tope_guardado' and reason = 'bajar tope';
  if not found or (v.before_data ->> 'tope_usd')::numeric <> 3 or (v.after_data ->> 'tope_usd')::numeric <> 2
     or v.actor_id <> '00000000-0000-0000-0000-0000000005a1' or v.entity_type <> 'ia_config' then
    raise exception 'CONTRATO 7: el evento de bajar el tope no tiene antes, después, actor o tipo';
  end if;
  if (select count(*) from public.entity_audit_log where event_type = 'ia_modelo_guardado') < 4 then
    raise exception 'CONTRATO 7: faltan eventos de modelos';
  end if;
  -- Los intentos rechazados no dejan evento (la mutación y el evento son una operación).
  if exists (select 1 from public.entity_audit_log where reason in ('subir tope', 'bajar tarifa', 'quitar el opus')) then
    raise exception 'CONTRATO 7: un cambio rechazado dejó evento';
  end if;
end $c7$;

-- 8. Lo que lee el despachador.
do $c8$
declare
  v jsonb;
begin
  set local role service_role;
  v := public.ia_costo_oficina();
  reset role;
  if v ->> 'version' <> '1' or (v ->> 'tope_usd')::numeric <> 2
     or v -> 'cuenta' ->> 'tipo_cobro' <> 'por_token'
     or pg_catalog.jsonb_array_length(v -> 'modelos') <> 2 then
    raise exception 'CONTRATO 8: ia_costo_oficina devolvió %', v;
  end if;
end $c8$;

-- 9. Tokens, llamadas del mes y auto-pausa por llamadas.
insert into public.office_tasks (id, titulo) values ('00000000-0000-0000-0000-00000000f001', 'tarea de prueba');
do $c9$
declare
  i integer;
  v boolean;
  n integer;
begin
  set local role service_role;
  for i in 1..4 loop
    insert into public.task_events (task_id, tipo, actor, resumen, costo_usd, modelo_usado, tokens_entrada, tokens_salida)
    values ('00000000-0000-0000-0000-00000000f001', 'modelo.respuesta', 'agente:soporte-chatwoot', null, 0.01,
            case when i = 4 then 'claude-haiku-5-5' else 'claude-sonnet-5-5' end, 1000, 200);
  end loop;
  if public.ia_oficina_llamadas_del_mes() <> 4 then
    raise exception 'CONTRATO 9: las llamadas del mes no son 4';
  end if;
  n := (select count(*) from public.office_paused);
  -- La oficina nace pausada (0541): se despausa como dueño para medir.
  reset role;
  insert into public.office_paused (pausada, motivo) values (false, 'prueba: despausada');
  n := (select count(*) from public.office_paused);
  set local role service_role;
  v := public.ia_oficina_autopausar_por_llamadas(10, 0.8);
  if v or (select count(*) from public.office_paused) <> n then
    raise exception 'CONTRATO 9: 4 de 10 llamadas no debía pausar';
  end if;
  v := public.ia_oficina_autopausar_por_llamadas(5, 0.8);
  if not v or not public.office_esta_pausada() then
    raise exception 'CONTRATO 9: 4 de 5 llamadas (80 %%) debía pausar';
  end if;
  -- Ya pausada: no agrega otra fila, y nunca agrega «false».
  n := (select count(*) from public.office_paused);
  v := public.ia_oficina_autopausar_por_llamadas(5, 0.8);
  if (select count(*) from public.office_paused) <> n then
    raise exception 'CONTRATO 9: la auto-pausa repetida agregó filas';
  end if;
  reset role;
  if exists (select 1 from public.office_paused where pausada = false and motivo like 'Auto-pausa%') then
    raise exception 'CONTRATO 9: la auto-pausa despausó';
  end if;
  begin
    insert into public.task_events (task_id, tipo, actor, tokens_entrada) values
      ('00000000-0000-0000-0000-00000000f001', 'modelo.respuesta', 'agente:soporte-chatwoot', -1);
    raise exception 'CONTRATO 9: entró un token negativo';
  exception when check_violation then null;
  end;
end $c9$;

-- 10. Gasto del mes por modelo.
do $c10$
declare
  v record;
begin
  perform pg_temp.espera(pg_temp.como('authenticated', '00000000-0000-0000-0000-0000000000ad', 'aal2',
    $$select * from public.ia_gasto_del_mes()$$), '%ia:solo_superadmin%', 'CONTRATO 10 admin normal');
  perform pg_catalog.set_config('test.uid', '00000000-0000-0000-0000-0000000005a1', true);
  set local role authenticated;
  select * into v from public.ia_gasto_del_mes() where modelo = 'claude-sonnet-5-5';
  reset role;
  perform pg_catalog.set_config('test.uid', '', true);
  if v.llamadas <> 3 or v.tokens_entrada <> 3000 or v.tokens_salida <> 600 or v.costo_usd <> 0.03 then
    raise exception 'CONTRATO 10: el gasto de sonnet salió %', v;
  end if;
end $c10$;

-- 11. Privilegios.
do $c11$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
begin
  perform pg_temp.espera(pg_temp.como('anon', null, null, $$select count(*) from public.ia_cuentas$$),
    '%permission denied%', 'CONTRATO 11 anon lee');
  perform pg_temp.espera(pg_temp.como('anon', null, null, $$select public.ia_guardar_tope('oficina', 1, 'anon escribe')$$),
    '%permission denied%', 'CONTRATO 11 anon escribe');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$insert into public.ia_topes (tenant_id, funcion, tope_usd) values ('00000000-0000-0000-0000-00000000aaaa', 'oficina', 1)$$),
    '%permission denied%', 'CONTRATO 11 authenticated inserta directo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$update public.ia_modelos set tarifa_entrada_usd_mtok = 0.001$$), '%permission denied%', 'CONTRATO 11 authenticated edita directo');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2', $$select public.ia_costo_oficina()$$),
    '%permission denied%', 'CONTRATO 11 authenticated lee lo del despachador');
  perform pg_temp.espera(pg_temp.como('service_role', null, 'aal2', $$select public.ia_guardar_tope('oficina', 1, 'servicio escribe')$$),
    '%permission denied%', 'CONTRATO 11 service_role usa la pantalla');
  -- RLS: el superadministrador lee las filas de su tenant; el admin normal, ninguna.
  perform pg_catalog.set_config('test.uid', sa, true);
  set local role authenticated;
  if (select count(*) from public.ia_cuentas) <> 2 then
    raise exception 'CONTRATO 11: el superadministrador no ve sus cuentas';
  end if;
  reset role;
  perform pg_catalog.set_config('test.uid', '00000000-0000-0000-0000-0000000000ad', true);
  set local role authenticated;
  if (select count(*) from public.ia_cuentas) <> 0 or (select count(*) from public.ia_catalogo_modelos) <> 0 then
    raise exception 'CONTRATO 11: un admin normal ve la configuración';
  end if;
  reset role;
  perform pg_catalog.set_config('test.uid', '', true);
end $c11$;

-- 13. La barrera: contraseña reciente o AAL2, y el método en la auditoría.
do $c13$
declare
  sa text := '00000000-0000-0000-0000-0000000005a1';
begin
  perform pg_catalog.set_config('test.amr', 'reciente', true);
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 2.5, 'subir con contraseña')$$), 'ok', 'CONTRATO 13 contraseña reciente');
  perform pg_catalog.set_config('test.amr', 'vieja', true);
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 3, 'subir con contraseña vieja')$$), '%ia:requiere_aal2%', 'CONTRATO 13 contraseña vieja');
  perform pg_catalog.set_config('test.amr', 'otp', true);
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 3, 'subir con otro método')$$), '%ia:requiere_aal2%', 'CONTRATO 13 otro método');
  perform pg_catalog.set_config('test.amr', '', true);
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal2',
    $$select public.ia_guardar_tope('oficina', 3, 'subir con dos pasos')$$), 'ok', 'CONTRATO 13 AAL2');
  perform pg_temp.espera(pg_temp.como('authenticated', sa, 'aal1',
    $$select public.ia_guardar_tope('oficina', 2, 'bajar sin nada')$$), 'ok', 'CONTRATO 13 apretar');
  if (select payload ->> 'metodo' from public.entity_audit_log where reason = 'subir con contraseña') <> 'contrasena_reciente'
     or (select payload ->> 'metodo' from public.entity_audit_log where reason = 'subir con dos pasos') <> 'aal2'
     or (select payload ->> 'metodo' from public.entity_audit_log where reason = 'bajar sin nada') <> 'no_hace_falta' then
    raise exception 'CONTRATO 13: la auditoría no guardó el método de cada cambio';
  end if;
  if exists (select 1 from public.entity_audit_log where reason in ('subir con contraseña vieja', 'subir con otro método')) then
    raise exception 'CONTRATO 13: un cambio rechazado dejó evento';
  end if;
end $c13$;

-- 12. Desarme.
\ir ../desarmes/0570_desarme.sql
\ir ../desarmes/0570_desarme.sql
do $c12$
begin
  if pg_catalog.to_regclass('public.ia_cuentas') is not null or pg_catalog.to_regclass('public.ia_catalogo_modelos') is not null
     or pg_catalog.to_regprocedure('public.ia_costo_oficina()') is not null
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'task_events' and column_name in ('tokens_entrada', 'tokens_salida')) then
    raise exception 'CONTRATO 12: el desarme dejó objetos de la 0570';
  end if;
  if (select status from public.audit_entity_types where entity_type = 'ia_config') <> 'deprecated' then
    raise exception 'CONTRATO 12: ia_config no quedó deprecated';
  end if;
  if (select count(*) from public.task_events) <> 4 then
    raise exception 'CONTRATO 12: el desarme tocó la bitácora';
  end if;
end $c12$;

\echo 'contrato 0570 en verde'
rollback;
