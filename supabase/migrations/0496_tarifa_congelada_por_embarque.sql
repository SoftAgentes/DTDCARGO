-- ─────────────────────────────────────────────────────────────────────────────
-- 0496 · SDD-0571 — Tarifa congelada por embarque: shipment_rate_snapshots.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0571. Es aditiva (una tabla, dos
--    disparadores y una RPC nuevos; no altera nada existente), así que la app
--    desplegada hoy no la nota.
--
-- ── El defecto (B12 del plan contable) ──────────────────────
-- El precio por CBM no quedaba guardado en el embarque, ni en la recepción, ni
-- en la orden de venta: solo en el estimado (si lo hubo), en el tarifario y en
-- las listas de precios. Al llegar la carga, nadie sabía a qué precio se
-- recibió.
--
-- ── La decisión 9 (tomada por recomendación el 2026-10-20) ──
-- La tarifa se congela al recibir en Yiwu, con el CBM medido allí (500 kg/m³
-- es la regla y 1.000 la excepción). Orden: estimado aceptado → lista del
-- cliente o aliado → tarifario. El mínimo se cobra.
--
-- ── Qué crea ────────────────────────────────────────────────
-- · public.shipment_rate_snapshots: una fila por congelación de una recepción
--   (warehouse_receipts_cn). Inmutable. Un cambio de precio es una fila nueva
--   con motivo, y la anterior queda marcada como reemplazada. Una sola viva por
--   recepción. shipment_id queda vacío: lo llena la 4.2 (envío por cliente).
-- · shipment_rate_snapshots_guard (BEFORE INSERT OR UPDATE OR DELETE, todos los
--   roles): el INSERT exige que la recepción, el cliente y las filas de origen
--   sean del mismo tenant; el UPDATE solo marca el reemplazo una vez o llena
--   shipment_id una vez; el DELETE pasa solo en cascada (la recepción o el
--   tenant ya no existen).
-- · shipment_rate_snapshots_supersede_check (CONSTRAINT TRIGGER diferido): al
--   confirmar, una fila reemplazada apunta a una fila de la misma recepción,
--   congelada después y viva.
-- · public.congelar_tarifa_recepcion(...) SECURITY DEFINER: deriva la tarifa y
--   el mínimo de la fila de origen (estimado aceptado o fila del tarifario,
--   clasificada lista/casa con la regla de resolveRateForClient), lee el CBM y
--   el peso de la recepción y congela. Una fila del tarifario tiene que estar
--   vigente (fecha de Caracas), ser del destino de la recepción (el mismo ILIKE
--   de findRateInBook) y, si es de la casa, la lista del cliente no puede tener
--   la suya para esa ruta. Con p_dry_run devuelve lo que congelaría sin escribir
--   ni bloquear. Nadie tiene TRUNCATE sobre la tabla.
--
-- ── Quién ───────────────────────────────────────────────────
--   · ver (p_dry_run): admin, operations, warehouse, support, accounting;
--   · congelar una recepción sin tarifa desde estimado o tarifario, con 500
--     kg/m³: admin, operations, warehouse, accounting;
--   · manual, excel_yiwu, 1.000 kg/m³ o reemplazar una tarifa viva: admin o
--     accounting, con motivo de 10 a 1000 caracteres.
--   Leer la tabla (RLS): mismo tenant y rol admin, operations, warehouse,
--   support, accounting o commercial. Nadie escribe por la API.
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si falta una tabla, una columna con su tipo o un
-- valor de enum; si auth.uid() no existe; si los cuerpos que reutiliza no son
-- los del árbol (md5 del prosrc con CRLF→LF, o sin espacios), con su seguridad,
-- volatilidad y search_path:
--   get_user_tenant_id()      0453  5ff0c51c… / 4ce5acd0…
--   current_studio_role()     0200  b7157932… / df8ba522…
--   resolve_price_book(uuid)  0382  c9610650… / f523c0f4…  (repo)
--                                   4f39f434… / 7004f04b…  (vivo)
-- Las tres las leyó el Director en producción el 2026-10-20, sin filas. La de
-- resolve_price_book tiene DERIVA: el cuerpo vivo es el de la 0382 SIN sus dos
-- líneas de comentario («-- Tope de seguridad…»); misma lógica, y su huella
-- sin comentarios da exactamente el md5 vivo. El preflight acepta los dos. Aborta también si la
-- tabla o la RPC ya existen. El postflight exige RLS, la policy, los grants de
-- la tabla, los disparadores, DEFINER y search_path vacío en las funciones y la
-- ACL de la RPC.
--
-- ── Locks ───────────────────────────────────────────────────
-- Las FK nuevas toman SHARE ROW EXCLUSIVE breve sobre tenants,
-- warehouse_receipts_cn, shipments, clients, rates, price_books y quotes. No
-- toca filas. lock_timeout 5 s y statement_timeout 30 s.
--
-- ── Rollback ────────────────────────────────────────────────
-- drop function public.congelar_tarifa_recepcion(...); drop table
-- public.shipment_rate_snapshots (arrastra sus disparadores); drop function de
-- las dos funciones de disparador. Deja de ser seguro en cuanto haya tarifas
-- congeladas que alguien vaya a facturar o la PR esté desplegada.
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_expected record;
  v_md5 text;
  v_md5_normalized text;
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regclass('public.warehouse_receipts_cn') is null
     or pg_catalog.to_regclass('public.shipments') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regclass('public.rates') is null
     or pg_catalog.to_regclass('public.price_books') is null
     or pg_catalog.to_regclass('public.quotes') is null
     or pg_catalog.to_regtype('public.shipment_service') is null
     or pg_catalog.to_regtype('public.quote_status') is null
     or pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0496 requiere tenants, user_tenants, warehouse_receipts_cn, shipments, clients, rates, price_books, quotes, sus tipos y los roles API';
  end if;

  for v_expected in select * from (values
    ('public.warehouse_receipts_cn', 'id', 'uuid'), ('public.warehouse_receipts_cn', 'tenant_id', 'uuid'),
    ('public.warehouse_receipts_cn', 'client_markbox', 'text'),
    ('public.warehouse_receipts_cn', 'is_orphan', 'boolean'),
    ('public.warehouse_receipts_cn', 'total_cbm', 'numeric'),
    ('public.warehouse_receipts_cn', 'total_weight_kg', 'numeric'),
    ('public.warehouse_receipts_cn', 'destination_city', 'text'),
    ('public.warehouse_receipts_cn', 'deleted_at', 'timestamptz'),
    ('public.clients', 'id', 'uuid'), ('public.clients', 'tenant_id', 'uuid'),
    ('public.clients', 'markbox', 'text'), ('public.clients', 'deleted_at', 'timestamptz'),
    ('public.shipments', 'id', 'uuid'), ('public.shipments', 'tenant_id', 'uuid'),
    ('public.rates', 'id', 'uuid'), ('public.rates', 'tenant_id', 'uuid'),
    ('public.rates', 'service', 'public.shipment_service'),
    ('public.rates', 'per_cbm', 'numeric'), ('public.rates', 'min_charge', 'numeric'),
    ('public.rates', 'destination', 'text'), ('public.rates', 'valid_until', 'date'),
    ('public.rates', 'price_book_id', 'uuid'), ('public.rates', 'deleted_at', 'timestamptz'),
    ('public.price_books', 'id', 'uuid'), ('public.price_books', 'tenant_id', 'uuid'),
    ('public.price_books', 'is_house', 'boolean'),
    ('public.price_books', 'discount_pct', 'numeric'),
    ('public.price_books', 'base_per_cbm', 'numeric'),
    ('public.price_books', 'deleted_at', 'timestamptz'),
    ('public.quotes', 'id', 'uuid'), ('public.quotes', 'tenant_id', 'uuid'),
    ('public.quotes', 'client_markbox', 'text'),
    ('public.quotes', 'service', 'public.shipment_service'),
    ('public.quotes', 'rate_per_cbm', 'numeric'), ('public.quotes', 'rate_used_id', 'uuid'),
    ('public.quotes', 'status', 'public.quote_status'),
    ('public.quotes', 'deleted_at', 'timestamptz')
  ) e(rel, col, typ) loop
    if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(v_expected.rel) and a.attname = v_expected.col
        and not a.attisdropped
        and a.atttypid = pg_catalog.to_regtype(v_expected.typ)) then
      raise exception '0496: columna ausente o con otro tipo: %.%', v_expected.rel, v_expected.col;
    end if;
  end loop;

  for v_expected in select * from (values
    ('public.quote_status', 'accepted'),
    ('public.shipment_service', 'puerta_a_puerta_DDP')
  ) e(typ, label) loop
    if not exists (select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_expected.typ) and enumlabel = v_expected.label) then
      raise exception '0496: el tipo % no tiene el valor %', v_expected.typ, v_expected.label;
    end if;
  end loop;

  for v_expected in select * from (values
    ('public.get_user_tenant_id()', true, 's', 'search_path=""',
     '5ff0c51c26a49419c34abc78f1d95c37', '4ce5acd04a577f91ca77b74ebc622c49'),                -- 0453
    ('public.current_studio_role()', true, 's', 'search_path=public',
     'b7157932457d04df4e8cf7621d212965', 'df8ba5229960ba06888dec61fbec2bc5'),                -- 0200
    ('public.resolve_price_book(uuid)', false, 's', 'search_path=public',
     'c96106507ccf212509c3505c37a53db1', 'f523c0f4d09179dfa2c3a247ef846de5')                 -- 0382 (repo)
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
      raise exception '0496: dependencia ausente o con otra firma, seguridad, volatilidad o search_path: %',
        v_expected.signature;
    end if;
    if v_md5 <> v_expected.body_md5
       and v_md5_normalized is distinct from v_expected.body_md5_normalized
       -- El cuerpo vivo de producción (2026-10-20): el de la 0382 sin comentarios.
       and not (v_expected.signature = 'public.resolve_price_book(uuid)'
                and (v_md5 = '4f39f4349889a6e5a00bb5d85617751c'
                     or v_md5_normalized = '7004f04b5c3815441a63a99ffab49b4c')) then
      raise exception '0496 abortado: % tiene otro cuerpo (md5 %, sin espacios %); revisar antes de aplicar',
        v_expected.signature, v_md5, v_md5_normalized;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0496 requiere auth.uid()';
  end if;

  if pg_catalog.to_regclass('public.shipment_rate_snapshots') is not null
     or exists (select 1 from pg_catalog.pg_proc p
                join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'congelar_tarifa_recepcion') then
    raise exception '0496 abortado: shipment_rate_snapshots o congelar_tarifa_recepcion ya existen';
  end if;
end;
$preflight$;

-- ─── 1. La tabla ─────────────────────────────────────────────────────────────

create table public.shipment_rate_snapshots (
  id                  uuid primary key default pg_catalog.gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  receipt_id          uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  shipment_id         uuid references public.shipments(id),
  client_id           uuid not null references public.clients(id),
  client_markbox      text not null,
  service             public.shipment_service not null,
  destination         text,
  source              text not null,
  rate_origin         text,
  rate_id             uuid references public.rates(id),
  price_book_id       uuid references public.price_books(id),
  quote_id            uuid references public.quotes(id),
  discount_pct        numeric(5,2),
  per_cbm             numeric(12,2) not null,
  min_charge          numeric(12,2) not null default 0,
  cbm                 numeric(12,3) not null,
  weight_kg           numeric(12,2),
  included_kg_per_cbm integer not null default 500,
  amount_to_invoice   numeric(14,2) generated always as
                        (greatest(round(cbm * per_cbm, 2), min_charge)) stored,
  excess_weight_kg    numeric(14,2) generated always as
                        (greatest(coalesce(weight_kg, 0) - round(cbm * included_kg_per_cbm, 2), 0)) stored,
  reason              text,
  frozen_at           timestamptz not null default now(),
  frozen_by           uuid,
  superseded_at       timestamptz,
  superseded_by_id    uuid references public.shipment_rate_snapshots(id)
                        deferrable initially deferred,

  constraint shipment_rate_snapshots_source_valida
    check (source in ('estimado', 'lista', 'casa', 'manual', 'excel_yiwu')),
  constraint shipment_rate_snapshots_origen_solo_lista
    check ((source = 'lista') = (rate_origin is not null)
           and (rate_origin is null or rate_origin in ('propia', 'pactada', 'descuento'))),
  constraint shipment_rate_snapshots_descuento_coherente
    check ((rate_origin = 'descuento') = (discount_pct is not null)
           and (discount_pct is null or (discount_pct > 0 and discount_pct < 100))),
  constraint shipment_rate_snapshots_estimado_con_estimado
    check (source <> 'estimado' or quote_id is not null),
  constraint shipment_rate_snapshots_tarifario_con_fila
    check (source not in ('lista', 'casa') or (rate_id is not null and quote_id is null)),
  constraint shipment_rate_snapshots_a_mano_con_motivo
    check (source not in ('manual', 'excel_yiwu')
           or (reason is not null and rate_id is null and quote_id is null)),
  constraint shipment_rate_snapshots_montos
    check (per_cbm > 0 and min_charge >= 0 and cbm > 0 and (weight_kg is null or weight_kg >= 0)),
  constraint shipment_rate_snapshots_peso_incluido
    check (included_kg_per_cbm in (500, 1000)),
  constraint shipment_rate_snapshots_excepcion_con_motivo
    check (included_kg_per_cbm = 500 or reason is not null),
  constraint shipment_rate_snapshots_motivo_largo
    check (reason is null or pg_catalog.char_length(reason) between 10 and 1000),
  constraint shipment_rate_snapshots_markbox_no_vacio
    check (pg_catalog.btrim(client_markbox) <> ''),
  constraint shipment_rate_snapshots_reemplazo_completo
    check ((superseded_at is null) = (superseded_by_id is null)),
  constraint shipment_rate_snapshots_no_se_reemplaza_a_si_misma
    check (superseded_by_id is null or superseded_by_id <> id)
);

create unique index shipment_rate_snapshots_una_viva_por_recepcion
  on public.shipment_rate_snapshots (receipt_id)
  where superseded_at is null;
create index shipment_rate_snapshots_tenant_recepcion_idx
  on public.shipment_rate_snapshots (tenant_id, receipt_id);
create index shipment_rate_snapshots_shipment_idx
  on public.shipment_rate_snapshots (shipment_id)
  where shipment_id is not null;

comment on table public.shipment_rate_snapshots is
  'SDD-0571 (4.1 del plan contable, decisión 9): la tarifa por CBM congelada al recibir en Yiwu, por recepción. '
  'Inmutable: un cambio es una fila nueva con motivo y la anterior queda reemplazada. Se escribe solo con '
  'congelar_tarifa_recepcion. shipment_id lo llena la 4.2.';

alter table public.shipment_rate_snapshots enable row level security;
revoke all on table public.shipment_rate_snapshots from public, anon, authenticated;
grant select on table public.shipment_rate_snapshots to authenticated;
grant select, insert, update, delete on table public.shipment_rate_snapshots to service_role;
-- TRUNCATE no pasa por los disparadores de fila: nadie lo tiene (revisión de seguridad, punto 5).
revoke truncate on table public.shipment_rate_snapshots from public, anon, authenticated, service_role;

create policy shipment_rate_snapshots_select
  on public.shipment_rate_snapshots for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role())
        in ('admin', 'operations', 'warehouse', 'support', 'accounting', 'commercial')
  );

-- ─── 2. El guardián ──────────────────────────────────────────────────────────

create function public.shipment_rate_snapshots_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_fixed_old jsonb;
  v_fixed_new jsonb;
begin
  if tg_op = 'DELETE' then
    -- Solo el borrado en cascada: la recepción o el tenant ya no existen.
    if exists (select 1 from public.warehouse_receipts_cn r where r.id = old.receipt_id)
       and exists (select 1 from public.tenants t where t.id = old.tenant_id) then
      raise exception 'TARIFA_INMUTABLE: una tarifa congelada no se borra'
        using errcode = '42501', hint = 'dtd-tarifa';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not exists (select 1 from public.warehouse_receipts_cn r
                   where r.id = new.receipt_id and r.tenant_id = new.tenant_id)
       or not exists (select 1 from public.clients c
                      where c.id = new.client_id and c.tenant_id = new.tenant_id)
       or (new.shipment_id is not null and not exists (
             select 1 from public.shipments s where s.id = new.shipment_id and s.tenant_id = new.tenant_id))
       or (new.rate_id is not null and not exists (
             select 1 from public.rates x where x.id = new.rate_id and x.tenant_id = new.tenant_id))
       or (new.price_book_id is not null and not exists (
             select 1 from public.price_books b where b.id = new.price_book_id and b.tenant_id = new.tenant_id))
       or (new.quote_id is not null and not exists (
             select 1 from public.quotes q where q.id = new.quote_id and q.tenant_id = new.tenant_id)) then
      raise exception 'TARIFA_OTRO_TENANT: la recepción, el cliente o la fila de origen no son de este tenant'
        using errcode = '42501', hint = 'dtd-tarifa';
    end if;
    if new.superseded_at is not null then
      raise exception 'TARIFA_NACE_REEMPLAZADA: una tarifa nueva nace viva'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    return new;
  end if;

  -- UPDATE: todo queda fijo salvo el reemplazo y el envío, una sola vez cada uno.
  -- Las columnas generadas no entran: en un BEFORE todavía no están calculadas
  -- en NEW, y salen de columnas que sí se comparan.
  v_fixed_old := pg_catalog.to_jsonb(old) - 'superseded_at' - 'superseded_by_id' - 'shipment_id'
                 - 'amount_to_invoice' - 'excess_weight_kg';
  v_fixed_new := pg_catalog.to_jsonb(new) - 'superseded_at' - 'superseded_by_id' - 'shipment_id'
                 - 'amount_to_invoice' - 'excess_weight_kg';
  if v_fixed_new is distinct from v_fixed_old then
    raise exception 'TARIFA_INMUTABLE: una tarifa congelada no se edita; reemplázala con motivo'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  if old.superseded_at is not null
     and (new.superseded_at is distinct from old.superseded_at
          or new.superseded_by_id is distinct from old.superseded_by_id) then
    raise exception 'TARIFA_INMUTABLE: el reemplazo de una tarifa no se cambia'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  if old.shipment_id is not null and new.shipment_id is distinct from old.shipment_id then
    raise exception 'TARIFA_INMUTABLE: el envío de una tarifa congelada no se cambia'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  if old.shipment_id is null and new.shipment_id is not null and not exists (
       select 1 from public.shipments s where s.id = new.shipment_id and s.tenant_id = new.tenant_id) then
    raise exception 'TARIFA_OTRO_TENANT: el envío no es de este tenant'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  return new;
end;
$function$;

alter function public.shipment_rate_snapshots_guard() owner to postgres;
revoke all on function public.shipment_rate_snapshots_guard() from public, anon, authenticated, service_role;

create trigger shipment_rate_snapshots_guard
  before insert or update or delete on public.shipment_rate_snapshots
  for each row execute function public.shipment_rate_snapshots_guard();

-- Al confirmar: la reemplazada apunta a una fila viva de la misma recepción,
-- congelada después que ella.
create function public.shipment_rate_snapshots_supersede_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.superseded_by_id is null then
    return null;
  end if;
  if not exists (
    select 1 from public.shipment_rate_snapshots n
    where n.id = new.superseded_by_id
      and n.receipt_id = new.receipt_id
      and n.tenant_id = new.tenant_id
      and n.superseded_at is null
      and n.frozen_at >= new.frozen_at
  ) then
    raise exception 'TARIFA_REEMPLAZO_INVALIDO: la tarifa que reemplaza no es una tarifa viva de la misma recepción'
      using errcode = '23514', hint = 'dtd-tarifa';
  end if;
  return null;
end;
$function$;

alter function public.shipment_rate_snapshots_supersede_check() owner to postgres;
revoke all on function public.shipment_rate_snapshots_supersede_check() from public, anon, authenticated, service_role;

create constraint trigger shipment_rate_snapshots_supersede_check
  after insert or update on public.shipment_rate_snapshots
  deferrable initially deferred
  for each row execute function public.shipment_rate_snapshots_supersede_check();

-- ─── 3. La RPC ───────────────────────────────────────────────────────────────

create function public.congelar_tarifa_recepcion(
  p_receipt_id uuid,
  p_source text,
  p_rate_id uuid default null,
  p_quote_id uuid default null,
  p_per_cbm numeric default null,
  p_min_charge numeric default null,
  p_service public.shipment_service default 'puerta_a_puerta_DDP',
  p_included_kg_per_cbm integer default 500,
  p_reason text default null,
  p_dry_run boolean default false
)
returns setof public.shipment_rate_snapshots
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_role text := public.current_studio_role();
  v_receipt record;
  v_client_id uuid;
  v_clients integer;
  v_live uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_elevated boolean;
  v_source text;
  v_origin text;
  v_service public.shipment_service;
  v_per numeric;
  v_min numeric;
  v_pct numeric;
  v_rate_id uuid;
  v_book_id uuid;
  v_quote_id uuid;
  v_rate record;
  v_quote record;
  v_client_book uuid;
  v_house uuid;
  v_book_base numeric;
  v_book_pct numeric;
  v_new_id uuid;
  v_row public.shipment_rate_snapshots;
  v_today date := (pg_catalog.now() at time zone 'America/Caracas')::date;
begin
  if v_tenant is null or v_role is null
     or v_role not in ('admin', 'operations', 'warehouse', 'support', 'accounting') then
    raise exception 'TARIFA_SIN_PERMISO: tu rol no puede ver ni congelar tarifas'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;

  if p_source is null or p_source not in ('estimado', 'tarifario', 'manual', 'excel_yiwu') then
    raise exception 'TARIFA_FUENTE_INVALIDA: la fuente es estimado, tarifario, manual o excel_yiwu'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;
  if p_included_kg_per_cbm is null or p_included_kg_per_cbm not in (500, 1000) then
    raise exception 'TARIFA_PESO_INVALIDO: el peso incluido es 500 o 1000 kg/m³'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;
  if v_reason is not null and pg_catalog.char_length(v_reason) not between 10 and 1000 then
    raise exception 'TARIFA_MOTIVO_INVALIDO: el motivo lleva de 10 a 1000 caracteres'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;

  -- La recepción, bloqueada al congelar: dos congelaciones a la vez se ordenan
  -- aquí. La vista previa no bloquea (revisión de seguridad, punto 6).
  if coalesce(p_dry_run, false) then
    select r.id, r.client_markbox, r.is_orphan, r.total_cbm, r.total_weight_kg, r.destination_city
      into v_receipt
    from public.warehouse_receipts_cn r
    where r.id = p_receipt_id and r.tenant_id = v_tenant and r.deleted_at is null;
  else
    select r.id, r.client_markbox, r.is_orphan, r.total_cbm, r.total_weight_kg, r.destination_city
      into v_receipt
    from public.warehouse_receipts_cn r
    where r.id = p_receipt_id and r.tenant_id = v_tenant and r.deleted_at is null
    for update;
  end if;
  if not found then
    raise exception 'TARIFA_RECEPCION_NO_ENCONTRADA: la recepción no existe o fue eliminada'
      using errcode = 'P0002', hint = 'dtd-tarifa';
  end if;
  if v_receipt.is_orphan then
    raise exception 'TARIFA_RECEPCION_HUERFANA: una recepción huérfana no tiene cliente al que cobrarle'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;
  if v_receipt.total_cbm is null or v_receipt.total_cbm <= 0 then
    raise exception 'TARIFA_RECEPCION_SIN_CBM: falta el CBM medido de la recepción'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;

  select pg_catalog.count(*), (pg_catalog.array_agg(c.id))[1]
    into v_clients, v_client_id
  from public.clients c
  where c.tenant_id = v_tenant and c.deleted_at is null
    and pg_catalog.upper(pg_catalog.btrim(c.markbox))
        = pg_catalog.upper(pg_catalog.btrim(coalesce(v_receipt.client_markbox, '')));
  if v_clients <> 1 then
    raise exception 'TARIFA_RECEPCION_SIN_CLIENTE: el Shipping Mark de la recepción no corresponde a un cliente'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;

  -- Los números salen de la fila de origen, no de quien llama.
  if p_source = 'estimado' then
    select q.id, q.client_markbox, q.service, q.rate_per_cbm, q.rate_used_id, q.status
      into v_quote
    from public.quotes q
    where q.id = p_quote_id and q.tenant_id = v_tenant and q.deleted_at is null;
    if not found then
      raise exception 'TARIFA_ESTIMADO_NO_ENCONTRADO: el estimado no existe'
        using errcode = 'P0002', hint = 'dtd-tarifa';
    end if;
    if v_quote.status <> 'accepted' then
      raise exception 'TARIFA_ESTIMADO_NO_ACEPTADO: solo cuenta un estimado aceptado'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if pg_catalog.upper(pg_catalog.btrim(coalesce(v_quote.client_markbox, '')))
       <> pg_catalog.upper(pg_catalog.btrim(v_receipt.client_markbox)) then
      raise exception 'TARIFA_ESTIMADO_OTRO_CLIENTE: el estimado es de otro cliente'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if v_quote.rate_per_cbm is null or v_quote.rate_per_cbm <= 0 then
      raise exception 'TARIFA_ESTIMADO_SIN_CBM: el estimado no tiene precio por CBM'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    v_source := 'estimado';
    v_quote_id := v_quote.id;
    v_service := v_quote.service;
    v_per := v_quote.rate_per_cbm;
    select x.id, coalesce(x.min_charge, 0) into v_rate_id, v_min
    from public.rates x
    where x.id = v_quote.rate_used_id and x.tenant_id = v_tenant;
    v_min := coalesce(v_min, 0);

  elsif p_source = 'tarifario' then
    if p_service is null then
      raise exception 'TARIFA_SERVICIO_REQUERIDO: elige el servicio'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    select x.id, x.service, x.per_cbm, coalesce(x.min_charge, 0) as min_charge, x.price_book_id,
           x.destination, x.valid_until
      into v_rate
    from public.rates x
    where x.id = p_rate_id and x.tenant_id = v_tenant and x.deleted_at is null;
    if not found then
      raise exception 'TARIFA_FILA_NO_ENCONTRADA: la tarifa no existe o fue eliminada'
        using errcode = 'P0002', hint = 'dtd-tarifa';
    end if;
    if v_rate.per_cbm is null or v_rate.per_cbm <= 0 then
      raise exception 'TARIFA_FILA_SIN_CBM: esa tarifa no cobra por CBM'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if v_rate.service <> p_service then
      raise exception 'TARIFA_FILA_OTRO_SERVICIO: esa tarifa es de otro servicio'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    -- Lo mismo que filtra findRateInBook (price-book-queries.ts:175): vigente
    -- (aquí con la fecha de Caracas) y con el destino de la recepción por el
    -- mismo ILIKE tolerante (revisión de seguridad, punto 2a y 2c).
    if v_rate.valid_until is not null and v_rate.valid_until < v_today then
      raise exception 'TARIFA_FILA_VENCIDA: esa tarifa ya venció'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if pg_catalog.btrim(coalesce(v_receipt.destination_city, '')) = '' then
      raise exception 'TARIFA_RECEPCION_SIN_DESTINO: falta la ciudad destino de la recepción'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if v_rate.destination not ilike '%' || pg_catalog.btrim(v_receipt.destination_city) || '%' then
      raise exception 'TARIFA_FILA_OTRO_DESTINO: esa tarifa es de otro destino'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;

    select b.id into v_house
    from public.price_books b
    where b.tenant_id = v_tenant and b.is_house and b.deleted_at is null
    limit 1;
    v_client_book := public.resolve_price_book(v_client_id);
    if v_client_book is not null then
      select b.discount_pct, b.base_per_cbm into v_book_pct, v_book_base
      from public.price_books b
      where b.id = v_client_book and b.tenant_id = v_tenant and b.deleted_at is null;
      if not found then
        v_client_book := null;
      end if;
    end if;

    v_service := p_service;
    v_rate_id := v_rate.id;
    v_min := v_rate.min_charge;
    -- La regla de resolveRateForClient (lib/studio/price-books/price-book-queries.ts:219),
    -- dada la fila elegida: propia → pactada → descuento → casa. El mínimo es
    -- siempre el de la fila (en pactada y descuento, el de la casa: no se descuenta).
    if v_client_book is not null and v_client_book is distinct from v_house
       and v_rate.price_book_id = v_client_book then
      v_source := 'lista'; v_origin := 'propia';
      v_per := v_rate.per_cbm; v_book_id := v_client_book;
    elsif v_house is not null and v_rate.price_book_id = v_house then
      -- El orden de la decisión 9: si la lista del cliente tiene su propia fila
      -- viva, vigente, del servicio y del destino, manda esa; la de la casa no
      -- se acepta (revisión de seguridad, punto 2b).
      if v_client_book is not null and v_client_book is distinct from v_house
         and exists (
           select 1 from public.rates o
           where o.tenant_id = v_tenant and o.price_book_id = v_client_book
             and o.deleted_at is null and o.service = p_service
             and (o.valid_until is null or o.valid_until >= v_today)
             and o.destination ilike '%' || pg_catalog.btrim(v_receipt.destination_city) || '%') then
        raise exception 'TARIFA_FILA_NO_APLICA: la lista del cliente tiene su propia tarifa para esta ruta'
          using errcode = '22023', hint = 'dtd-tarifa';
      end if;
      if v_client_book is not null and v_client_book is distinct from v_house
         and v_book_base is not null and v_book_base > 0 then
        v_source := 'lista'; v_origin := 'pactada';
        v_per := v_book_base; v_book_id := v_client_book;
      elsif v_client_book is not null and v_client_book is distinct from v_house
            and v_book_pct is not null then
        v_source := 'lista'; v_origin := 'descuento';
        v_pct := v_book_pct;
        v_per := pg_catalog.round(v_rate.per_cbm * (1 - v_pct / 100), 2);
        v_book_id := v_client_book;
      else
        v_source := 'casa';
        v_per := v_rate.per_cbm; v_book_id := v_house;
      end if;
    else
      raise exception 'TARIFA_FILA_OTRA_LISTA: esa tarifa no es de la lista del cliente ni de la casa'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;

  else
    if p_service is null then
      raise exception 'TARIFA_SERVICIO_REQUERIDO: elige el servicio'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    if p_per_cbm is null or p_per_cbm <= 0 or (p_min_charge is not null and p_min_charge < 0) then
      raise exception 'TARIFA_MONTO_INVALIDO: la tarifa es mayor que 0 y el mínimo no es negativo'
        using errcode = '22023', hint = 'dtd-tarifa';
    end if;
    v_source := p_source;
    v_service := p_service;
    v_per := pg_catalog.round(p_per_cbm, 2);
    v_min := pg_catalog.round(coalesce(p_min_charge, 0), 2);
  end if;

  if v_per is null or v_per <= 0 then
    raise exception 'TARIFA_MONTO_INVALIDO: la tarifa es mayor que 0'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;

  if coalesce(p_dry_run, false) then
    select s.id into v_live
    from public.shipment_rate_snapshots s
    where s.receipt_id = p_receipt_id and s.superseded_at is null;
  else
    select s.id into v_live
    from public.shipment_rate_snapshots s
    where s.receipt_id = p_receipt_id and s.superseded_at is null
    for update;
  end if;

  v_row.id := null;
  v_row.tenant_id := v_tenant;
  v_row.receipt_id := p_receipt_id;
  v_row.client_id := v_client_id;
  v_row.client_markbox := pg_catalog.btrim(v_receipt.client_markbox);
  v_row.service := v_service;
  v_row.destination := v_receipt.destination_city;
  v_row.source := v_source;
  v_row.rate_origin := v_origin;
  v_row.rate_id := v_rate_id;
  v_row.price_book_id := v_book_id;
  v_row.quote_id := v_quote_id;
  v_row.discount_pct := v_pct;
  v_row.per_cbm := v_per;
  v_row.min_charge := v_min;
  v_row.cbm := v_receipt.total_cbm;
  v_row.weight_kg := v_receipt.total_weight_kg;
  v_row.included_kg_per_cbm := p_included_kg_per_cbm;
  v_row.reason := v_reason;

  if coalesce(p_dry_run, false) then
    -- Lo mismo que calculan las columnas generadas.
    v_row.amount_to_invoice := greatest(pg_catalog.round(v_row.cbm * v_row.per_cbm, 2), v_row.min_charge);
    v_row.excess_weight_kg := greatest(coalesce(v_row.weight_kg, 0)
                                       - pg_catalog.round(v_row.cbm * v_row.included_kg_per_cbm, 2), 0);
    v_row.superseded_by_id := v_live;   -- en la vista previa: la tarifa viva que reemplazaría
    return next v_row;
    return;
  end if;

  v_elevated := v_source in ('manual', 'excel_yiwu') or p_included_kg_per_cbm = 1000 or v_live is not null;
  if v_elevated and v_role not in ('admin', 'accounting') then
    raise exception 'TARIFA_SIN_PERMISO: fijar a mano, usar 1.000 kg/m³ o cambiar una tarifa congelada lo hace admin o contabilidad'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  if not v_elevated and v_role not in ('admin', 'operations', 'warehouse', 'accounting') then
    raise exception 'TARIFA_SIN_PERMISO: tu rol no congela tarifas'
      using errcode = '42501', hint = 'dtd-tarifa';
  end if;
  if v_live is not null and v_reason is null then
    raise exception 'TARIFA_YA_CONGELADA: la recepción ya tiene tarifa; para cambiarla escribe el motivo'
      using errcode = '23505', hint = 'dtd-tarifa';
  end if;
  if v_elevated and v_reason is null then
    raise exception 'TARIFA_MOTIVO_REQUERIDO: escribe el motivo (de 10 a 1000 caracteres)'
      using errcode = '22023', hint = 'dtd-tarifa';
  end if;

  v_new_id := pg_catalog.gen_random_uuid();
  if v_live is not null then
    update public.shipment_rate_snapshots
       set superseded_at = pg_catalog.now(), superseded_by_id = v_new_id
     where id = v_live;
  end if;

  insert into public.shipment_rate_snapshots (
    id, tenant_id, receipt_id, client_id, client_markbox, service, destination,
    source, rate_origin, rate_id, price_book_id, quote_id, discount_pct,
    per_cbm, min_charge, cbm, weight_kg, included_kg_per_cbm, reason, frozen_by
  ) values (
    v_new_id, v_row.tenant_id, v_row.receipt_id, v_row.client_id, v_row.client_markbox,
    v_row.service, v_row.destination, v_row.source, v_row.rate_origin, v_row.rate_id,
    v_row.price_book_id, v_row.quote_id, v_row.discount_pct, v_row.per_cbm, v_row.min_charge,
    v_row.cbm, v_row.weight_kg, v_row.included_kg_per_cbm, v_row.reason, (select auth.uid())
  )
  returning * into v_row;

  return next v_row;
  return;
end;
$function$;

alter function public.congelar_tarifa_recepcion(uuid, text, uuid, uuid, numeric, numeric, public.shipment_service, integer, text, boolean)
  owner to postgres;
revoke all on function public.congelar_tarifa_recepcion(uuid, text, uuid, uuid, numeric, numeric, public.shipment_service, integer, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.congelar_tarifa_recepcion(uuid, text, uuid, uuid, numeric, numeric, public.shipment_service, integer, text, boolean)
  to authenticated;

comment on function public.congelar_tarifa_recepcion(uuid, text, uuid, uuid, numeric, numeric, public.shipment_service, integer, text, boolean) is
  'SDD-0571: congela la tarifa por CBM de una recepción en Yiwu. Deriva tarifa y mínimo de la fila de origen '
  '(estimado aceptado del mismo cliente, o fila del tarifario clasificada lista propia/pactada/descuento o casa '
  'con la regla de resolveRateForClient); manual y excel_yiwu, con motivo. Lee CBM y peso de la recepción. '
  'Reemplazar una tarifa viva exige motivo y admin o accounting. p_dry_run devuelve lo que congelaría.';

-- ─── 4. Postflight ───────────────────────────────────────────────────────────

do $postflight$
declare
  v_rpc oid := pg_catalog.to_regprocedure(
    'public.congelar_tarifa_recepcion(uuid,text,uuid,uuid,numeric,numeric,public.shipment_service,integer,text,boolean)');
begin
  if not exists (select 1 from pg_catalog.pg_class c
                 where c.oid = 'public.shipment_rate_snapshots'::pg_catalog.regclass and c.relrowsecurity) then
    raise exception '0496: postflight — shipment_rate_snapshots sin RLS';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'shipment_rate_snapshots') <> 1
     or not exists (select 1 from pg_catalog.pg_policies
                    where schemaname = 'public' and tablename = 'shipment_rate_snapshots'
                      and policyname = 'shipment_rate_snapshots_select' and cmd = 'SELECT'
                      and roles = array['authenticated']::name[]) then
    raise exception '0496: postflight — la única policy debe ser shipment_rate_snapshots_select (SELECT, authenticated)';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'DELETE')
     or pg_catalog.has_table_privilege('anon', 'public.shipment_rate_snapshots', 'SELECT')
     or pg_catalog.has_table_privilege('service_role', 'public.shipment_rate_snapshots', 'TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.shipment_rate_snapshots', 'TRUNCATE') then
    raise exception '0496: postflight — grants de shipment_rate_snapshots distintos de lo prometido';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger t
      where t.tgrelid = 'public.shipment_rate_snapshots'::pg_catalog.regclass and not t.tgisinternal
        and t.tgname in ('shipment_rate_snapshots_guard', 'shipment_rate_snapshots_supersede_check')) <> 2 then
    raise exception '0496: postflight — faltan los disparadores de shipment_rate_snapshots';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
             where p.oid in (pg_catalog.to_regprocedure('public.shipment_rate_snapshots_guard()'),
                             pg_catalog.to_regprocedure('public.shipment_rate_snapshots_supersede_check()'),
                             v_rpc)
               and (not p.prosecdef or p.proconfig is distinct from array['search_path=""']::text[]
                    or p.proowner <> 'postgres'::pg_catalog.regrole))
     or v_rpc is null then
    raise exception '0496: postflight — funciones sin DEFINER, search_path vacío u owner postgres';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_rpc, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_rpc, 'EXECUTE')
     or exists (select 1 from pg_catalog.aclexplode((select p.proacl from pg_catalog.pg_proc p where p.oid = v_rpc)) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.shipment_rate_snapshots_guard()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.shipment_rate_snapshots_supersede_check()', 'EXECUTE') then
    raise exception '0496: postflight — ACL de las funciones distinta de lo prometido';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0496_tarifa_congelada_por_embarque.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0496_tarifa_congelada_por_embarque. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
