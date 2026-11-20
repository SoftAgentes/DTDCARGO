-- SDD-0690 · Desarme de la 0569: quita la emisión de pre-órdenes desde Embarques (EXC-0674 ampliada).
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada lo
--    aplique ni lo empaquete. Usarlo exige el OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0569_exc0674_emitir_borradores.test.sql (CONTRATO 12: se niega con facturas
-- de origen_monto borrador y, sin ellas, no deja ningún objeto de la 0569, repone exc0674_facturar de la
-- 0564 y no toca el resto de la 0564).
-- Se NIEGA si ya hay facturas emitidas por esta RPC (exc0674_facturas.origen_monto = 'borrador'): esas
-- facturas son reales, se anulan por el camino normal de Facturación y su rastro no se borra. Sin
-- ellas, borra la función y la columna origen_monto (todas las filas que quedan son 'tecleado', el valor
-- implícito de la 0564) y repone exc0674_facturar con la definición de la 0564 (copia íntegra de
-- supabase/migrations/0564_exc0674_facturar_contenedor.sql: cuerpo, comentario y grants), es decir, sin la
-- guarda exc0674:tiene_preorden de la 0569. Si exc0674_facturar ya no existe (se corrió antes
-- 0564_desarme.sql), no la recrea. No toca nada más de la 0564: para quitar también la regla está
-- 0564_desarme.sql.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guarda$
declare
  v_hay boolean := false;
begin
  -- Dinámico: si la columna ya no está (desarme repetido), la consulta no se puede ni planear.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'exc0674_facturas' and column_name = 'origen_monto') then
    execute 'select exists (select 1 from public.exc0674_facturas where origen_monto <> ''tecleado'')' into v_hay;
  end if;
  if v_hay then
    raise exception '0569 desarme: hay facturas emitidas desde una pre-orden (origen_monto borrador); no se desarma (avisar al DG)';
  end if;
end
$guarda$;

drop function if exists public.exc0674_emitir_borradores(uuid, uuid[], text);

do $columna$
begin
  if pg_catalog.to_regclass('public.exc0674_facturas') is not null then
    alter table public.exc0674_facturas drop column if exists origen_monto;
    comment on table public.exc0674_facturas is
      'SDD-0674 · EXC-0674: una fila por cliente del contenedor facturado desde Embarques. Rastro del monto tecleado (total con IVA, USD), de quién lo tecleó y de la excepción al gate AUT-04 (legal_ack = exc_0674). Solo la escribe exc0674_facturar().';
  end if;
end
$columna$;

-- La definición de la 0564, solo si la función sigue ahí (no resucita lo que quitó 0564_desarme.sql).
do $reponer_0564$
begin
  if pg_catalog.to_regprocedure('public.exc0674_facturar(uuid,jsonb,text)') is null then
    return;
  end if;
  execute $restaurar$
create or replace function public.exc0674_facturar(
  p_consolidation_id uuid,
  p_montos jsonb,
  p_confirmacion text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid       uuid := (select auth.uid());
  v_tenant    uuid := public.get_user_tenant_id();
  v_role      text := public.current_studio_role();
  v_ref       text;
  v_iva_on    boolean;
  v_iva_rate  numeric;
  v_hoy       date := (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
  v_item      jsonb;
  v_mb        text;
  v_total     numeric;
  v_base      numeric;
  v_iva       numeric;
  v_n_env     integer;
  v_cbm_total numeric;
  v_lines     jsonb;
  v_first_id  uuid;
  v_first_cd  text;
  v_codes     text;
  v_client    uuid;
  v_aliado    uuid;
  v_padre     uuid;
  v_root      uuid;
  v_fact      public.clients%rowtype;
  v_code      text;
  v_inv       uuid;
  v_nombre    text;
  v_titular   text;
  v_post      jsonb;
  v_outcome   text;
  v_vistos    text[] := array[]::text[];
  v_n_fichas  integer;
  v_cadena    uuid[];
  v_salida    jsonb := '[]'::jsonb;
begin
  if v_uid is null or v_tenant is null then
    raise exception 'exc0674:sin_sesion' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('accounting', 'admin') then
    raise exception 'exc0674:rol' using errcode = '42501';
  end if;
  if p_confirmacion is distinct from 'Confirmado' then
    raise exception 'exc0674:sin_confirmacion' using errcode = '22023';
  end if;
  if p_consolidation_id is null or p_montos is null or pg_catalog.jsonb_typeof(p_montos) <> 'array'
     or pg_catalog.jsonb_array_length(p_montos) = 0 or pg_catalog.jsonb_array_length(p_montos) > 500 then
    raise exception 'exc0674:datos' using errcode = '22023';
  end if;

  -- El contenedor: vivo, del tenant y en la lista transitoria.
  select c.ref into v_ref
    from public.consolidations c
    join public.exc0674_contenedores l
      on l.consolidation_id = c.id and l.tenant_id = c.tenant_id
   where c.id = p_consolidation_id and c.tenant_id = v_tenant and c.deleted_at is null;
  if v_ref is null then
    raise exception 'exc0674:contenedor_fuera_de_lista' using errcode = '42501';
  end if;

  select coalesce(t.iva_enabled, false) into v_iva_on from public.tenants t where t.id = v_tenant;
  v_iva_rate := case when v_iva_on then 16 else 0 end;

  -- next_invoice_code (0077) calcula max+1 sin lock: dos llamadas simultáneas del mismo tenant
  -- pedirían el mismo número. Esta regla factura en fila por tenant. Contra un createInvoice del
  -- Studio que corra a la vez manda el unique (tenant_id, invoice_code) y se deshace todo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('exc0674:numeracion:' || v_tenant::text, 0));

  -- Los clientes se procesan (y se bloquean) en orden de Shipping Mark.
  for v_item in
    select e.value
      from pg_catalog.jsonb_array_elements(p_montos) as e
     order by pg_catalog.upper(pg_catalog.btrim(e.value ->> 'client_markbox')) nulls first
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or pg_catalog.jsonb_typeof(v_item -> 'client_markbox') <> 'string'
       or pg_catalog.jsonb_typeof(v_item -> 'total_usd') <> 'number' then
      raise exception 'exc0674:datos' using errcode = '22023';
    end if;
    v_mb := pg_catalog.upper(pg_catalog.btrim(v_item ->> 'client_markbox'));
    v_total := (v_item ->> 'total_usd')::numeric;
    if v_mb = '' or v_mb = any (v_vistos) then
      raise exception 'exc0674:datos' using errcode = '22023';
    end if;
    v_vistos := v_vistos || v_mb;
    if v_total is null or v_total <= 0 or v_total <> pg_catalog.round(v_total, 2)
       or v_total >= 1000000000000 then
      raise exception 'exc0674:monto:%', v_mb using errcode = '22023';
    end if;

    -- Un cliente se factura una vez por contenedor (además de la llave única).
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('exc0674:' || v_tenant::text || ':' || p_consolidation_id::text || ':' || v_mb, 0));
    if exists (select 1 from public.exc0674_facturas f
                where f.tenant_id = v_tenant and f.consolidation_id = p_consolidation_id
                  and f.client_markbox = v_mb and f.anulada_at is null) then
      raise exception 'exc0674:ya_facturado:%', v_mb using errcode = '23505';
    end if;

    -- Embarques vigentes del cliente en el contenedor: la asignación más reciente de cada
    -- embarque es este contenedor (la misma regla que Embarques, SDD-0643).
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    ), envios as (
      select s.id, s.code, coalesce(s.volume_m3, 0)::numeric as cbm
        from vigente v
        join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       where v.consolidation_id = p_consolidation_id
         and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb
    )
    select pg_catalog.count(*)::integer, coalesce(pg_catalog.sum(e.cbm), 0)
      into v_n_env, v_cbm_total
      from envios e;
    if v_n_env = 0 then
      raise exception 'exc0674:cliente_sin_embarques:%', v_mb using errcode = '22023';
    end if;

    -- A quién se factura: al cliente o, si es de un aliado, al aliado raíz (SDD-0543).
    -- Si dos fichas vivas comparten el Shipping Mark normalizado, no se adivina: error explícito.
    select pg_catalog.count(*)::integer into v_n_fichas
      from public.clients c
     where c.tenant_id = v_tenant and pg_catalog.upper(pg_catalog.btrim(c.markbox)) = v_mb
       and c.deleted_at is null;
    if v_n_fichas > 1 then
      raise exception 'exc0674:cliente_ambiguo:%', v_mb using errcode = '22023';
    end if;
    v_client := null;
    v_aliado := null;
    select c.id, c.aliado_id into v_client, v_aliado
      from public.clients c
     where c.tenant_id = v_tenant and pg_catalog.upper(pg_catalog.btrim(c.markbox)) = v_mb
       and c.deleted_at is null;
    if v_client is null then
      raise exception 'exc0674:cliente_inexistente:%', v_mb using errcode = '22023';
    end if;
    v_root := v_client;
    if v_aliado is not null then
      -- Guarda contra ciclos en la cadena de aliados: un aliado repetido (o más de 32 saltos) aborta.
      v_cadena := array[v_aliado];
      loop
        v_padre := null;
        select a.parent_aliado_id, a.client_id into v_padre, v_root
          from public.aliados a where a.id = v_aliado and a.tenant_id = v_tenant;
        exit when v_padre is null;
        if v_padre = any(v_cadena) or pg_catalog.cardinality(v_cadena) >= 32 then
          raise exception 'exc0674:aliado_ciclo:%', v_mb using errcode = '22023';
        end if;
        v_cadena := v_cadena || v_padre;
        v_aliado := v_padre;
      end loop;
      if v_root is null then v_root := v_client; end if;
    end if;
    select * into v_fact from public.clients c
     where c.id = v_root and c.tenant_id = v_tenant and c.deleted_at is null;
    if not found or v_fact.markbox is null then
      raise exception 'exc0674:titular_inexistente:%', v_mb using errcode = '22023';
    end if;

    -- El total tecleado incluye el IVA.
    v_base := pg_catalog.round(v_total / (1 + v_iva_rate / 100), 2);
    v_iva := v_total - v_base;

    -- Una línea por embarque. El monto se reparte por CBM (en partes iguales si ninguno tiene
    -- CBM) y la última línea absorbe el redondeo, así que la suma da exactamente la base.
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    ), envios as (
      select s.id, s.code, coalesce(s.volume_m3, 0)::numeric as cbm,
             pg_catalog.row_number() over (order by s.code, s.id) as n
        from vigente v
        join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       where v.consolidation_id = p_consolidation_id
         and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb
    ), reparto as (
      select e.*,
             pg_catalog.round(v_base * case when v_cbm_total > 0 then e.cbm / v_cbm_total
                                            else 1::numeric / v_n_env end, 2) as parte
        from envios e
    ), ajustado as (
      select r.*,
             case when r.n = v_n_env
                  then v_base - coalesce((select pg_catalog.sum(x.parte) from reparto x where x.n < v_n_env), 0)
                  else r.parte end as precio
        from reparto r
    )
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'desc', 'Flete DDP · ' || a.code || ' · ' || pg_catalog.round(a.cbm, 3)::text || ' m³ · contenedor ' || v_ref,
             'qty', 1, 'unitPrice', a.precio, 'shipmentCode', a.code) order by a.n),
           (pg_catalog.array_agg(a.id order by a.n))[1],
           (pg_catalog.array_agg(a.code order by a.n))[1],
           pg_catalog.string_agg(a.code, ', ' order by a.n)
      into v_lines, v_first_id, v_first_cd, v_codes
      from ajustado a;

    v_code := public.next_invoice_code(v_tenant);
    insert into public.invoices
      (tenant_id, invoice_code, client_markbox, client_name, client_rif, client_doc_kind,
       shipment_id, shipment_code, currency, iva_rate, base_amount, iva_amount, total_amount,
       status, issued_at, due_date, lines, notes, fund_class)
    values
      (v_tenant, v_code, v_fact.markbox, v_fact.name, v_fact.rif, v_fact.doc_kind,
       v_first_id, v_first_cd, 'USD', v_iva_rate, v_base, v_iva, v_total,
       'emitida', v_hoy, v_hoy + 30, v_lines,
       'EXC-0674 · contenedor ' || v_ref || ' · cliente ' || v_mb || ' · embarques: ' || v_codes
         || case when v_root <> v_client then ' · facturado al aliado raíz' else '' end,
       'third_party')
    returning id, client_name, client_markbox into v_inv, v_nombre, v_titular;

    -- El asiento va en la misma transacción: si no sale, no se factura nada.
    -- post_invoice_journal_entry_atomic NO lanza: devuelve outcome posted | already_posted |
    -- not_posted (0497). Cualquier otra cosa deshace todo.
    v_post := public.post_invoice_journal_entry_atomic(v_tenant, v_inv);
    v_outcome := coalesce(v_post ->> 'outcome', '');
    if v_outcome not in ('posted', 'already_posted') then
      raise exception 'exc0674:asiento:%', coalesce(v_post ->> 'reason', 'desconocido') using errcode = '55000';
    end if;

    -- Qué envíos cubre la factura (para «Embarques sin facturar», SDD-0574).
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    )
    insert into public.exc0674_factura_envios (tenant_id, invoice_id, shipment_id, consolidation_id, client_markbox)
    select v_tenant, v_inv, s.id, p_consolidation_id, v_mb
      from vigente v
      join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
     where v.consolidation_id = p_consolidation_id
       and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb;

    insert into public.exc0674_facturas
      (tenant_id, consolidation_id, client_markbox, invoice_id, invoice_code, billed_markbox,
       total_usd, tecleado_por)
    values
      (v_tenant, p_consolidation_id, v_mb, v_inv, v_code, v_titular, v_total, v_uid);

    -- AUD-01: el evento y la mutación son una sola operación. legal_ack = exc_0674 dice que esta
    -- factura salió sin el gate AUT-04, por la excepción de Sam.
    perform public.append_audit_event(
      v_tenant, 'invoice', v_inv, 'user', v_uid, 'invoice_emitted_exc0674', 'rpc', 'succeeded',
      'EXC-0674: factura emitida desde Embarques sin el gate AUT-04 (excepción de Sam, 2026-11-18)',
      null,
      pg_catalog.jsonb_build_object(
        'invoice_code', v_code, 'status', 'emitida', 'currency', 'USD', 'total_amount', v_total,
        'base_amount', v_base, 'iva_amount', v_iva, 'billed_markbox', v_titular,
        'client_markbox', v_mb, 'consolidation_id', p_consolidation_id, 'consolidation_ref', v_ref,
        'legal_ack', 'exc_0674', 'tecleado_por', v_uid, 'asiento', v_outcome),
      pg_catalog.jsonb_build_object('regla', 'EXC-0674', 'sdd', '0674'),
      null, 1, 'internal');

    v_salida := v_salida || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'client_markbox', v_mb, 'invoice_id', v_inv, 'invoice_code', v_code,
      'billed_markbox', v_titular, 'billed_name', v_nombre, 'shipment_code', v_first_cd,
      'issued_at', v_hoy, 'due_date', v_hoy + 30, 'total_usd', v_total));
  end loop;

  return pg_catalog.jsonb_build_object('version', 1, 'facturas', v_salida);
end;
$function$;
$restaurar$;
  execute $restaurar$
comment on function public.exc0674_facturar(uuid, jsonb, text) is
  'SDD-0674 · EXC-0674: factura por cliente un contenedor de la lista transitoria (exc0674_contenedores). Todo o nada: crea la factura emitida en USD (el total tecleado lleva el IVA; se factura al aliado raíz si lo hay), su asiento y el rastro en exc0674_facturas. Roles accounting y admin del tenant de la sesión (Sam, 2026-11-18: operaciones no factura). No pasa por el gate legal AUT-04 de la app (excepción explícita, legal_ack = exc_0674).'
$restaurar$;
  execute $restaurar$
revoke all on function public.exc0674_facturar(uuid, jsonb, text) from public, anon, service_role
$restaurar$;
  execute $restaurar$
grant execute on function public.exc0674_facturar(uuid, jsonb, text) to authenticated
$restaurar$;
end
$reponer_0564$;

notify pgrst, 'reload schema';
