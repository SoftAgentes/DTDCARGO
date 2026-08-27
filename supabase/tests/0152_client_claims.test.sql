\set ON_ERROR_STOP on

-- Contrato de los reclamos del cliente (SDD-0101 · migr 0152 + 0153).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ⚠️ SE CARGAN DOS MIGRACIONES: la 0153 es aditiva sobre la 0152 (agrega la
-- columna `source`, la policy de lectura del portal y la gemela de servicio del
-- correlativo). Probar sólo la 0152 dejaría fuera toda la superficie del portal,
-- que es la que un cliente puede tocar desde afuera.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Un reclamo es un cliente diciendo que su carga llegó dañada, incompleta o
-- tarde, y un monto en dólares al lado. Es el registro que decide si se paga un
-- siniestro. Dos cosas lo pueden arruinar sin dar error: que se ate al cliente
-- o al embarque equivocado, y que las fechas de los hitos no sean las reales.
--
-- ── 🔴 LO QUE ESTE CONTRATO **NO** PUEDE PROBAR ──────────────────────────
--
-- La 0153 dice explícito que el INSERT del cliente **no va por RLS a
-- propósito**: la action del portal usa el admin client y controla los campos
-- sensibles (`amount_usd = 0`, `insured = false`, `status = 'reportado'`,
-- `source = 'portal'`) para que el cliente no pueda forjar un monto ni marcar su
-- propio reclamo como asegurado.
--
-- **Ese control vive en la aplicación, no en la base.** Ningún contrato SQL lo
-- alcanza. Lo que sí se fija acá es el resto — y que el cliente del portal
-- **sólo pueda leer**, que es la mitad que la base sí sostiene.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Ni el cliente ni el embarque pueden ser de OTRO tenant. Dos guards
--      separados en el mismo trigger: se prueban los dos.
--   2. 🔴 `evaluated_at` se sella al entrar a evaluación, y **no se re-sella**.
--      Si se pisara, se perdería cuándo empezó a mirarse el reclamo — que es lo
--      que se mira cuando alguien pregunta por qué tardó.
--   3. 🔴 `resolved_at` se sella en los TRES terminales (`pagado`, `resuelto`,
--      `rechazado`) y **no** en `aprobado`: aprobar no es cerrar.
--   4. 🔴 El cliente del portal **lee lo suyo y nada más**, y **no puede
--      escribir**. Es la única defensa que vive en la base contra un cliente
--      que se forje un reclamo.
--   5. 🔴 `next_claim_code_service` —la gemela SIN `assert_tenant_match`— sólo
--      la ejecuta `service_role`. Es la puerta de servicio del portal: si un
--      `authenticated` pudiera llamarla, leería el correlativo de cualquier
--      tenant. Su hermana `next_claim_code` sí exige tenant propio.
--   6. El vocabulario está acotado: tipo, estado y origen.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  markbox    text,
  name       text,
  deleted_at timestamptz
);

create table public.shipments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  code       text,
  deleted_at timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

-- El markbox del cliente del portal sale de un GUC en este banco: es lo que en
-- producción resuelve la sesión del portal.
create or replace function public.get_portal_client_markbox()
returns text language sql stable security definer set search_path = public as $g$
  select nullif(current_setting('test.markbox', true), '');
$g$;

create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $a$
declare v_caller uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  if v_caller is null then
    raise exception 'Authenticated tenant required' using errcode = '42501';
  end if;
  if p_tenant_id <> v_caller then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$a$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $t$
begin new.updated_at := now(); return new; end;
$t$;

-- ⚠️ Los clientes del seed van ANTES de cargar la migración, a propósito: la
-- 0152 trae una seed demo de 3 reclamos que se cuelga de DTD-1001..1003 del
-- tenant `dtd`. Creándolos primero, la seed corre de verdad y el contrato 3
-- puede afirmar sobre filas que pasaron por el trigger, no sobre inventadas.
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

insert into public.clients (tenant_id, markbox, name) values
  (:'t1', 'DTD-1001', 'Cliente Uno'),
  (:'t1', 'DTD-1002', 'Cliente Dos'),
  (:'t1', 'DTD-1003', 'Cliente Tres');

\ir ../migrations/0152_client_claims.sql
\ir ../migrations/0153_client_claims_portal.sql

-- ── Fixtures propios ──────────────────────────────────────────────────────
\set c1 'ca111111-1111-1111-1111-111111111111'
\set c2 'cb222222-2222-2222-2222-222222222222'
insert into public.clients (id, tenant_id, markbox, name) values
  (:'c1', :'t1', 'DTD-5000', 'El que reclama'),
  (:'c2', :'t2', 'DTD-9000', 'De otro tenant');

\set e1 'ea111111-1111-1111-1111-111111111111'
\set e2 'eb222222-2222-2222-2222-222222222222'
insert into public.shipments (id, tenant_id, code) values
  (:'e1', :'t1', 'S-2026-0001'),
  (:'e2', :'t2', 'S-2026-0002');

create or replace function pg_temp.n_reclamos(p_tenant uuid) returns int
language sql as $n$
  select count(*)::int from public.client_claims where tenant_id = p_tenant
$n$;

-- ── 1 · 🔴 Cliente y embarque: los dos guards, por separado ───────────────
do $$
declare v_antes int;
begin
  v_antes := pg_temp.n_reclamos('11111111-1111-1111-1111-111111111111');

  -- (a) cliente de otro tenant
  begin
    insert into public.client_claims
      (tenant_id, claim_code, client_id, claim_type, description)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-901',
            'cb222222-2222-2222-2222-222222222222', 'dano', 'colado por cliente');
  exception when others then null;
  end;

  -- (b) embarque de otro tenant
  begin
    insert into public.client_claims
      (tenant_id, claim_code, shipment_id, claim_type, description)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-902',
            'eb222222-2222-2222-2222-222222222222', 'dano', 'colado por embarque');
  exception when others then null;
  end;

  if pg_temp.n_reclamos('11111111-1111-1111-1111-111111111111') <> v_antes then
    raise exception
      'CONTRATO 1 ROTO: entro un reclamo atado al cliente o embarque de OTRO tenant';
  end if;
end;
$$;

-- El reclamo legítimo sí entra (si no, un guard que rechace todo pasaría el 1).
\set r1 'fa111111-1111-1111-1111-111111111111'
do $$
begin
  insert into public.client_claims
    (id, tenant_id, claim_code, client_id, client_markbox, client_name,
     shipment_id, claim_type, description, amount_usd, insured)
  values ('fa111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'RC-2026-010',
          'ca111111-1111-1111-1111-111111111111', 'DTD-5000', 'El que reclama',
          'ea111111-1111-1111-1111-111111111111', 'dano',
          'Dos cajas mojadas', 420.00, true);

  if (select status from public.client_claims where id = 'fa111111-1111-1111-1111-111111111111')
     <> 'reportado' then
    raise exception 'CONTRATO 1 ROTO: el reclamo no nace en «reportado»';
  end if;
  if (select evaluated_at from public.client_claims where id = 'fa111111-1111-1111-1111-111111111111')
     is not null then
    raise exception 'CONTRATO 1 ROTO: un reclamo recien reportado ya trae evaluated_at';
  end if;
end;
$$;

-- ── 2 · 🔴 `evaluated_at` se sella una vez y NO se re-sella ───────────────
--
-- ⚠️ Se ANTEDATA la marca antes del segundo guardado. `now()` en Postgres es la
-- hora de la TRANSACCIÓN, no del reloj: sin antedatar, un re-sellado escribiría
-- el mismo valor y el contrato pasaría en verde con el `is null` arrancado.
do $$
declare v_sello timestamptz;
begin
  update public.client_claims set status = 'evaluacion'
   where id = 'fa111111-1111-1111-1111-111111111111';

  select evaluated_at into v_sello from public.client_claims
   where id = 'fa111111-1111-1111-1111-111111111111';
  if v_sello is null then
    raise exception 'CONTRATO 2 ROTO: entrar a evaluacion no sello evaluated_at';
  end if;

  -- 🔴 El antedatado va con el trigger APAGADO, y no es un atajo: ese UPDATE
  -- también pasa por el trigger, así que la propia mutación que se quiere
  -- detectar («se re-sella siempre») lo desharía al vuelo y el contrato saldría
  -- verde. Para probar un guard hay que poder montar el escenario SIN él.
  alter table public.client_claims disable trigger client_claims_check_trg;
  update public.client_claims set evaluated_at = now() - interval '5 days'
   where id = 'fa111111-1111-1111-1111-111111111111';
  alter table public.client_claims enable trigger client_claims_check_trg;

  select evaluated_at into v_sello from public.client_claims
   where id = 'fa111111-1111-1111-1111-111111111111';

  -- Otro guardado en el mismo estado no puede pisar la fecha real.
  update public.client_claims set description = 'Dos cajas mojadas (corregido)'
   where id = 'fa111111-1111-1111-1111-111111111111';

  if (select evaluated_at from public.client_claims where id = 'fa111111-1111-1111-1111-111111111111')
     <> v_sello then
    raise exception
      'CONTRATO 2 ROTO: se re-sello evaluated_at — se pierde cuando empezo a mirarse el reclamo';
  end if;
end;
$$;

-- ── 3 · 🔴 `resolved_at`: los tres terminales sí, `aprobado` no ───────────
--
-- Aprobar no es cerrar. Y las tres filas de la seed demo de la 0152 sirven de
-- comprobación extra: pasaron por el trigger de verdad al aplicarse la
-- migración, no las inventó este archivo.
do $$
declare v_estado text; v_resuelto timestamptz; v_eval timestamptz;
begin
  -- `aprobado` NO cierra.
  update public.client_claims set status = 'aprobado'
   where id = 'fa111111-1111-1111-1111-111111111111';
  if (select resolved_at from public.client_claims where id = 'fa111111-1111-1111-1111-111111111111')
     is not null then
    raise exception 'CONTRATO 3 ROTO: «aprobado» sello resolved_at — aprobar no es cerrar';
  end if;

  -- Los tres terminales sí, cada uno en su propia fila.
  foreach v_estado in array array['pagado', 'resuelto', 'rechazado']
  loop
    declare v_id uuid;
    begin
      insert into public.client_claims (tenant_id, claim_code, claim_type, description)
      values ('11111111-1111-1111-1111-111111111111', 'RC-2026-1' || v_estado,
              'otro', 'terminal ' || v_estado)
      returning id into v_id;

      update public.client_claims set status = v_estado where id = v_id;

      if (select resolved_at from public.client_claims where id = v_id) is null then
        raise exception 'CONTRATO 3 ROTO: el estado terminal «%» no sello resolved_at', v_estado;
      end if;
    end;
  end loop;

  -- Y la seed: RC-2026-001 quedó en evaluación → con evaluated_at, sin cerrar.
  select evaluated_at, resolved_at into v_eval, v_resuelto
    from public.client_claims where claim_code = 'RC-2026-001';
  if v_eval is null then
    raise exception 'CONTRATO 3 ROTO: la seed en evaluacion no quedo sellada (el trigger no corrio)';
  end if;
  if v_resuelto is not null then
    raise exception 'CONTRATO 3 ROTO: la seed en evaluacion quedo marcada como resuelta';
  end if;

  -- RC-2026-003 quedó resuelto → cerrado.
  if (select resolved_at from public.client_claims where claim_code = 'RC-2026-003') is null then
    raise exception 'CONTRATO 3 ROTO: la seed resuelta no sello resolved_at';
  end if;
end;
$$;

-- ── 4 · 🔴 El cliente del portal lee lo suyo y NO escribe ────────────────
--
-- Es la única defensa que vive en la BASE contra un cliente que se forje un
-- reclamo (el control de los montos vive en la action, fuera del alcance de
-- este archivo — ver la cabecera).
do $$
declare v_ve int;
begin
  -- Otro reclamo, de otro cliente del mismo tenant, para que «ve lo suyo» tenga
  -- algo de qué distinguirse.
  insert into public.client_claims
    (tenant_id, claim_code, client_markbox, claim_type, description)
  values ('11111111-1111-1111-1111-111111111111', 'RC-2026-020',
          'DTD-7777', 'faltante', 'De otro cliente del mismo tenant');

  perform set_config('test.markbox', 'DTD-5000', true);
  set local role authenticated;

  select count(*) into v_ve from public.client_claims;
  if v_ve <> 1 then
    raise exception
      'CONTRATO 4 ROTO: el cliente del portal ve % reclamos — deberia ver solo el suyo', v_ve;
  end if;
  if not exists (select 1 from public.client_claims where claim_code = 'RC-2026-010') then
    raise exception 'CONTRATO 4 ROTO: el cliente del portal NO ve su propio reclamo';
  end if;

  -- Y no puede forjar uno.
  begin
    insert into public.client_claims
      (tenant_id, claim_code, client_markbox, claim_type, description, amount_usd, insured)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-FORJADO',
            'DTD-5000', 'dano', 'me debe 50 mil', 50000.00, true);
    raise exception 'CONTRATO 4 ROTO: el cliente del portal creo un reclamo con monto propio';
  exception
    when insufficient_privilege then null;  -- esperado: la policy del portal es SELECT
  end;

  -- Ni cambiar el suyo.
  update public.client_claims set amount_usd = 99999 where claim_code = 'RC-2026-010';
  reset role;
  if (select amount_usd from public.client_claims where claim_code = 'RC-2026-010') <> 420.00 then
    raise exception 'CONTRATO 4 ROTO: el cliente del portal se cambio el monto de su reclamo';
  end if;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 5 · 🔴 La puerta de servicio es SÓLO para service_role ───────────────
--
-- `next_claim_code_service` es la gemela SIN `assert_tenant_match`: existe
-- porque el cliente del portal no está en `user_tenants` y su hermana fallaría.
-- Justamente por eso no puede quedar al alcance de nadie más — leería el
-- correlativo de cualquier tenant.
do $$
declare v_mal text;
begin
  select string_agg(quien || ':' || p.proname, ', ')
    into v_mal
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral (values ('anon'), ('authenticated'), ('public')) as r(quien)
   where n.nspname = 'public'
     and p.proname = 'next_claim_code_service'
     and has_function_privilege(r.quien, p.oid, 'EXECUTE');

  if v_mal is not null then
    raise exception 'CONTRATO 5 ROTO: la puerta de servicio esta abierta a %', v_mal;
  end if;

  if not has_function_privilege('service_role',
       'public.next_claim_code_service(uuid)', 'EXECUTE') then
    raise exception 'CONTRATO 5 ROTO: service_role NO puede usar su propia puerta de servicio';
  end if;

  -- Y anon tampoco alcanza a la hermana con guard.
  if has_function_privilege('anon', 'public.next_claim_code(uuid)', 'EXECUTE') then
    raise exception 'CONTRATO 5 ROTO: anon puede pedir el correlativo de reclamos';
  end if;
end;
$$;

-- ── 6 · El vocabulario está acotado ───────────────────────────────────────
do $$
declare v_antes int;
begin
  v_antes := pg_temp.n_reclamos('11111111-1111-1111-1111-111111111111');

  begin
    insert into public.client_claims (tenant_id, claim_code, claim_type, description)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-903', 'se_mojo', 'tipo raro');
  exception when others then null;
  end;
  begin
    insert into public.client_claims (tenant_id, claim_code, claim_type, description, status)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-904', 'dano', 'x', 'mas_o_menos');
  exception when others then null;
  end;
  begin
    insert into public.client_claims (tenant_id, claim_code, claim_type, description, source)
    values ('11111111-1111-1111-1111-111111111111', 'RC-2026-905', 'dano', 'x', 'whatsapp');
  exception when others then null;
  end;

  if pg_temp.n_reclamos('11111111-1111-1111-1111-111111111111') <> v_antes then
    raise exception 'CONTRATO 6 ROTO: entro un reclamo con tipo, estado u origen inventado';
  end if;

  -- Y `source` nace en 'studio' salvo que el portal diga lo contrario.
  if (select source from public.client_claims where claim_code = 'RC-2026-010') <> 'studio' then
    raise exception 'CONTRATO 6 ROTO: el reclamo del equipo no nace con source = studio';
  end if;
end;
$$;

rollback;
