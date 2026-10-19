-- ─────────────────────────────────────────────────────────────────────────────
-- 0492 · SDD-0558 — Saldo único por cliente: public.client_outstanding(uuid[]).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0558. Es aditiva (una función nueva;
--    no reemplaza ni altera nada), así que la app desplegada hoy no la nota. La
--    app de SDD-0558, en cambio, la llama desde la ficha del cliente, el panel de
--    Conversaciones y el job de Kommo.
--
-- ── El defecto ──────────────────────────────────────────────
-- Había cuatro definiciones distintas del saldo de un cliente y la ficha no
-- mostraba ninguna:
--   · Cobranzas: por factura, `status <> anulada` (los borradores entraban) y
--     «hoy» en UTC (lib/studio/payment-queries.ts);
--   · Conversaciones (0412): moneda DOMINANTE, código vigente por igualdad exacta;
--   · el job de Kommo: Σ(total − pagado) SIN piso, monedas mezcladas;
--   · el estado de cuenta: moneda dominante, código vigente, sin piso, tope 200.
-- Esta función es LA definición del saldo por cliente. Cobranzas no la llama
-- (trabaja por factura), pero adopta la misma regla de estados y la fecha de
-- Caracas, y una prueba de propiedad fija la paridad.
--
-- ── Qué devuelve ────────────────────────────────────────────
-- Una fila por cliente pedido y por moneda, SIN convertir ni mezclar monedas:
-- abierto, vencido, cuántas facturas abiertas y vencidas, el vencimiento más
-- antiguo, la fecha del último pago, la fecha de corte (`as_of`) y el conjunto
-- de códigos del cliente (`markboxes`, el vigente primero). Un cliente sin
-- facturas que cuenten ni pagos recibe UNA fila semilla con `currency` null y
-- ceros, para que los códigos viajen igual. Una ficha borrada o de otro tenant
-- no devuelve fila. Solo agregados: ni ids, ni códigos, ni montos por factura.
--
-- ── Quién la puede llamar (decisión 14 de Sam, 2026-10-18) ──
-- A la pregunta «En la ficha del cliente del Studio, ¿quién puede ver cuánto
-- debe, cuánto tiene vencido y la fecha de su último pago?», Sam eligió «Todo el
-- que ve clientes (Recomendado)»: «También comercial, operaciones y soporte, para
-- cobrar a tiempo. El detalle de facturas y recibos sigue solo para finanzas».
--   · authenticated, con tenant y rol activos: admin o accounting, o la vista
--     efectiva del módulo `clients` según public.document_entity_authorized
--     ('client', tenant, 'view') de 0444 —roles, defaults, overrides por tenant y
--     membresía activa—, como reutiliza 0456. No hay una lista de roles propia.
--   · service_role (el job de Kommo), detectado por el principal de la
--     solicitud, (select auth.role()) = 'service_role', como 0311 y 0435. Lee el
--     tenant de cada ficha.
--   Cualquier otro caso: 42501 CLIENT_OUTSTANDING_FORBIDDEN. Más de 1000 ids:
--   22023 CLIENT_OUTSTANDING_TOO_MANY. No hay rama «conversaciones»: con los
--   defaults, conversaciones ⊂ clients (lib/studio/rbac.ts); quien solo tiene
--   Conversaciones sigue con la fachada de 0412, que esta migración no toca.
--
-- ── La regla ────────────────────────────────────────────────
--   · Facturas que cuentan: emitida, parcial, pagada y vencida, vivas
--     (deleted_at null). Borrador y anulada no son deuda. Es la definición
--     canónica de «facturas abiertas» de SDD-0559 y SDD-0557 (`vencida` se
--     incluye por defensa: hoy nadie la escribe).
--   · Abierto por factura = greatest(0, total − pagado): un sobrepago no
--     compensa otra factura (regla de 0412).
--   · Vencido = abierto > 0 y due_date < fecha de Caracas (`as_of`); sin
--     due_date nunca vence. La fecha viaja en la fila para que la app no
--     recalcule «hoy» en UTC.
--   · Códigos del cliente: su código vigente, su historial (0367) y el código e
--     historial de toda ficha cuya cadena merged_into_client_id llega a él
--     (0341; hasta 10 saltos, como resolve_markbox). merge_clients no mueve
--     facturas (0361), así que sin esto la deuda de una ficha fusionada se
--     perdía. La comparación con invoices.client_markbox es con upper(btrim())
--     en los dos lados, como resolve_markbox (0367:100, :108). Eso no usa el
--     índice (tenant_id, client_markbox) de 0077 para el código, solo para el
--     tenant; a esta escala es aceptable (INFERIDO, no medido).
--   · Último pago: la fecha más reciente entre los recibos vivos y los reportes
--     `confirmado` vivos de CUALQUIER factura viva del conjunto de códigos, en
--     cualquier estado, también la anulada con abono. Si una factura con
--     pagado > 0 no tiene ninguno, su last_payment_at (en fecha de Caracas)
--     sirve de respaldo. Solo la fecha, sin monto.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si falta una tabla, un tipo, un valor de enum o una
-- columna con su tipo; si auth.uid() o auth.role() no existen; si los cuerpos
-- que reutiliza no son los del árbol (md5 del prosrc con CRLF→LF, o sin
-- espacios donde ya se midió así), con su seguridad, volatilidad y search_path:
--   get_user_tenant_id()                       0453  5ff0c51c… / 4ce5acd0…
--   current_studio_role()                      0200  b7157932… / df8ba522…
--   document_entity_authorized(text,uuid,text) 0444  4eb9fd08…
--   document_entity_module_contract(text)      0444  9c78c98f…
-- (las dos primeras, leídas de producción el 2026-09-19 por 0470; las de 0444,
-- verificadas por el preflight de 0456 al aplicarse). El Director las relee en
-- producción antes de aplicar. Aborta también si la función ya existe. El
-- postflight exige DEFINER, STABLE, search_path vacío, owner postgres, la forma
-- del resultado y EXECUTE solo para authenticated y service_role.
--
-- ── Locks ───────────────────────────────────────────────────
-- Solo catálogo: crea una función, cambia su owner y su ACL. Ninguno sobre
-- tablas y ninguna fila tocada. lock_timeout 5 s y statement_timeout 30 s con
-- set de sesión, como 0467 y 0471.
--
-- ── Rollback ────────────────────────────────────────────────
-- drop function public.client_outstanding(uuid[]). Deja de ser seguro en cuanto
-- la PR esté desplegada: la ficha mostraría «No se pudo calcular el saldo»,
-- Conversaciones quedaría sin saldo y Kommo inerte. Se revierte antes el despliegue.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  if pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.client_markbox_history') is null
     or pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.payment_receipts') is null
     or pg_catalog.to_regclass('public.payment_reports') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regclass('public.studio_role_module_overrides') is null
     or pg_catalog.to_regtype('public.invoice_status') is null
     or pg_catalog.to_regtype('public.invoice_currency') is null
     or pg_catalog.to_regtype('public.payment_report_status') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0492 requiere clients, client_markbox_history, invoices, payment_receipts, payment_reports, user_tenants, studio_role_module_overrides, sus tipos y los roles API';
  end if;

  -- Columnas que la función lee, con su tipo.
  for v_expected in select * from (values
    ('public.clients', 'id', 'uuid'), ('public.clients', 'tenant_id', 'uuid'),
    ('public.clients', 'markbox', 'text'), ('public.clients', 'deleted_at', 'timestamptz'),
    ('public.clients', 'merged_into_client_id', 'uuid'),
    ('public.client_markbox_history', 'client_id', 'uuid'),
    ('public.client_markbox_history', 'tenant_id', 'uuid'),
    ('public.client_markbox_history', 'markbox', 'text'),
    ('public.invoices', 'id', 'uuid'), ('public.invoices', 'tenant_id', 'uuid'),
    ('public.invoices', 'client_markbox', 'text'),
    ('public.invoices', 'currency', 'public.invoice_currency'),
    ('public.invoices', 'total_amount', 'numeric'), ('public.invoices', 'paid_amount', 'numeric'),
    ('public.invoices', 'status', 'public.invoice_status'),
    ('public.invoices', 'due_date', 'date'),
    ('public.invoices', 'last_payment_at', 'timestamptz'),
    ('public.invoices', 'deleted_at', 'timestamptz'),
    ('public.payment_receipts', 'invoice_id', 'uuid'),
    ('public.payment_receipts', 'tenant_id', 'uuid'),
    ('public.payment_receipts', 'received_at', 'date'),
    ('public.payment_receipts', 'deleted_at', 'timestamptz'),
    ('public.payment_reports', 'invoice_id', 'uuid'),
    ('public.payment_reports', 'tenant_id', 'uuid'),
    ('public.payment_reports', 'status', 'public.payment_report_status'),
    ('public.payment_reports', 'paid_at', 'date'),
    ('public.payment_reports', 'deleted_at', 'timestamptz')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped
        and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0492: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;

  -- Los estados que la regla usa (0077 y 0195).
  for v_expected in select * from (values
    ('public.invoice_status', 'borrador'), ('public.invoice_status', 'emitida'),
    ('public.invoice_status', 'parcial'), ('public.invoice_status', 'pagada'),
    ('public.invoice_status', 'vencida'), ('public.invoice_status', 'anulada'),
    ('public.payment_report_status', 'confirmado')
  ) e(typ, label) loop
    if not exists (select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_expected.typ) and enumlabel = v_expected.label) then
      raise exception '0492: el tipo % no tiene el valor %', v_expected.typ, v_expected.label;
    end if;
  end loop;

  -- Dependencias que se invocan: firma, seguridad, volatilidad, search_path y
  -- cuerpo vigentes (md5 del prosrc con CRLF→LF, o sin espacios cuando hay
  -- huella normalizada). Otro cuerpo aborta sin cambiar nada.
  for v_expected in select * from (values
    ('public.get_user_tenant_id()', true, 's', 'search_path=""',
     '5ff0c51c26a49419c34abc78f1d95c37', '4ce5acd04a577f91ca77b74ebc622c49'),                -- 0453
    ('public.current_studio_role()', true, 's', 'search_path=public',
     'b7157932457d04df4e8cf7621d212965', 'df8ba5229960ba06888dec61fbec2bc5'),                -- 0200
    ('public.document_entity_authorized(text,uuid,text)', true, 's', 'search_path=""',
     '4eb9fd08721e8f754087dddc5cb88953', null),                                              -- 0444
    ('public.document_entity_module_contract(text)', false, 'i', 'search_path=""',
     '9c78c98fb29c311926f93a1c28ce1c32', null)                                               -- 0444
  ) e(signature, definer, volatility, config, body_md5, body_md5_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v_expected.signature)
      and p.prosecdef = v_expected.definer
      and p.provolatile::text = v_expected.volatility
      and p.proconfig = array[v_expected.config]::text[];
    if v_md5 is null then
      raise exception '0492: dependencia ausente o con otra firma, seguridad, volatilidad o search_path: %',
        v_expected.signature;
    end if;
    if v_md5 <> v_expected.body_md5
       and v_md5_normalized is distinct from v_expected.body_md5_normalized then
      raise exception '0492 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regprocedure('auth.role()') is null then
    raise exception '0492 requiere auth.uid() y auth.role()';
  end if;

  -- Una segunda aplicación aborta: la función no se reemplaza desde acá.
  if pg_catalog.to_regprocedure('public.client_outstanding(uuid[])') is not null then
    raise exception '0492 abortado: public.client_outstanding(uuid[]) ya existe';
  end if;
end;
$preflight$;

create function public.client_outstanding(p_client_ids uuid[])
returns table (
  client_id uuid,
  markboxes text[],
  currency text,
  open_amount numeric,
  overdue_amount numeric,
  open_invoices integer,
  overdue_invoices integer,
  oldest_overdue_due_date date,
  last_payment_on date,
  as_of date
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_tenant uuid;
  v_role text;
  v_as_of date := (pg_catalog.now() at time zone 'America/Caracas')::date;
begin
  if not v_service then
    v_tenant := public.get_user_tenant_id();
    v_role := public.current_studio_role();
    if v_tenant is null or v_role is null
       or not (v_role in ('admin', 'accounting')
               or public.document_entity_authorized('client', v_tenant, 'view')) then
      raise exception 'CLIENT_OUTSTANDING_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if p_client_ids is null or pg_catalog.cardinality(p_client_ids) = 0 then
    return;
  end if;
  if pg_catalog.cardinality(p_client_ids) > 1000 then
    raise exception 'CLIENT_OUTSTANDING_TOO_MANY' using errcode = '22023';
  end if;

  -- Todas las columnas van calificadas: los nombres del RETURNS TABLE son
  -- variables de plpgsql y una referencia suelta sería ambigua.
  return query
  with recursive asked as (
    select c.id as root_id, c.tenant_id as root_tenant,
           pg_catalog.upper(pg_catalog.btrim(c.markbox)) as root_key
    from public.clients as c
    where c.id = any (p_client_ids)
      and c.deleted_at is null
      and (v_service or c.tenant_id = v_tenant)
  ), family as (
    select a.root_id, a.root_tenant, a.root_id as member_id, 0 as depth
    from asked as a
    union all
    select f.root_id, f.root_tenant, m.id, f.depth + 1
    from family as f
    join public.clients as m
      on m.merged_into_client_id = f.member_id and m.tenant_id = f.root_tenant
    where f.depth < 10
  ), raw_codes as (
    select f.root_id, f.root_tenant, m.markbox as raw_code
    from family as f
    join public.clients as m on m.id = f.member_id
    union all
    select f.root_id, f.root_tenant, h.markbox
    from family as f
    join public.client_markbox_history as h
      on h.client_id = f.member_id and h.tenant_id = f.root_tenant
  ), code_keys as (
    select distinct on (x.root_id, x.code_key) x.root_id, x.root_tenant, x.code, x.code_key
    from (
      select r.root_id, r.root_tenant, pg_catalog.btrim(r.raw_code) as code,
             pg_catalog.upper(pg_catalog.btrim(r.raw_code)) as code_key
      from raw_codes as r
    ) as x
    where x.code_key <> ''
    order by x.root_id, x.code_key, x.code
  ), code_sets as (
    select k.root_id,
           pg_catalog.array_agg(k.code order by (k.code_key = a.root_key) desc, k.code_key) as code_list
    from code_keys as k
    join asked as a on a.root_id = k.root_id
    group by k.root_id
  ), inv as (
    select k.root_id, i.id as inv_id, i.tenant_id as inv_tenant, i.currency::text as cur,
           i.status in ('emitida', 'parcial', 'pagada', 'vencida') as counted,
           i.total_amount - coalesce(i.paid_amount, 0::numeric) as net,
           i.due_date as due,
           case when coalesce(i.paid_amount, 0::numeric) > 0 and i.last_payment_at is not null
                then (i.last_payment_at at time zone 'America/Caracas')::date end as fallback_on
    from code_keys as k
    join public.invoices as i
      on i.tenant_id = k.root_tenant
     and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = k.code_key
    where i.deleted_at is null
  ), paid_events as (
    select v.root_id, v.inv_id, r.received_at as paid_on
    from inv as v
    join public.payment_receipts as r
      on r.invoice_id = v.inv_id and r.tenant_id = v.inv_tenant
    where r.deleted_at is null
    union all
    select v.root_id, v.inv_id, p.paid_at
    from inv as v
    join public.payment_reports as p
      on p.invoice_id = v.inv_id and p.tenant_id = v.inv_tenant
    where p.status = 'confirmado' and p.deleted_at is null
  ), inv_full as (
    select v.root_id, v.cur, v.counted, v.due,
           case when v.counted then greatest(0::numeric, v.net) else 0::numeric end as open_part,
           coalesce((select pg_catalog.max(e.paid_on) from paid_events as e
                     where e.root_id = v.root_id and e.inv_id = v.inv_id),
                    v.fallback_on) as paid_on
    from inv as v
  ), per_currency as (
    select w.root_id, w.cur,
           pg_catalog.sum(w.open_part) as open_sum,
           pg_catalog.sum(w.open_part) filter (where w.open_part > 0 and w.due < v_as_of) as overdue_sum,
           pg_catalog.count(*) filter (where w.open_part > 0) as open_n,
           pg_catalog.count(*) filter (where w.open_part > 0 and w.due < v_as_of) as overdue_n,
           pg_catalog.min(w.due) filter (where w.open_part > 0 and w.due < v_as_of) as oldest_due,
           pg_catalog.max(w.paid_on) as last_paid
    from inv_full as w
    where w.counted or w.paid_on is not null
    group by w.root_id, w.cur
  )
  select a.root_id,
         coalesce(s.code_list, array[]::text[]),
         pc.cur,
         coalesce(pc.open_sum, 0::numeric)::numeric(14,2),
         coalesce(pc.overdue_sum, 0::numeric)::numeric(14,2),
         coalesce(pc.open_n, 0)::integer,
         coalesce(pc.overdue_n, 0)::integer,
         pc.oldest_due,
         pc.last_paid,
         v_as_of
  from asked as a
  left join code_sets as s on s.root_id = a.root_id
  left join per_currency as pc on pc.root_id = a.root_id
  order by a.root_id, pc.cur nulls first;
end;
$function$;

alter function public.client_outstanding(uuid[]) owner to postgres;
revoke all on function public.client_outstanding(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.client_outstanding(uuid[]) to authenticated, service_role;

comment on function public.client_outstanding(uuid[]) is
  'SDD-0558: saldo CxC por cliente y moneda, sin mezclar monedas: abierto, vencido (fecha de Caracas), conteos, vencimiento más antiguo, último pago y códigos del cliente (vigente, historial y fichas fusionadas). Solo agregados. admin, accounting o vista de clients (document_entity_authorized), más service_role.';

do $postflight$
begin
  if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.client_outstanding(uuid[])')
        and p.prosecdef and p.provolatile = 's' and p.proretset
        and p.proowner = 'postgres'::pg_catalog.regrole
        and p.proconfig = array['search_path=""']::text[]
        and pg_catalog.pg_get_function_result(p.oid) = 'TABLE(client_id uuid, markboxes text[], currency text, open_amount numeric, overdue_amount numeric, open_invoices integer, overdue_invoices integer, oldest_overdue_due_date date, last_payment_on date, as_of date)'
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE')) then
    raise exception '0492: postflight — client_outstanding sin DEFINER, STABLE, search_path, owner, forma o ACL esperados';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0492_client_outstanding.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0492_client_outstanding. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
