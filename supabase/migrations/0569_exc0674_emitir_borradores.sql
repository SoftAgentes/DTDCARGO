-- ─────────────────────────────────────────────────────────────────────────────
-- 0569 · SDD-0690 — «Facturar» en Embarques emite la pre-orden (borrador) del cliente
--        (regla transitoria EXC-0674, ampliada a pre-orden y «Facturar todo»).
--
-- ⚠️ NO APLICADA EN NINGÚN ENTORNO. Va declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Para aplicarla en producción hace
--    falta el OK nominal de Sam NOMBRANDO este archivo, el runbook aplicar-migraciones-prod y el
--    Director General. Fusionar la PR NO autoriza aplicarla. Sin la 0569 la pantalla no emite
--    pre-órdenes: la acción nueva devuelve un error sin emitir nada, y el camino del monto
--    tecleado (0564) sigue como está.
--
-- ── Por qué (decisiones de Sam del 2026-11-20, por el DG; spec docs/specs/0690-…) ─────────
-- En el contenedor 64 el precio de cada cliente sale de la pre-orden del Excel (el borrador que crea
-- el cargador de consolidados, SDD-0543). «Facturar» ya no teclea el monto: emite esa pre-orden tal
-- como está, con su código y su total, y «Facturar todo» emite todas las del contenedor en una sola
-- llamada. En Embarques no se edita el precio; si hace falta corregirlo, se corrige la pre-orden en
-- Facturación antes de emitir. La oprimen SOLO `accounting` y `admin`, como en la 0564.
--
-- La excepción explícita EXC-0674 (docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md)
-- se amplía a estas dos acciones con el mismo alcance y la misma fecha de revisión (Sam, 2026-11-20):
--   · AUT-04: esta RPC NO consulta la aceptación de T&C del gate legal de la app, y solo esa regla
--     (LEGAL_GATE_HARD_BLOCK sigue igual para todo lo demás, y emitInvoice no cambia). La aceptación
--     se exige en el portal (SDD-0693). Cada factura emitida queda en exc0674_facturas con
--     legal_ack = 'exc_0674', quién la emitió, la hora y origen_monto = 'borrador'.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. exc0674_facturas.origen_monto ('tecleado' | 'borrador', not null, default 'tecleado'): de dónde salió el
--    monto. Las filas existentes (las de la 0564) quedan en 'tecleado'.
-- 2. public.exc0674_emitir_borradores(p_consolidation_id uuid, p_invoice_ids uuid[], p_confirmacion text):
--    · SECURITY DEFINER con search_path vacío; EXECUTE solo para authenticated.
--    · Las mismas guardas de la 0564: rol accounting o admin, p_confirmacion = 'Confirmado' exacto y
--      contenedor vivo, del tenant y en la lista exc0674_contenedores. Entre 1 y 500 ids, sin repetidos
--      ni nulos.
--    · TODO O NADA, en una transacción, y por cada factura:
--        - existe, es del tenant de la sesión, está viva, en 'borrador', en USD y con total > 0;
--        - su shipment_id es un embarque vigente del contenedor (la asignación más reciente del
--          embarque es este contenedor, la misma regla que Embarques, SDD-0643); el cliente es el
--          Shipping Mark de ese embarque;
--        - el cliente no tiene ya una fila viva (anulada_at is null) en exc0674_facturas para el
--          contenedor;
--        - toma el lock de numeración del tenant y el lock por cliente de la 0564 (mismas llaves), en
--          orden de Shipping Mark, así que no se cruza con un «Facturar» con monto tecleado;
--        - UPDATE a 'emitida' con issued_at de hoy (America/Caracas), due_date a +30 días y
--          write_version + 1. El código, las líneas y los montos NO cambian;
--        - el asiento con post_invoice_journal_entry_atomic: si no queda posted ni already_posted, no
--          se emite nada;
--        - el vínculo con los envíos del cliente en el contenedor, la fila de exc0674_facturas con
--          origen_monto 'borrador' y el evento invoice_emitted_exc0674_borrador (append_audit_event, en la
--          misma transacción).
--    · Devuelve la misma forma que la 0564: {"version":1,"facturas":[{client_markbox, invoice_id,
--      invoice_code, billed_markbox, billed_name, shipment_code, issued_at, due_date, total_usd}]}.
--    · Errores con la forma de la 0564, `exc0674:<motivo>[:<detalle>]`: sin_sesion, rol,
--      sin_confirmacion, datos, contenedor_fuera_de_lista, factura_inexistente:<id> (no existe, es de
--      otro tenant o está borrada), envio_fuera_del_contenedor:<código>, ya_facturado:<Shipping Mark>,
--      no_borrador:<código>, moneda:<código>, monto:<código>, borrador_alterado:<código> y
--      asiento:<motivo>.
--
-- ── Lo que se dispara al emitir (medido en los triggers de invoices) ─────────
-- El UPDATE borrador → emitida es el mismo que hace emitInvoice, y los triggers lo aceptan:
--   · titular 0466 (invoices_seal_billing_titular): en borrador → emitida sella el titular desde la
--     ficha del cliente; por eso billed_name se lee del RETURNING, después del sello;
--   · guarda i3 0497 (i3_invoice_guard): solo frena desvincular, borrar o reabrir una factura con
--     asiento automático; el borrador no tiene asiento;
--   · write_version 0495: pone old + 1 (el SET explícito da lo mismo);
--   · auditoría d2 0290: deja su invoice_emitted;
--   · crédito de referido 0197/0494 en la primera factura, como cualquier emisión.
-- No hace falta ningún GUC especial. El correo invoice_emitted lo manda la app después del commit.
--
-- ── Qué NO toca ─────────────────────────────────────────────
-- Ninguna fila existente salvo los borradores que se le pasan. Ni la RLS de invoices (0407/0414), ni
-- sus grants, ni LEGAL_GATE_HARD_BLOCK, ni exc0674_facturar (0564), ni la carga de consolidados.
--
-- ── Locks ───────────────────────────────────────────────────
-- ALTER TABLE … ADD COLUMN con default constante en exc0674_facturas (ACCESS EXCLUSIVE breve; tabla
-- chica), CREATE FUNCTION y grants. lock_timeout 5 s. Idempotente.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0569_desarme.sql (sin número; usarlo exige el OK nominal de Sam). Si ya hay
-- facturas emitidas por esta RPC (origen_monto 'borrador'), el desarme se niega: esas facturas se anulan por
-- el camino normal de Facturación.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ─── 0. Preflight ────────────────────────────────────────────
do $preflight$
declare
  v_missing text;
begin
  select pg_catalog.string_agg(required.object_name, ', ' order by required.object_name)
    into v_missing
  from (values
      ('table public.invoices',             pg_catalog.to_regclass('public.invoices') is not null),
      ('table public.consolidations',       pg_catalog.to_regclass('public.consolidations') is not null),
      ('table public.consolidation_items',  pg_catalog.to_regclass('public.consolidation_items') is not null),
      ('table public.shipments',            pg_catalog.to_regclass('public.shipments') is not null),
      ('table public.exc0674_contenedores (0564)', pg_catalog.to_regclass('public.exc0674_contenedores') is not null),
      ('table public.exc0674_facturas (0564)',     pg_catalog.to_regclass('public.exc0674_facturas') is not null),
      ('table public.exc0674_factura_envios (0564)', pg_catalog.to_regclass('public.exc0674_factura_envios') is not null),
      ('function public.get_user_tenant_id()', pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null),
      ('function public.current_studio_role()', pg_catalog.to_regprocedure('public.current_studio_role()') is not null),
      ('function public.post_invoice_journal_entry_atomic(uuid,uuid)',
        pg_catalog.to_regprocedure('public.post_invoice_journal_entry_atomic(uuid,uuid)') is not null),
      ('function public.append_audit_event(…)', pg_catalog.to_regprocedure(
        'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is not null)
  ) as required(object_name, present)
  where not required.present;
  if v_missing is not null then
    raise exception '0569 requiere objetos ausentes: %', v_missing;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'invoices' and column_name = 'write_version') then
    raise exception '0569 requiere invoices.write_version (0495)';
  end if;
end
$preflight$;

-- ─── 1. De dónde salió el monto ──────────────────────────────
alter table public.exc0674_facturas
  add column if not exists origen_monto text not null default 'tecleado'
    constraint exc0674_facturas_origen_monto_valido check (origen_monto in ('tecleado', 'borrador'));
comment on column public.exc0674_facturas.origen_monto is
  'SDD-0690: de dónde salió el monto. tecleado = la oficina lo tecleó (exc0674_facturar, 0564); borrador = se emitió la pre-orden del Excel tal como estaba (exc0674_emitir_borradores, 0569). Con origen_monto borrador, tecleado_por es quién la emitió.';
comment on table public.exc0674_facturas is
  'SDD-0674 · EXC-0674: una fila por cliente del contenedor facturado desde Embarques. Rastro del monto (total con IVA, USD), de quién lo tecleó o emitió, de dónde salió (origen_monto) y de la excepción al gate AUT-04 (legal_ack = exc_0674). Solo la escriben exc0674_facturar() (0564) y exc0674_emitir_borradores() (0569).';

-- ─── 2. La RPC ───────────────────────────────────────────────
create or replace function public.exc0674_emitir_borradores(
  p_consolidation_id uuid,
  p_invoice_ids uuid[],
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
  v_hoy       date := (pg_catalog.statement_timestamp() at time zone 'America/Caracas')::date;
  v_n         integer;
  v_id        uuid;
  v_ids       uuid[] := array[]::uuid[];
  v_mbs       text[] := array[]::text[];
  v_par       record;
  v_inv       public.invoices%rowtype;
  v_mb        text;
  v_mb_ahora  text;
  v_envio_cd  text;
  v_code      text;
  v_titular   text;
  v_nombre    text;
  v_total     numeric;
  v_base      numeric;
  v_iva       numeric;
  v_post      jsonb;
  v_outcome   text;
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
  v_n := coalesce(pg_catalog.cardinality(p_invoice_ids), 0);
  -- Primero las dimensiones: array_position no acepta arreglos de más de una.
  if p_consolidation_id is null or v_n = 0 or v_n > 500
     or pg_catalog.array_ndims(p_invoice_ids) is distinct from 1 then
    raise exception 'exc0674:datos' using errcode = '22023';
  end if;
  if pg_catalog.array_position(p_invoice_ids, null) is not null
     or (select pg_catalog.count(distinct x.id) from pg_catalog.unnest(p_invoice_ids) as x(id)) <> v_n then
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

  -- El mismo lock de numeración de la 0564: esta RPC no numera (el código se asignó al crear el
  -- borrador), pero así un «Facturar» con monto tecleado y una emisión de pre-orden del mismo tenant
  -- van en fila.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('exc0674:numeracion:' || v_tenant::text, 0));

  -- Primera pasada, sin locks de fila: de qué cliente es cada factura (el Shipping Mark de su embarque
  -- vigente en el contenedor). Sirve para bloquear en orden de Shipping Mark, como la 0564.
  foreach v_id in array p_invoice_ids loop
    select * into v_inv from public.invoices i where i.id = v_id and i.tenant_id = v_tenant;
    if not found or v_inv.deleted_at is not null then
      raise exception 'exc0674:factura_inexistente:%', v_id using errcode = '22023';
    end if;
    v_mb := null;
    select pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) into v_mb
      from public.shipments s
     where s.id = v_inv.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       and (select ci.consolidation_id
              from public.consolidation_items ci
             where ci.tenant_id = v_tenant and ci.shipment_id = s.id
             order by ci.created_at desc, ci.id desc
             limit 1) = p_consolidation_id;
    if v_mb is null or v_mb = '' then
      raise exception 'exc0674:envio_fuera_del_contenedor:%', v_inv.invoice_code using errcode = '22023';
    end if;
    v_ids := v_ids || v_id;
    v_mbs := v_mbs || v_mb;
  end loop;

  -- Segunda pasada, en orden de Shipping Mark: lock por cliente, lock de la fila y todas las guardas
  -- otra vez, ya con los locks tomados.
  for v_par in
    select x.id, x.mb
      from rows from (pg_catalog.unnest(v_ids), pg_catalog.unnest(v_mbs)) as x(id, mb)
     order by x.mb, x.id
  loop
    v_mb := v_par.mb;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('exc0674:' || v_tenant::text || ':' || p_consolidation_id::text || ':' || v_mb, 0));
    if exists (select 1 from public.exc0674_facturas f
                where f.tenant_id = v_tenant and f.consolidation_id = p_consolidation_id
                  and f.client_markbox = v_mb and f.anulada_at is null) then
      raise exception 'exc0674:ya_facturado:%', v_mb using errcode = '23505';
    end if;

    select * into v_inv from public.invoices i
     where i.id = v_par.id and i.tenant_id = v_tenant
       for update;
    if not found or v_inv.deleted_at is not null then
      raise exception 'exc0674:factura_inexistente:%', v_par.id using errcode = '22023';
    end if;
    if v_inv.status::text <> 'borrador' then
      raise exception 'exc0674:no_borrador:%', v_inv.invoice_code using errcode = '22023';
    end if;
    if v_inv.currency::text <> 'USD' then
      raise exception 'exc0674:moneda:%', v_inv.invoice_code using errcode = '22023';
    end if;
    if v_inv.total_amount is null or v_inv.total_amount <= 0 then
      raise exception 'exc0674:monto:%', v_inv.invoice_code using errcode = '22023';
    end if;
    -- El embarque puede haber cambiado mientras se esperaba el lock: se vuelve a medir.
    v_mb_ahora := null;
    v_envio_cd := null;
    select pg_catalog.upper(pg_catalog.btrim(s.client_markbox)), s.code into v_mb_ahora, v_envio_cd
      from public.shipments s
     where s.id = v_inv.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
       and (select ci.consolidation_id
              from public.consolidation_items ci
             where ci.tenant_id = v_tenant and ci.shipment_id = s.id
             order by ci.created_at desc, ci.id desc
             limit 1) = p_consolidation_id;
    if v_mb_ahora is distinct from v_mb then
      raise exception 'exc0674:envio_fuera_del_contenedor:%', v_inv.invoice_code using errcode = '22023';
    end if;

    -- La emisión: el código, las líneas y los montos de la pre-orden no cambian.
    update public.invoices i
       set status = 'emitida',
           issued_at = v_hoy,
           due_date = v_hoy + 30,
           write_version = i.write_version + 1
     where i.id = v_inv.id and i.tenant_id = v_tenant
       and i.status::text = 'borrador' and i.deleted_at is null
    returning i.invoice_code, i.client_markbox, i.client_name, i.total_amount, i.base_amount, i.iva_amount
      into v_code, v_titular, v_nombre, v_total, v_base, v_iva;
    if not found then
      raise exception 'exc0674:no_borrador:%', v_inv.invoice_code using errcode = '22023';
    end if;
    if v_code is distinct from v_inv.invoice_code or v_total is distinct from v_inv.total_amount
       or v_base is distinct from v_inv.base_amount or v_iva is distinct from v_inv.iva_amount then
      raise exception 'exc0674:borrador_alterado:%', v_inv.invoice_code using errcode = '55000';
    end if;

    -- El asiento va en la misma transacción, con la regla de la 0564.
    v_post := public.post_invoice_journal_entry_atomic(v_tenant, v_inv.id);
    v_outcome := coalesce(v_post ->> 'outcome', '');
    if v_outcome not in ('posted', 'already_posted') then
      raise exception 'exc0674:asiento:%', coalesce(v_post ->> 'reason', 'desconocido') using errcode = '55000';
    end if;

    -- Qué envíos cubre la factura (para «Embarques sin facturar», SDD-0574): todos los del cliente en
    -- el contenedor, no solo el que guarda la pre-orden.
    with vigente as (
      select distinct on (ci.shipment_id) ci.shipment_id, ci.consolidation_id
        from public.consolidation_items ci
       where ci.tenant_id = v_tenant and ci.shipment_id is not null
       order by ci.shipment_id, ci.created_at desc, ci.id desc
    )
    insert into public.exc0674_factura_envios (tenant_id, invoice_id, shipment_id, consolidation_id, client_markbox)
    select v_tenant, v_inv.id, s.id, p_consolidation_id, v_mb
      from vigente v
      join public.shipments s on s.id = v.shipment_id and s.tenant_id = v_tenant and s.deleted_at is null
     where v.consolidation_id = p_consolidation_id
       and pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = v_mb;

    insert into public.exc0674_facturas
      (tenant_id, consolidation_id, client_markbox, invoice_id, invoice_code, billed_markbox,
       total_usd, tecleado_por, origen_monto)
    values
      (v_tenant, p_consolidation_id, v_mb, v_inv.id, v_code, v_titular, v_total, v_uid, 'borrador');

    -- AUD-01: el evento y la mutación son una sola operación. legal_ack = exc_0674 dice que esta
    -- factura salió sin consultar la aceptación de T&C del gate AUT-04.
    perform public.append_audit_event(
      v_tenant, 'invoice', v_inv.id, 'user', v_uid, 'invoice_emitted_exc0674_borrador', 'rpc', 'succeeded',
      'EXC-0674 ampliada a pre-orden (Sam, 2026-11-20): pre-orden emitida desde Embarques sin consultar la aceptación de T&C del gate AUT-04; solo esa regla no aplica',
      pg_catalog.jsonb_build_object('invoice_code', v_code, 'status', 'borrador'),
      pg_catalog.jsonb_build_object(
        'invoice_code', v_code, 'status', 'emitida', 'currency', 'USD', 'total_amount', v_total,
        'base_amount', v_base, 'iva_amount', v_iva, 'billed_markbox', v_titular,
        'client_markbox', v_mb, 'consolidation_id', p_consolidation_id, 'consolidation_ref', v_ref,
        'legal_ack', 'exc_0674', 'tecleado_por', v_uid, 'origen', 'borrador', 'asiento', v_outcome),
      pg_catalog.jsonb_build_object('regla', 'EXC-0674', 'sdd', '0690', 'ampliacion', 'pre-orden'),
      null, 1, 'internal');

    v_salida := v_salida || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'client_markbox', v_mb, 'invoice_id', v_inv.id, 'invoice_code', v_code,
      'billed_markbox', v_titular, 'billed_name', v_nombre,
      'shipment_code', coalesce(v_inv.shipment_code, v_envio_cd),
      'issued_at', v_hoy, 'due_date', v_hoy + 30, 'total_usd', v_total));
  end loop;

  return pg_catalog.jsonb_build_object('version', 1, 'facturas', v_salida);
end;
$function$;

comment on function public.exc0674_emitir_borradores(uuid, uuid[], text) is
  'SDD-0690 · EXC-0674 ampliada a pre-orden: emite las pre-órdenes (borradores en USD) de clientes de un contenedor de la lista transitoria (exc0674_contenedores). Todo o nada: pasa cada borrador a emitida sin cambiar su código ni sus montos, hace su asiento y deja el rastro en exc0674_facturas con origen_monto = borrador. Roles accounting y admin del tenant de la sesión. No consulta la aceptación de T&C del gate legal AUT-04 de la app (excepción explícita, legal_ack = exc_0674).';

revoke all on function public.exc0674_emitir_borradores(uuid, uuid[], text) from public, anon, service_role;
grant execute on function public.exc0674_emitir_borradores(uuid, uuid[], text) to authenticated;

-- ─── 3. Postflight ───────────────────────────────────────────
do $postflight$
declare
  v_rol text;
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('public.exc0674_emitir_borradores(uuid,uuid[],text)')
       and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception '0569 postflight: exc0674_emitir_borradores sin search_path vacío o sin SECURITY DEFINER';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if pg_catalog.has_function_privilege(v_rol, 'public.exc0674_emitir_borradores(uuid,uuid[],text)', 'EXECUTE')
       <> (v_rol = 'authenticated') then
      raise exception '0569 postflight: EXECUTE de % sobre exc0674_emitir_borradores no es el esperado', v_rol;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'exc0674_facturas'
                    and column_name = 'origen_monto' and is_nullable = 'NO'
                    and column_default like '''tecleado''%') then
    raise exception '0569 postflight: falta exc0674_facturas.origen_monto not null con default tecleado';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conrelid = 'public.exc0674_facturas'::pg_catalog.regclass
                    and conname = 'exc0674_facturas_origen_monto_valido' and contype = 'c' and convalidated) then
    raise exception '0569 postflight: falta el check de exc0674_facturas.origen_monto';
  end if;
  foreach v_rol in array array['anon', 'authenticated'] loop
    if pg_catalog.has_table_privilege(v_rol, 'public.exc0674_facturas', 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_table_privilege(v_rol, 'public.exc0674_factura_envios', 'INSERT,UPDATE,DELETE') then
      raise exception '0569 postflight: % puede escribir el rastro de la EXC-0674', v_rol;
    end if;
  end loop;
end
$postflight$;

notify pgrst, 'reload schema';
