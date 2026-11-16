\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0550 (SDD-0637 fase 2): el registro de Faro.
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   A. Aplicar la 0550 otra vez no falla, y agrega 'asistente_alerta' al enum.
--   B. Privilegios: anon y authenticated no alcanzan ninguna tabla; service_role solo lee e inserta
--      (las cuotas, las lecturas y las purgas, solo lee); nadie tiene UPDATE, DELETE ni TRUNCATE.
--   C. Solo inserción: ni service_role ni el dueño editan ni borran a mano; tampoco TRUNCATE.
--   D. Tope por hora: suma solo si queda cupo, por persona y por hora.
--   E. Gasto del mes: suma el costo del mes en curso; lo desconocido (null) no cuenta como cero inventado.
--   F. Purga por plazo: borra filas completas con los plazos de D-6 y deja constancia exacta.
--   G. Purga a pedido: solo la pide un admin activo del tenant, con un motivo de la lista cerrada; borra en ese
--      tenant las conversaciones de la persona, sus eventos no-alerta y sus cuotas; las alertas y el otro tenant
--      quedan; la constancia no guarda actor ni texto.
--   H. Lectura: solo el administrador del tenant lista y abre; abrir queda registrado; la lista no trae texto;
--      un admin con dos membresías activas no lee (get_user_tenant_id da null).
--   I. Funciones: search_path vacío y EXECUTE solo para quien corresponde.

begin;

do $roles$
begin
  if to_regclass('public.tenants') is not null or to_regclass('public.asistente_mensajes') is not null then
    raise exception 'TEST 0550 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Lo mínimo de la tenencia, con las definiciones vigentes en producción: get_user_tenant_id() de la 0453
-- (una sola membresía activa; con dos, null) e is_tenant_admin() de la 0386.
create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
create function public.is_tenant_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(exists (
    select 1 from public.user_tenants ut
     where ut.user_id = (select auth.uid())
       and ut.tenant_id = (select public.get_user_tenant_id())
       and ut.role = 'admin' and ut.disabled_at is null), false);
$$;
grant execute on function public.get_user_tenant_id(), public.is_tenant_admin() to authenticated;
create type public.bug_notif_type as enum ('new_reply', 'state_change', 'resolved', 'critical_alert', 'duplicate_detected');

-- Como en Supabase: los roles de la API reciben EXECUTE y privilegios por defecto sobre lo nuevo. La 0550 tiene
-- que revocarlos ella misma; sin esto, un revoke olvidado pasaría el contrato.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;

\ir ../migrations/0550_faro_registro.sql
-- Otra vez encima: no falla.
\ir ../migrations/0550_faro_registro.sql

-- Datos ficticios: dos tenants; en T1 un admin (A1), una contadora (U1) y otra persona (U2); en T2, su admin (A2).
-- En los dos: una persona (P3) y un admin con dos membresías (A3).
insert into public.tenants values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'accounting'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'commercial'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'commercial'),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'commercial'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'admin');

-- ─── A ───────────────────────────────────────────────────────
do $a$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'bug_notif_type' and e.enumlabel = 'asistente_alerta') then
    raise exception 'TEST 0550: A: falta asistente_alerta en bug_notif_type';
  end if;
end;
$a$;

-- ─── B ───────────────────────────────────────────────────────
do $b$
declare
  t text; r text; p text;
begin
  foreach t in array array['asistente_conversaciones', 'asistente_mensajes', 'asistente_eventos', 'asistente_lecturas',
                           'asistente_llamadas', 'asistente_cuotas', 'asistente_purgas'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'TEST 0550: B: % sin RLS', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'TEST 0550: B: % tiene policies; debe no tener ninguna', t;
    end if;
    foreach r in array array['anon', 'authenticated'] loop
      foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if has_table_privilege(r, 'public.' || t, p) then
          raise exception 'TEST 0550: B: % tiene % sobre %', r, p, t;
        end if;
      end loop;
    end loop;
    foreach p in array array['UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege('service_role', 'public.' || t, p) then
        raise exception 'TEST 0550: B: service_role tiene % sobre %', p, t;
      end if;
    end loop;
    if not has_table_privilege('service_role', 'public.' || t, 'SELECT') then
      raise exception 'TEST 0550: B: service_role no lee %', t;
    end if;
  end loop;
  foreach t in array array['asistente_conversaciones', 'asistente_mensajes', 'asistente_eventos', 'asistente_llamadas'] loop
    if not has_table_privilege('service_role', 'public.' || t, 'INSERT') then
      raise exception 'TEST 0550: B: service_role no inserta en %', t;
    end if;
  end loop;
  foreach t in array array['asistente_cuotas', 'asistente_lecturas', 'asistente_purgas'] loop
    if has_table_privilege('service_role', 'public.' || t, 'INSERT') then
      raise exception 'TEST 0550: B: service_role inserta directo en %; solo sus funciones', t;
    end if;
  end loop;
end;
$b$;

-- ─── C ───────────────────────────────────────────────────────
set local role service_role;
insert into public.asistente_conversaciones (id, tenant_id, usuario_id)
values ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 'usuario', '¿Cómo registro un cobro?');
insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto, resultado) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 2, 'asistente', 'Abre Cobranzas…', 'respondida');

do $c1$
begin
  begin
    update public.asistente_mensajes set texto = 'otro' where orden = 1;
    raise exception 'TEST 0550: C: service_role editó un mensaje';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.asistente_mensajes;
    raise exception 'TEST 0550: C: service_role borró mensajes';
  exception when insufficient_privilege then null;
  end;
  -- La bandera de la purga no le da a service_role lo que el privilegio le niega.
  perform pg_catalog.set_config('asistente.purga', 'on', true);
  begin
    delete from public.asistente_mensajes;
    raise exception 'TEST 0550: C: service_role borró mensajes con la bandera de purga encendida';
  exception when insufficient_privilege then null;
  end;
  perform pg_catalog.set_config('asistente.purga', 'off', true);
  begin
    insert into public.asistente_cuotas (tenant_id, usuario_id, inicio_ventana, consumido)
    values ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(), 0);
    raise exception 'TEST 0550: C: service_role escribió una cuota directo';
  exception when insufficient_privilege then null;
  end;
  -- Un mismo turno (solicitud) no se guarda dos veces.
  begin
    insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto) values
      ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 3, 'usuario', 'repetida');
    raise exception 'TEST 0550: C: se guardó dos veces la misma solicitud';
  exception when unique_violation then null;
  end;
  -- Un mensaje no se cuelga de una conversación de otro tenant.
  begin
    insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto) values
      ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 5, 'usuario', 'cruzado');
    raise exception 'TEST 0550: C: un mensaje de T2 se colgó de una conversación de T1';
  exception when foreign_key_violation then null;
  end;
  -- La pregunta no lleva resultado; la alerta lleva su regla.
  begin
    insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto, resultado) values
      ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', 4, 'usuario', 'x', 'respondida');
    raise exception 'TEST 0550: C: una pregunta quedó con resultado';
  exception when check_violation then null;
  end;
  begin
    insert into public.asistente_eventos (tenant_id, tipo, codigo) values ('10000000-0000-0000-0000-000000000001', 'alerta', 'reservada');
    raise exception 'TEST 0550: C: una alerta se guardó sin su regla';
  exception when check_violation then null;
  end;
end;
$c1$;
reset role;

-- El dueño tampoco edita ni borra a mano: lo detiene el trigger.
do $c2$
begin
  begin
    update public.asistente_conversaciones set usuario_id = 'b0000000-0000-0000-0000-000000000002';
    raise exception 'TEST 0550: C: el dueño editó una conversación';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.asistente_conversaciones;
    raise exception 'TEST 0550: C: el dueño borró conversaciones sin la purga';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.asistente_llamadas;
    raise exception 'TEST 0550: C: el dueño vació llamadas con TRUNCATE';
  exception when insufficient_privilege then null;
  end;
  -- Ni siquiera dentro de una purga se edita: la bandera abre el borrado, nunca el UPDATE.
  perform pg_catalog.set_config('asistente.purga', 'on', true);
  begin
    update public.asistente_conversaciones set usuario_id = 'b0000000-0000-0000-0000-000000000002';
    raise exception 'TEST 0550: C: el dueño editó una conversación con la bandera de purga encendida';
  exception when insufficient_privilege then null;
  end;
  perform pg_catalog.set_config('asistente.purga', 'off', true);
end;
$c2$;

-- ─── D ───────────────────────────────────────────────────────
set local role service_role;
do $d$
declare
  r boolean[] := array[]::boolean[];
begin
  r := r || public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 2);
  r := r || public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 2);
  r := r || public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 2);
  r := r || public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 2);
  if r is distinct from array[true, true, false, true] then
    raise exception 'TEST 0550: D: el tope por hora dio % (esperado {t,t,f,t})', r;
  end if;
  if (select consumido from public.asistente_cuotas
       where usuario_id = 'b0000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'TEST 0550: D: la reserva rechazada sumó igual';
  end if;
  begin
    perform public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 0);
    raise exception 'TEST 0550: D: aceptó un tope de 0';
  exception when invalid_parameter_value then null;
  end;
end;
$d$;
reset role;

-- ─── E ───────────────────────────────────────────────────────
set local role service_role;
insert into public.asistente_llamadas (tenant_id, solicitud_id, intento, iniciada_at, motor, proveedor, modelo, estado, costo_usd) values
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, now(), 'principal', 'anthropic', 'modelo-x', 'error', 0.5),
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 2, now(), 'respaldo', 'otro', 'modelo-y', 'ok', 1.0),
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 3, now(), 'principal', 'anthropic', 'modelo-x', 'tiempo', null),
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 1, date_trunc('month', now()) - interval '1 day', 'principal', 'anthropic', 'modelo-x', 'ok', 9.0),
  ('10000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 1, now(), 'principal', 'anthropic', 'modelo-x', 'ok', 7.0);
do $e$
begin
  if public.asistente_gasto_del_mes('10000000-0000-0000-0000-000000000001') <> 1.5 then
    raise exception 'TEST 0550: E: el gasto del mes de T1 dio % (esperado 1.5)',
      public.asistente_gasto_del_mes('10000000-0000-0000-0000-000000000001');
  end if;
end;
$e$;
reset role;

-- ─── F ───────────────────────────────────────────────────────
-- Una conversación vieja (181 días) con dos mensajes, eventos de distintas edades, llamadas y cuotas viejas.
insert into public.asistente_conversaciones (id, tenant_id, usuario_id, creada_at)
values ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', now() - interval '181 days');
insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto, creado_at) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000010', 1, 'usuario', 'vieja', now() - interval '181 days'),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000010', 2, 'asistente', 'vieja', now() - interval '181 days');
insert into public.asistente_eventos (tenant_id, conversacion_id, tipo, codigo, version_regla, creado_at) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'feedback', 'no_util', null, now() - interval '181 days'),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'feedback', 'util', null, now()),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'alerta', 'reservada', 'r1', now() - interval '181 days'),
  ('10000000-0000-0000-0000-000000000001', null, 'alerta', 'insistencia', 'r1', now() - interval '25 months');
insert into public.asistente_lecturas (tenant_id, lector_id, conversacion_id, leida_at) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', now() - interval '25 months'),
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', now() - interval '23 months');
insert into public.asistente_llamadas (tenant_id, solicitud_id, intento, iniciada_at, motor, proveedor, modelo, estado) values
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000011', 1, now() - interval '14 months', 'principal', 'anthropic', 'modelo-x', 'ok'),
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000012', 1, now() - interval '12 months', 'principal', 'anthropic', 'modelo-x', 'ok');
insert into public.asistente_cuotas (tenant_id, usuario_id, inicio_ventana, consumido) values
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', now() - interval '8 days', 5);

set local role service_role;
do $f$
declare
  v jsonb := public.asistente_purgar_vencidos();
begin
  if v is distinct from '{"conversaciones": 1, "mensajes": 2, "eventos": 1, "alertas": 1, "lecturas": 1, "llamadas": 1, "cuotas": 1}'::jsonb then
    raise exception 'TEST 0550: F: la purga cuenta exactamente lo vencido; dio %', v;
  end if;
  if exists (select 1 from public.asistente_conversaciones where id = 'c0000000-0000-0000-0000-000000000002')
     or exists (select 1 from public.asistente_mensajes where conversacion_id = 'c0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 0550: F: quedó la conversación vieja o sus mensajes';
  end if;
  if not exists (select 1 from public.asistente_conversaciones where id = 'c0000000-0000-0000-0000-000000000001')
     or (select count(*) from public.asistente_mensajes where conversacion_id = 'c0000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'TEST 0550: F: la purga tocó la conversación vigente';
  end if;
  if not exists (select 1 from public.asistente_eventos where tipo = 'alerta' and codigo = 'reservada') then
    raise exception 'TEST 0550: F: la alerta de 181 días se borró con su conversación; dura 2 años';
  end if;
  if (select count(*) from public.asistente_purgas where motivo = 'plazo') <> 1 then
    raise exception 'TEST 0550: F: la purga no dejó su constancia';
  end if;
  -- Después de la purga, la bandera no queda puesta: borrar a mano sigue prohibido.
  begin
    perform 1;
    if coalesce(current_setting('asistente.purga', true), '') = 'on' then
      raise exception 'TEST 0550: F: la bandera de purga quedó encendida';
    end if;
  end;
end;
$f$;
reset role;
do $f2$
begin
  begin
    delete from public.asistente_conversaciones;
    raise exception 'TEST 0550: F: tras la purga se pudo borrar a mano';
  exception when insufficient_privilege then null;
  end;
end;
$f2$;

-- ─── G ───────────────────────────────────────────────────────
insert into public.asistente_conversaciones (id, tenant_id, usuario_id) values
  ('c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');
insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000020', 1, 'usuario', 'de U2');
insert into public.asistente_eventos (tenant_id, conversacion_id, usuario_id, tipo, codigo, version_regla) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null, 'feedback', 'no_util', null),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null, 'alerta', 'insistencia', 'r1'),
  -- A su nombre y sin conversación: también se borra; la alerta, no.
  ('10000000-0000-0000-0000-000000000001', null, 'b0000000-0000-0000-0000-000000000002', 'fallo', 'motor_caido', null),
  ('10000000-0000-0000-0000-000000000001', null, 'b0000000-0000-0000-0000-000000000002', 'alerta', 'reservada', 'r1');

set local role service_role;
do $g$
declare
  v jsonb;
begin
  begin
    perform public.asistente_purgar_usuario('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
                                            'a0000000-0000-0000-0000-000000000001', 'Lo pidió la persona');
    raise exception 'TEST 0550: G: aceptó un motivo fuera de la lista cerrada';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.asistente_purgar_usuario('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
                                            'b0000000-0000-0000-0000-000000000001', 'pedido_titular');
    raise exception 'TEST 0550: G: un actor que no es admin pidió una purga';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.asistente_purgar_usuario('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
                                            'a0000000-0000-0000-0000-000000000002', 'pedido_titular');
    raise exception 'TEST 0550: G: el admin de T2 pidió una purga en T1';
  exception when insufficient_privilege then null;
  end;
  v := public.asistente_purgar_usuario('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
                                       'a0000000-0000-0000-0000-000000000001', 'pedido_titular');
  if v is distinct from '{"conversaciones": 1, "mensajes": 1, "eventos": 2, "cuotas": 1}'::jsonb then
    raise exception 'TEST 0550: G: la purga a pedido dio %', v;
  end if;
  if exists (select 1 from public.asistente_cuotas where usuario_id = 'b0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 0550: G: quedaron cuotas de la persona';
  end if;
  if not exists (select 1 from public.asistente_eventos
                  where usuario_id = 'b0000000-0000-0000-0000-000000000002' and tipo = 'alerta') then
    raise exception 'TEST 0550: G: la alerta a su nombre se borró con la purga a pedido';
  end if;
  if exists (select 1 from public.asistente_conversaciones where usuario_id = 'b0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 0550: G: quedaron conversaciones de la persona';
  end if;
  if not exists (select 1 from public.asistente_conversaciones where usuario_id = 'b0000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 0550: G: la purga a pedido borró a otra persona';
  end if;
  if not exists (select 1 from public.asistente_eventos where conversacion_id = 'c0000000-0000-0000-0000-000000000003' and tipo = 'alerta') then
    raise exception 'TEST 0550: G: la alerta se borró con la purga a pedido; dura su plazo';
  end if;
  if not exists (select 1 from public.asistente_purgas where motivo = 'pedido' and motivo_codigo = 'pedido_titular'
                    and tenant_id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 0550: G: la purga a pedido no dejó su constancia con su motivo';
  end if;
  -- La constancia no guarda quién, ni texto (privacidad.md §2).
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'asistente_purgas'
                and column_name not in ('id', 'ejecutada_at', 'motivo', 'motivo_codigo', 'tenant_id', 'conteos')) then
    raise exception 'TEST 0550: G: asistente_purgas tiene columnas de más (actor o texto)';
  end if;
end;
$g$;
reset role;

-- Una persona en dos tenants: la purga a pedido en T1 no toca lo suyo en T2.
insert into public.asistente_conversaciones (id, tenant_id, usuario_id) values
  ('c0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003');
insert into public.asistente_mensajes (tenant_id, conversacion_id, solicitud_id, orden, tipo, texto) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000030', 1, 'usuario', 'de P3 en T1'),
  ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000031', 1, 'usuario', 'de P3 en T2');
insert into public.asistente_eventos (tenant_id, conversacion_id, usuario_id, tipo, codigo) values
  ('10000000-0000-0000-0000-000000000001', null, 'b0000000-0000-0000-0000-000000000003', 'feedback', 'util'),
  ('10000000-0000-0000-0000-000000000002', null, 'b0000000-0000-0000-0000-000000000003', 'feedback', 'util');

set local role service_role;
do $g2$
declare
  v jsonb;
begin
  perform public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 30);
  perform public.asistente_reservar_pregunta('10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 30);
  v := public.asistente_purgar_usuario('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003',
                                       'a0000000-0000-0000-0000-000000000001', 'baja_personal');
  if v is distinct from '{"conversaciones": 1, "mensajes": 1, "eventos": 1, "cuotas": 1}'::jsonb then
    raise exception 'TEST 0550: G: la purga a pedido de una persona en dos tenants dio %', v;
  end if;
  if not exists (select 1 from public.asistente_conversaciones where id = 'c0000000-0000-0000-0000-000000000006')
     or not exists (select 1 from public.asistente_eventos
                     where tenant_id = '10000000-0000-0000-0000-000000000002' and usuario_id = 'b0000000-0000-0000-0000-000000000003')
     or not exists (select 1 from public.asistente_cuotas
                     where tenant_id = '10000000-0000-0000-0000-000000000002' and usuario_id = 'b0000000-0000-0000-0000-000000000003') then
    raise exception 'TEST 0550: G: la purga a pedido en T1 borró lo de la persona en T2';
  end if;
end;
$g2$;
reset role;

-- ─── H ───────────────────────────────────────────────────────
-- Una conversación en T2, que el admin de T1 no debe ver.
insert into public.asistente_conversaciones (id, tenant_id, usuario_id) values
  ('c0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002');

set local role authenticated;
set local test.uid = 'a0000000-0000-0000-0000-000000000001';
do $h1$
declare
  n integer;
begin
  select count(*) into n from public.asistente_listar_conversaciones();
  if n <> 1 then
    raise exception 'TEST 0550: H: el admin de T1 ve % conversaciones (esperado 1, solo la de su tenant)', n;
  end if;
  select count(*) into n from public.asistente_leer_conversacion('c0000000-0000-0000-0000-000000000001');
  if n <> 2 then
    raise exception 'TEST 0550: H: abrir la conversación trajo % mensajes (esperado 2)', n;
  end if;
  begin
    perform * from public.asistente_leer_conversacion('c0000000-0000-0000-0000-000000000004');
    raise exception 'TEST 0550: H: el admin de T1 abrió una conversación de T2';
  exception when no_data_found then null;
  end;
  begin
    perform 1 from public.asistente_mensajes;
    raise exception 'TEST 0550: H: authenticated leyó mensajes directo';
  exception when insufficient_privilege then null;
  end;
end;
$h1$;
set local test.uid = 'b0000000-0000-0000-0000-000000000001';
do $h2$
begin
  begin
    perform * from public.asistente_listar_conversaciones();
    raise exception 'TEST 0550: H: una contadora listó conversaciones';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.asistente_leer_conversacion('c0000000-0000-0000-0000-000000000001');
    raise exception 'TEST 0550: H: una contadora abrió una conversación';
  exception when insufficient_privilege then null;
  end;
end;
$h2$;
-- Un admin con dos membresías activas no tiene tenant único: no lista ni abre.
set local test.uid = 'a0000000-0000-0000-0000-000000000003';
do $h2b$
begin
  begin
    perform * from public.asistente_listar_conversaciones();
    raise exception 'TEST 0550: H: un admin con dos membresías listó conversaciones';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.asistente_leer_conversacion('c0000000-0000-0000-0000-000000000001');
    raise exception 'TEST 0550: H: un admin con dos membresías abrió una conversación';
  exception when insufficient_privilege then null;
  end;
end;
$h2b$;
reset role;

do $h3$
begin
  if (select count(*) from public.asistente_lecturas
       where lector_id = 'a0000000-0000-0000-0000-000000000001'
         and conversacion_id = 'c0000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'TEST 0550: H: abrir la conversación no quedó registrado una vez';
  end if;
  if exists (select 1 from information_schema.routines r
               join information_schema.parameters p on p.specific_name = r.specific_name
              where r.routine_name = 'asistente_listar_conversaciones' and p.parameter_mode = 'OUT'
                and p.parameter_name = 'texto') then
    raise exception 'TEST 0550: H: la lista de conversaciones trae el texto';
  end if;
end;
$h3$;

-- ─── I ───────────────────────────────────────────────────────
do $i$
declare
  f text;
begin
  foreach f in array array[
    'public.asistente_reservar_pregunta(uuid,uuid,integer)', 'public.asistente_gasto_del_mes(uuid)',
    'public.asistente_purgar_vencidos()', 'public.asistente_purgar_usuario(uuid,uuid,uuid,text)',
    'public.asistente_listar_conversaciones(integer,timestamptz)', 'public.asistente_leer_conversacion(uuid)',
    'public.asistente_solo_insercion()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'TEST 0550: I: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'TEST 0550: I: anon ejecuta %', f;
    end if;
  end loop;
  foreach f in array array[
    'public.asistente_reservar_pregunta(uuid,uuid,integer)', 'public.asistente_gasto_del_mes(uuid)',
    'public.asistente_purgar_vencidos()', 'public.asistente_purgar_usuario(uuid,uuid,uuid,text)'] loop
    if has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'TEST 0550: I: authenticated ejecuta %', f;
    end if;
    if not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'TEST 0550: I: service_role no ejecuta %', f;
    end if;
  end loop;
  foreach f in array array['public.asistente_listar_conversaciones(integer,timestamptz)', 'public.asistente_leer_conversacion(uuid)'] loop
    if has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'TEST 0550: I: service_role ejecuta %; la lectura es del admin con su sesión', f;
    end if;
  end loop;
end;
$i$;

select 'TEST 0550 OK: registro de Faro (solo inserción, tope, gasto, purgas, lectura del admin)' as resultado;

rollback;
