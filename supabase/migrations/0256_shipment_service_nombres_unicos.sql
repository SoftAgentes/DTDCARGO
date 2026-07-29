-- ─────────────────────────────────────────────────────────────
-- 0256 · Un nombre por servicio: renombra el enum shipment_service
--        consolidacion → consolidado_lcl
--        reserva_FCL   → fcl_directo
--        + valor NUEVO fcl_bodega
--
-- SDD-0164 (docs/specs/0164-unificacion-nombres-servicios/spec.md).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK del founder NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- ⚠️ ORDEN OBLIGATORIO: la 0255 va PRIMERO. La 0255 inserta la fila del
--    consolidado con el literal `'consolidacion'::shipment_service`; si esta
--    migración corre antes, ese literal ya no existe y la 0255 revienta.
--    El orden numérico natural (0255 → 0256) es el correcto: respétalo.
--
-- ── Problema ────────────────────────────────────────────────
-- 1) `consolidacion` significaba DOS cosas: el producto comercial (LCL hasta
--    puerto, con BL propio del cliente) y la OPERACIÓN de juntar carga, que
--    también hace el puerta a puerta. Esa ambigüedad ya provocó un dato mal
--    clasificado en prod (la tarifa pública del calculador, que es del puerta
--    a puerta, quedó guardada como `consolidacion`).
-- 2) `fcl-bodega` (contenedor consolidado en la bodega de Yiwu) y `fcl-directo`
--    (contenedor cargado en la fábrica del proveedor) son DOS productos y
--    compartían un solo valor de enum → no se les podía poner tarifa distinta
--    ni medirlos por separado.
--
-- ── Por qué RENAME y no un valor nuevo + backfill ───────────
-- El label de un enum es solo eso, una etiqueta: las filas guardan el OID del
-- valor, no el texto. Renombrar migra las 3 tablas con datos (rates, quotes,
-- shipments) SOLAS, sin UPDATE, sin ventana de inconsistencia y sin filas
-- huérfanas. `reserva_FCL` se renombra a `fcl_directo` —y no se crea uno
-- nuevo— porque "reserva de contenedor" ES el FCL directo: su `legacySlug` en
-- el catálogo comercial es `reserva-contenedores`. Las 3 filas de shipments y
-- las 2 de rates que hoy son `reserva_FCL` son directos de fábrica.
-- `fcl_bodega` sí nace vacío.
--
-- ── Lo que el RENAME NO arrastra (revisado UNO POR UNO en prod, 2026-07-20) ──
-- El rename rompe cualquier objeto que compare contra el TEXTO viejo. Barrido
-- completo del catálogo del sistema:
--
--  · Constraints CHECK  → NINGUNO. (El único match del grep,
--    `club_group_buys_status_chk`, contiene 'en_consolidacion', que es un
--    estado de compra grupal en una columna `text`, NO este enum.)
--  · Vistas / vistas materializadas → NINGUNA.
--  · Políticas RLS      → NINGUNA (ninguna qual/with_check menciona los literales).
--  · Índices parciales  → NINGUNO con predicado sobre estos valores. Los
--    índices que TOCAN la columna (rates_tenant_service_idx,
--    shipments_tenant_service_idx, route_cost_templates_route_uniq) indexan el
--    valor, no el texto → sobreviven al rename sin tocarse.
--  · Triggers           → NINGUNO.
--  · Defaults de columna → UNO: `sales_orders.service default
--    'consolidacion'::shipment_service`. NO hay que reescribirlo: el default
--    guarda el OID del valor, así que tras el rename queda apuntando al MISMO
--    valor, ya llamado `consolidado_lcl`. Se deja como está a propósito (el
--    default sigue siendo el mismo producto comercial de antes).
--  · Funciones / RPC    → UNA de verdad: `public_fcl_rates()` compara
--    `r.service = 'reserva_FCL'` (texto) y por eso se recrea abajo. Las otras
--    tres que aparecen en el grep (`receive_prealerta_as_operario`,
--    `operario_action`, `create_receipt_as_operario`) contienen
--    'pendiente_consolidacion', que es `warehouse_receipt_status` → falso
--    positivo, no se tocan.
--  · Datos semilla      → los del repo (supabase/seed.ts) ya están migrados en
--    el mismo commit del código.
--
-- ── Gotcha de Postgres con ADD VALUE ────────────────────────
-- `ALTER TYPE ... ADD VALUE` no podía correr dentro de una transacción hasta
-- PG 11, y el valor recién agregado NO se puede USAR en la misma transacción
-- que lo crea. Prod corre PostgreSQL 17.6 (verificado 2026-07-20), así que el
-- ADD VALUE dentro de la transacción de la migración es legal. La segunda
-- restricción SIGUE VIGENTE en 17, y por eso esta migración NO usa
-- `fcl_bodega` en ningún lado: no lo compara, no lo inserta, no lo mete en un
-- default. Clasificar las filas que deben pasar a `fcl_bodega` es trabajo
-- OPERATIVO posterior, desde /studio (ver la spec).
--
-- `if not exists` en el ADD VALUE + los `do $$` de guarda hacen la migración
-- idempotente: correrla dos veces no falla.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1) Los dos renames
--    Guardados con `if exists` sobre pg_enum para poder re-correr la migración.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'shipment_service' and e.enumlabel = 'consolidacion'
  ) then
    alter type public.shipment_service rename value 'consolidacion' to 'consolidado_lcl';
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'shipment_service' and e.enumlabel = 'reserva_FCL'
  ) then
    alter type public.shipment_service rename value 'reserva_FCL' to 'fcl_directo';
  end if;
end$$;

-- ─────────────────────────────────────────────────────────────
-- 2) El valor nuevo. Nace SIN filas: separar los contenedores de bodega de los
--    directos es una reclasificación comercial que hace el founder desde el
--    Studio, no una migración que adivine.
--    NO se usa más abajo (restricción de PG: valor nuevo no usable en la misma
--    transacción que lo crea).
-- ─────────────────────────────────────────────────────────────

alter type public.shipment_service add value if not exists 'fcl_bodega';

-- ─────────────────────────────────────────────────────────────
-- 3) public_fcl_rates() — la ÚNICA RPC que comparaba contra el texto viejo.
--    Sin esto, la calculadora FCL pública del sitio revienta en la primera
--    llamada después del rename ('reserva_FCL' deja de existir como label).
--
--    Cambio MÍNIMO y equivalente: `'reserva_FCL'` → `'fcl_directo'`, mismo
--    cuerpo, misma firma, mismos grants. NO se le agrega `fcl_bodega`: eso
--    cambiaría qué rutas ve el público y es decisión comercial del founder, no
--    de esta migración (queda anotado como pendiente en la spec).
-- ─────────────────────────────────────────────────────────────

create or replace function public.public_fcl_rates()
returns table (
  origin       text,
  destination  text,
  flat_rate    numeric,
  min_charge   numeric,
  transit_days int,
  valid_until  date
)
language sql
stable
security definer
set search_path = public
as $$
  select r.origin, r.destination, r.flat_rate, r.min_charge, r.transit_days, r.valid_until
  from public.rates r
  join public.tenants t on t.id = r.tenant_id
  where t.slug = 'dtd'
    and r.service = 'fcl_directo'
    and r.is_public = true
    and r.deleted_at is null
    and r.flat_rate is not null
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_until is null or r.valid_until >= current_date)
  order by r.origin, r.destination;
$$;

comment on function public.public_fcl_rates() is
  'Endpoint público (anon) para la calculadora FCL del sitio. Devuelve las rutas fcl_directo marcadas is_public del tenant dtd: origin + destination + flat_rate + min_charge + transit_days + valid_until. Retorno MÍNIMO, sin tenant_id/notes/per_cbm. Scoped a slug=dtd. Espeja public_cbm_rate (0101). El valor de enum se llamaba reserva_FCL hasta la migr 0256 (SDD-0164). NO incluye fcl_bodega a propósito: son productos distintos y esa decisión es comercial.';

revoke all on function public.public_fcl_rates() from public;
grant execute on function public.public_fcl_rates() to anon, authenticated;

comment on type public.shipment_service is
  'Servicio de transporte de un embarque/tarifa/cotización/orden de venta. Un valor = un producto comercial, con UN solo nombre visible (definido en lib/shared/shipment-public.ts). puerta_a_puerta_DDP = todo pagado, paga al llegar · consolidado_lcl = LCL hasta puerto, con BL propio del cliente · fcl_directo = contenedor cargado en la fábrica del proveedor · fcl_bodega = contenedor completo consolidado en la bodega de Yiwu · transporte_terrestre = nacional en Venezuela. Renombrado en la migr 0256 (SDD-0164): consolidacion → consolidado_lcl, reserva_FCL → fcl_directo, + fcl_bodega nuevo.';
