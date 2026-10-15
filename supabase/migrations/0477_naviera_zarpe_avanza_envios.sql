-- ─────────────────────────────────────────────────────────────────────────────
-- 0477 · SDD-0530 — Naviera: al zarpar el contenedor, sus envíos avanzan a
-- «Embarcado»; al arribar, a «En aduana». Contenedor, envíos, eventos del
-- historial y auditoría cambian en UNA transacción.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Producción es el Supabase self-hosted del servidor propio.
--    ORDEN: MIGRATE-FIRST y desplegar la app enseguida. Con 0477 aplicada y la
--    app de antes, «Marcar zarpado» y «Marcar arribado» responden «No se pudo
--    cambiar el estado: naviera: zarpar o arribar el contenedor requiere
--    advance_consolidation_governed» y no cambian nada, hasta que se despliega
--    la app nueva; con la app nueva y sin 0477, los mismos botones dicen «No se
--    pudo cambiar el estado del contenedor. No cambió nada» (PGRST202). Fusionar
--    la PR NO autoriza aplicarla.
--
-- ── El defecto ──────────────────────────────────────────────
-- changeConsolidationStatus (app/studio/(app)/naviera/actions.ts) cambiaba sólo
-- consolidations.status con un UPDATE directo. Naviera nunca tocó
-- shipments.status: cada envío del contenedor había que avanzarlo a mano en
-- Tracking (transitionShipment), y el aviso status:shipped salía sólo si
-- alguien lo hacía. Los envíos se unen al contenedor por consolidation_items
-- (0096).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- · naviera_avance_module_authorized(tenant, módulo): la regla de
--   canEditModule de rbac.ts para 'naviera' y 'tracking' —membresía activa del
--   auth.uid() en el tenant, desvío de 0357 si existe, default de
--   ROLE_MODULE_ACCESS si no; admin siempre, support nunca edita—, el mismo
--   cuerpo que operarios_module_authorized (0475) con dos contratos. ⚠️ Los
--   defaults quedan DUPLICADOS aquí y en rbac.ts, el trade-off de 0357 y 0475;
--   lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts compara
--   la base con moduleEditDenial para cada rol y cada desvío.
-- · naviera_avance_decision(servicio, estado, destino): ¿avanza el envío? La
--   regla de decidirAvance (lib/studio/naviera/avance-por-contenedor.ts):
--   cancelado, entregado y en excepción no se tocan; el servicio tiene que
--   tener el estado destino (STATE_MACHINE de shipment-state-machine.ts); ya en
--   el destino o más adelante (STATUS_FLOW_ORDER de tracking-progress.ts, con
--   draft antes y delayed_warehouse al nivel de arrived_destination) no se toca.
--   La prueba PGlite compara las dos para cada servicio × estado × destino.
-- · advance_consolidation_governed(contenedor, 'zarpado'|'arribado'): bloquea el
--   contenedor, exige la membresía activa en su tenant y la edición de Naviera
--   Y de Tracking, exige cerrado → zarpado o zarpado → arribado, y en la misma
--   transacción: cambia el contenedor, avanza cada envío vivo de sus
--   consolidation_items que la regla deja (bloqueados FOR UPDATE en orden de
--   id), inserta su shipment_events y su evento AUD-01 shipment_status_changed,
--   y el evento consolidation_status_advanced del contenedor con los que
--   avanzaron y los que no, con su motivo. Si el contenedor ya estaba en el
--   destino devuelve outcome 'already' y no toca nada: marcar zarpado dos veces
--   no avanza ni avisa dos veces. Los avisos al cliente los programa la app
--   después, con la misma llamada que Tracking.
-- · guard_consolidation_advance(): un UPDATE que pone el contenedor en zarpado o
--   arribado sin pasar por la RPC falla con 42501. Sin él, el UPDATE directo de
--   antes seguiría cambiando el contenedor sin sus envíos ni su auditoría.
--
-- ── Locks y tiempos ─────────────────────────────────────────
-- Crear funciones y el trigger toma SHARE ROW EXCLUSIVE breve sobre
-- consolidations (CREATE TRIGGER). La RPC, al correr, bloquea la fila del
-- contenedor y las de sus envíos hasta el COMMIT. lock_timeout 5 s y
-- statement_timeout 30 s con set de sesión, que rige también en autocommit.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

-- ── 0. Preflight fail-closed ─────────────────────────────────
do $preflight$
declare
  v_status text[];
  v_service text[];
begin
  if to_regclass('public.consolidations') is null
     or to_regclass('public.consolidation_items') is null
     or to_regclass('public.shipments') is null
     or to_regclass('public.shipment_events') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.studio_role_module_overrides') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regtype('public.shipment_status') is null
     or to_regtype('public.shipment_service') is null
     or to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0477 requiere Naviera, Tracking, la matriz 0357 y el writer AUD-01';
  end if;

  if (
    select pg_catalog.count(*)
    from public.audit_entity_types
    where entity_type in ('shipment', 'consolidation')
      and status = 'active'
  ) <> 2 then
    raise exception '0477 requiere las entidades de auditoría shipment y consolidation activas';
  end if;

  -- Los enums que la regla compara como texto. Si producción tuviera otros
  -- valores (por ejemplo, los nombres de antes de 0256), ningún envío avanzaría
  -- y nada lo diría: mejor abortar.
  select pg_catalog.array_agg(e.enumlabel::text order by e.enumlabel::text)
    into v_status
  from pg_catalog.pg_enum e
  where e.enumtypid = 'public.shipment_status'::regtype;
  if v_status is distinct from array[
    'arrived_destination', 'cancelled', 'consolidating', 'delayed_warehouse',
    'delivered', 'draft', 'exception', 'in_customs', 'in_transit', 'in_warehouse',
    'last_mile', 'out_for_delivery', 'shipped'
  ]::text[] then
    raise exception '0477: shipment_status con valores inesperados: %', v_status;
  end if;

  select pg_catalog.array_agg(e.enumlabel::text order by e.enumlabel::text)
    into v_service
  from pg_catalog.pg_enum e
  where e.enumtypid = 'public.shipment_service'::regtype;
  if v_service is distinct from array[
    'consolidado_lcl', 'fcl_bodega', 'fcl_directo', 'puerta_a_puerta_DDP',
    'transporte_terrestre'
  ]::text[] then
    raise exception '0477: shipment_service con valores inesperados: %', v_service;
  end if;

  -- Columnas que la RPC lee o escribe.
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_attribute a
    where not a.attisdropped and a.attnum > 0
      and (
        (a.attrelid = 'public.consolidations'::regclass
          and a.attname in ('id', 'tenant_id', 'ref', 'status', 'deleted_at'))
        or (a.attrelid = 'public.consolidation_items'::regclass
          and a.attname in ('tenant_id', 'consolidation_id', 'shipment_id'))
        or (a.attrelid = 'public.shipments'::regclass
          and a.attname in ('id', 'tenant_id', 'code', 'client_markbox', 'client_name',
                            'shipment_service', 'status', 'deleted_at'))
        or (a.attrelid = 'public.shipment_events'::regclass
          and a.attname in ('tenant_id', 'shipment_id', 'status', 'note', 'occurred_at',
                            'created_by'))
        or (a.attrelid = 'public.user_tenants'::regclass
          and a.attname in ('user_id', 'tenant_id', 'role', 'disabled_at'))
        or (a.attrelid = 'public.studio_role_module_overrides'::regclass
          and a.attname in ('tenant_id', 'role', 'module_id', 'can_view', 'can_edit'))
      )
  ) <> 31 then
    raise exception '0477: faltan columnas de consolidations, consolidation_items, shipments, shipment_events, user_tenants o studio_role_module_overrides';
  end if;

  if to_regprocedure('public.advance_consolidation_governed(uuid,text)') is not null
     or to_regprocedure('public.naviera_avance_module_authorized(uuid,text)') is not null
     or to_regprocedure('public.naviera_avance_decision(text,text,text)') is not null
     or to_regprocedure('public.guard_consolidation_advance()') is not null then
    raise exception '0477 abortado: el contrato de avance ya existe';
  end if;
end;
$preflight$;

-- ── 1. La matriz de la app, en la base ───────────────────────
-- Mismo cuerpo que operarios_module_authorized (0475), sólo para 'edit' y con
-- los contratos de 'naviera' y 'tracking'. Los defaults son los de
-- ROLE_MODULE_ACCESS en lib/studio/rbac.ts. Un módulo que no está en el
-- contrato da false.
create function public.naviera_avance_module_authorized(
  p_tenant_id uuid,
  p_module_id text
) returns boolean
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
  ), contract(module_id, default_roles) as (
    values
      ('naviera', array['operations', 'accounting']::text[]),
      ('tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[])
  ), decision as (
    select m.role, c.default_roles, o.can_edit
    from membership m
    join contract c on c.module_id = p_module_id
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.role = 'admin' then true
      when d.role = 'support' then false
      else coalesce(d.can_edit, d.role = any(d.default_roles))
    end
    from decision d
  ), false)
$function$;

comment on function public.naviera_avance_module_authorized(uuid, text) is
  'SDD-0530: ¿el auth.uid() puede EDITAR el módulo naviera o tracking en el tenant? Regla de canEditModule (rbac.ts): admin siempre, support nunca, desvío de studio_role_module_overrides (0357) si existe, si no el default de ROLE_MODULE_ACCESS. Defaults duplicados con rbac.ts. Sin EXECUTE para roles de API: la usa advance_consolidation_governed.';

revoke all on function public.naviera_avance_module_authorized(uuid, text)
  from public, anon, authenticated, service_role;

-- ── 2. ¿Avanza el envío? ─────────────────────────────────────
-- La regla de decidirAvance (lib/studio/naviera/avance-por-contenedor.ts). Sólo
-- conoce los dos destinos de la RPC: 'shipped' e 'in_customs'. Los servicios
-- que los tienen son los de STATE_MACHINE: los cuatro marítimos; el terrestre
-- no zarpa ni pasa por aduana.
create function public.naviera_avance_decision(
  p_service text,
  p_status text,
  p_destino text
) returns text
language sql
immutable
set search_path = ''
as $function$
  with posicion(status, pos) as (
    values
      ('draft', 0), ('in_warehouse', 1), ('consolidating', 2), ('shipped', 3),
      ('in_transit', 4), ('in_customs', 5), ('arrived_destination', 6),
      ('delayed_warehouse', 6), ('out_for_delivery', 7), ('last_mile', 8),
      ('delivered', 9)
  ), aplica(service, status) as (
    values
      ('consolidado_lcl', 'shipped'), ('puerta_a_puerta_DDP', 'shipped'),
      ('fcl_directo', 'shipped'), ('fcl_bodega', 'shipped'),
      ('consolidado_lcl', 'in_customs'), ('puerta_a_puerta_DDP', 'in_customs'),
      ('fcl_directo', 'in_customs'), ('fcl_bodega', 'in_customs')
  )
  select case
    when p_status = 'cancelled' then 'cancelado'
    when p_status = 'delivered' then 'entregado'
    when p_status = 'exception' then 'excepcion'
    when not exists (
      select 1 from aplica a where a.service = p_service and a.status = p_destino
    ) then 'servicio_sin_estado'
    when p_status = p_destino then 'ya_en_estado'
    when not exists (select 1 from posicion p where p.status = p_status)
      or not exists (select 1 from posicion p where p.status = p_destino)
      then 'estado_desconocido'
    when (select p.pos from posicion p where p.status = p_status)
       > (select p.pos from posicion p where p.status = p_destino)
      then 'mas_avanzado'
    else 'avanza'
  end
$function$;

comment on function public.naviera_avance_decision(text, text, text) is
  'SDD-0530: ¿el envío avanza al destino del contenedor (shipped al zarpar, in_customs al arribar)? Devuelve avanza o el motivo. Misma regla que decidirAvance (lib/studio/naviera/avance-por-contenedor.ts). Sin EXECUTE para roles de API.';

revoke all on function public.naviera_avance_decision(text, text, text)
  from public, anon, authenticated, service_role;

-- ── 3. Nadie zarpa ni arriba un contenedor sin la RPC ────────
create function public.guard_consolidation_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is distinct from old.status
     and new.status in ('zarpado', 'arribado')
     and coalesce(
       nullif(
         pg_catalog.btrim(pg_catalog.current_setting('dtd.consolidation_advance', true)),
         ''
       ),
       ''
     ) is distinct from new.id::text then
    raise exception 'naviera: zarpar o arribar el contenedor requiere advance_consolidation_governed'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_consolidation_advance() owner to postgres;
revoke all on function public.guard_consolidation_advance()
  from public, anon, authenticated, service_role;

create trigger guard_consolidation_advance_trg
before update of status on public.consolidations
for each row execute function public.guard_consolidation_advance();

-- ── 4. La RPC ────────────────────────────────────────────────
create function public.advance_consolidation_governed(
  p_consolidation_id uuid,
  p_to text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_to text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_to, '')));
  v_from text;
  v_destino text;
  v_nota text;
  v_consolidation public.consolidations%rowtype;
  v_shipment public.shipments%rowtype;
  v_decision text;
  v_avanzados jsonb := '[]'::jsonb;
  v_avanzados_audit jsonb := '[]'::jsonb;
  v_saltados jsonb := '[]'::jsonb;
  v_saltados_audit jsonb := '[]'::jsonb;
  v_sin_envio integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_correlation text := 'naviera-avance:' || pg_catalog.gen_random_uuid()::text;
begin
  if v_actor is null then
    raise exception 'naviera: autenticación requerida' using errcode = '42501';
  end if;

  if v_to = 'zarpado' then
    v_from := 'cerrado';
    v_destino := 'shipped';
  elsif v_to = 'arribado' then
    v_from := 'zarpado';
    v_destino := 'in_customs';
  else
    raise exception 'naviera: el contenedor sólo avanza a zarpado o arribado'
      using errcode = '22023';
  end if;

  -- Un contenedor de otro tenant, o de uno donde el actor no tiene membresía
  -- activa, «no existe» (P0002): no se revela que está ahí.
  select c.* into v_consolidation
  from public.consolidations c
  where c.id = p_consolidation_id
    and c.deleted_at is null
    and exists (
      select 1
      from public.user_tenants ut
      where ut.user_id = v_actor
        and ut.tenant_id = c.tenant_id
        and ut.disabled_at is null
    )
  for update of c;
  if not found then
    raise exception 'naviera: contenedor no disponible' using errcode = 'P0002';
  end if;

  if not public.naviera_avance_module_authorized(v_consolidation.tenant_id, 'naviera')
     or not public.naviera_avance_module_authorized(v_consolidation.tenant_id, 'tracking') then
    raise exception 'naviera: zarpar o arribar exige editar Naviera y Tracking'
      using errcode = '42501';
  end if;

  -- Ya estaba: no se toca nada y no se audita lo que no pasó.
  if v_consolidation.status = v_to then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already',
      'tenant_id', v_consolidation.tenant_id,
      'consolidation_ref', v_consolidation.ref,
      'from', v_consolidation.status,
      'to', v_to,
      'shipment_status', v_destino,
      'advanced', '[]'::jsonb,
      'skipped', '[]'::jsonb,
      'pieces_without_shipment', 0
    );
  end if;

  if v_consolidation.status is distinct from v_from then
    raise exception 'naviera: el contenedor está en «%» y sólo pasa a «%» desde «%»',
      v_consolidation.status, v_to, v_from
      using errcode = '40001';
  end if;

  perform pg_catalog.set_config(
    'dtd.consolidation_advance', p_consolidation_id::text, true
  );

  update public.consolidations
     set status = v_to
   where id = p_consolidation_id
     and tenant_id = v_consolidation.tenant_id
     and status = v_from;
  if not found then
    raise exception 'naviera: conflicto al cambiar el contenedor' using errcode = '40001';
  end if;

  v_nota := case v_to
    when 'zarpado' then
      'Zarpó con el contenedor ' || coalesce(v_consolidation.ref, 'sin referencia') || '.'
    else
      'Llegó a Venezuela con el contenedor ' || coalesce(v_consolidation.ref, 'sin referencia') || '.'
  end;

  select pg_catalog.count(*)::integer into v_sin_envio
  from public.consolidation_items ci
  where ci.consolidation_id = p_consolidation_id
    and ci.tenant_id = v_consolidation.tenant_id
    and ci.shipment_id is null;

  for v_shipment in
    select s.*
    from public.shipments s
    where s.tenant_id = v_consolidation.tenant_id
      and s.id in (
        select ci.shipment_id
        from public.consolidation_items ci
        where ci.consolidation_id = p_consolidation_id
          and ci.tenant_id = v_consolidation.tenant_id
          and ci.shipment_id is not null
      )
    order by s.id
    for update of s
  loop
    if v_shipment.deleted_at is not null then
      v_decision := 'eliminado';
    else
      v_decision := public.naviera_avance_decision(
        v_shipment.shipment_service::text,
        v_shipment.status::text,
        v_destino
      );
    end if;

    if v_decision <> 'avanza' then
      v_saltados := v_saltados || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'shipment_id', v_shipment.id,
        'code', v_shipment.code,
        'status', v_shipment.status::text,
        'client_markbox', v_shipment.client_markbox,
        'reason', v_decision
      ));
      v_saltados_audit := v_saltados_audit || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'shipment_id', v_shipment.id,
        'shipment_code', v_shipment.code,
        'status', v_shipment.status::text,
        'reason', v_decision
      ));
      continue;
    end if;

    update public.shipments
       set status = v_destino::public.shipment_status
     where id = v_shipment.id
       and tenant_id = v_consolidation.tenant_id
       and status = v_shipment.status
       and deleted_at is null;
    if not found then
      raise exception 'naviera: conflicto al avanzar el envío %', v_shipment.code
        using errcode = '40001';
    end if;

    insert into public.shipment_events (
      tenant_id, shipment_id, status, note, occurred_at, created_by
    ) values (
      v_consolidation.tenant_id, v_shipment.id, v_destino::public.shipment_status,
      v_nota, v_now, v_actor
    );

    perform public.append_audit_event(
      v_consolidation.tenant_id,
      'shipment',
      v_shipment.id,
      'user',
      v_actor,
      'shipment_status_changed',
      'rpc',
      'succeeded',
      null,
      pg_catalog.jsonb_build_object('status', v_shipment.status::text),
      pg_catalog.jsonb_build_object('status', v_destino),
      pg_catalog.jsonb_build_object(
        'via', 'consolidation_' || v_to,
        'consolidation_id', p_consolidation_id,
        'consolidation_ref', v_consolidation.ref,
        'shipment_code', v_shipment.code,
        'from', v_shipment.status::text,
        'to', v_destino
      ),
      v_correlation,
      1,
      'internal'
    );

    v_avanzados := v_avanzados || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'shipment_id', v_shipment.id,
      'code', v_shipment.code,
      'from', v_shipment.status::text,
      'client_markbox', v_shipment.client_markbox,
      'client_name', v_shipment.client_name
    ));
    v_avanzados_audit := v_avanzados_audit || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'shipment_id', v_shipment.id,
      'shipment_code', v_shipment.code,
      'from', v_shipment.status::text
    ));
  end loop;

  perform public.append_audit_event(
    v_consolidation.tenant_id,
    'consolidation',
    p_consolidation_id,
    'user',
    v_actor,
    'consolidation_status_advanced',
    'rpc',
    'succeeded',
    null,
    pg_catalog.jsonb_build_object('status', v_consolidation.status),
    pg_catalog.jsonb_build_object('status', v_to),
    pg_catalog.jsonb_build_object(
      'consolidation_ref', v_consolidation.ref,
      'from', v_consolidation.status,
      'to', v_to,
      'shipment_status', v_destino,
      'advanced', v_avanzados_audit,
      'skipped', v_saltados_audit,
      'pieces_without_shipment', v_sin_envio
    ),
    v_correlation,
    1,
    'internal'
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'transitioned',
    'tenant_id', v_consolidation.tenant_id,
    'consolidation_ref', v_consolidation.ref,
    'from', v_consolidation.status,
    'to', v_to,
    'shipment_status', v_destino,
    'advanced', v_avanzados,
    'skipped', v_saltados,
    'pieces_without_shipment', v_sin_envio,
    'correlation_id', v_correlation
  );
end;
$function$;

alter function public.advance_consolidation_governed(uuid, text) owner to postgres;
revoke all on function public.advance_consolidation_governed(uuid, text)
  from public, anon, service_role;
grant execute on function public.advance_consolidation_governed(uuid, text)
  to authenticated;

comment on function public.advance_consolidation_governed(uuid, text) is
  'SDD-0530: zarpa (cerrado → zarpado) o arriba (zarpado → arribado) un contenedor y en la misma transacción avanza sus envíos a shipped o in_customs según naviera_avance_decision, con shipment_events y AUD-01 por envío y por contenedor. Exige membresía activa y edición de Naviera y Tracking. Si el contenedor ya estaba en el destino devuelve outcome already sin tocar nada. Los avisos al cliente los programa la app.';
