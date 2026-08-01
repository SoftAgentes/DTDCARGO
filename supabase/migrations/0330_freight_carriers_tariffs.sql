-- ============================================================================
-- 0330 · SDD-0236 — Transportistas terrestres y su tarifario
-- ============================================================================
-- Hoy no existe NINGUNA entidad de transportista en el sistema: ni tabla, ni
-- tarifario por proveedor. Lo único parecido es `carriers`, que son navieras
-- marítimas (SDD-0047). Los proveedores viven en markdown y la calculadora
-- pública cobra una fórmula inventada (`max(0, km - 200) x $1`) que no
-- corresponde a ningún modelo real.
--
-- Dos tablas:
--   · freight_carriers — quiénes son. UNO marcado como predeterminado por tenant.
--   · carrier_tariffs  — cuánto cuesta cada ciudad con cada uno.
--
-- LA REGLA QUE GOBIERNA EL DISEÑO (founder, 31-jul-2026): con cualquier
-- transportista, DTD paga por METRO CÚBICO. Nada de % ad valorem, nada de
-- USD/kg, nada de valor declarado. Ellos cotizan en pies cúbicos porque vienen
-- del mundo courier de EE.UU.; se convierte al registrar y el número operativo
-- del sistema es SIEMPRE USD/CBM.
--
-- POR QUÉ HAY DOS PRECIOS Y NO UNO. `cost_usd_cbm` es lo que le pagamos al
-- transportista; `price_usd_cbm` es lo que le cobramos al cliente. No son el
-- mismo número ni se derivan uno del otro por un porcentaje: la venta salió de
-- la PRIMERA oferta de Benito en pie cúbico ($3,00 / $3,50 / $5,00 x 35,3147) y
-- se sostiene aunque el costo suba. Es un seguro, no un margen. Cualquier
-- intento futuro de calcular la venta como `costo x (1 + margen)` rompe esa
-- decisión — está documentado en SDD-0236.
--
-- LA WEB PÚBLICA NUNCA VE EL COSTO NI QUIÉN ES EL TRANSPORTISTA. La RPC anon
-- devuelve sólo el precio de venta del proveedor predeterminado. Ese aislamiento
-- es el punto de seguridad de esta migración y tiene prueba contractual.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. freight_carriers — el registro de proveedores
-- ─────────────────────────────────────────────────────────────

create table if not exists public.freight_carriers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,                       -- nombre comercial (el que usa el equipo)
  legal_name  text,                                -- razón social exacta de la factura
  tax_id      text,                                -- RIF
  contact     text,                                -- teléfono / correo / persona
  notes       text,
  is_default  boolean not null default false,      -- el que cotiza la web pública
  active      boolean not null default true,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint freight_carriers_name_nonempty check (length(trim(name)) > 0),
  -- Habilita el FK compuesto de carrier_tariffs: sin esto, una tarifa podría
  -- apuntar a un transportista de OTRO tenant.
  constraint freight_carriers_id_tenant_uniq unique (id, tenant_id)
);

comment on table public.freight_carriers is
  'Transportistas terrestres nacionales (SDD-0236). Uno por tenant marcado is_default = el que cotiza la calculadora pública. NO son las navieras de SDD-0047 (tabla carriers). La facturación real con otro proveedor es asunto interno de contabilidad.';

comment on column public.freight_carriers.is_default is
  'El proveedor con el que cotiza la web pública. Índice único parcial: UNO SOLO por tenant entre los vivos.';

-- UN solo predeterminado por tenant, contando sólo los vivos.
create unique index if not exists freight_carriers_one_default_per_tenant
  on public.freight_carriers (tenant_id)
  where is_default and deleted_at is null;

create index if not exists freight_carriers_tenant_idx
  on public.freight_carriers (tenant_id)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 2. carrier_tariffs — cuánto cuesta cada ciudad
-- ─────────────────────────────────────────────────────────────

create table if not exists public.carrier_tariffs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  carrier_id  uuid not null,
  -- Espeja calculator_cities.slug SIN FK dura: las ciudades se editan y
  -- se borran en blando desde el Admin, y una tarifa huérfana es mejor que
  -- un borrado bloqueado. La UI valida contra el catálogo.
  city_slug   text not null,

  cost_usd_cbm   numeric(10,2) not null,   -- lo que le pagamos al transportista
  price_usd_cbm  numeric(10,2) not null,   -- lo que le cobramos al cliente
  price_usd_ft3  numeric(10,4),            -- la unidad en que ELLOS cotizaron (referencia)
  min_charge_usd numeric(10,2),            -- piso por despacho; null = no aplica

  -- Cada cuántos días sale el camión. Alimenta el aviso al cliente: un destino
  -- quincenal (15) puede tardar hasta una semana más que uno semanal.
  dispatch_frequency_days int,
  departure_frequency     text,            -- lo que dijeron, literal ("2 veces por semana · lunes y miércoles")
  transit_days            text,            -- "24 a 72 horas"
  conditions              text,            -- qué exigen para sostener el precio

  valid_from  date,
  valid_to    date,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint carrier_tariffs_city_nonempty check (length(trim(city_slug)) > 0),
  constraint carrier_tariffs_cost_nonneg    check (cost_usd_cbm >= 0),
  constraint carrier_tariffs_price_nonneg   check (price_usd_cbm >= 0),
  constraint carrier_tariffs_ft3_nonneg     check (price_usd_ft3 is null or price_usd_ft3 >= 0),
  constraint carrier_tariffs_min_nonneg     check (min_charge_usd is null or min_charge_usd >= 0),
  constraint carrier_tariffs_freq_positive  check (dispatch_frequency_days is null or dispatch_frequency_days > 0),
  constraint carrier_tariffs_vigencia       check (valid_to is null or valid_from is null or valid_to >= valid_from),

  -- El transportista tiene que ser del MISMO tenant que la tarifa. FK compuesto
  -- en vez de un trigger: lo garantiza el motor, no una función que se puede
  -- olvidar de correr.
  constraint carrier_tariffs_carrier_same_tenant
    foreign key (carrier_id, tenant_id)
    references public.freight_carriers (id, tenant_id)
    on delete cascade
);

comment on table public.carrier_tariffs is
  'Tarifario por transportista y ciudad (SDD-0236). El número operativo es SIEMPRE USD/CBM. cost_usd_cbm = lo que pagamos; price_usd_cbm = lo que cobramos; NO se derivan uno del otro por un porcentaje (ver SDD-0236). price_usd_ft3 guarda la unidad en que cotizó el proveedor, sólo como referencia.';

comment on column public.carrier_tariffs.dispatch_frequency_days is
  'Cada cuántos días sale el camión a esa ciudad. 15 = quincenal → la web le avisa al cliente que puede tardar hasta una semana más. null = sin dato.';

-- Una tarifa viva por transportista y ciudad.
create unique index if not exists carrier_tariffs_one_live_per_city
  on public.carrier_tariffs (tenant_id, carrier_id, city_slug)
  where deleted_at is null;

create index if not exists carrier_tariffs_lookup_idx
  on public.carrier_tariffs (tenant_id, carrier_id)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. GRANTS — antes que las policies (deuda conocida del repo:
--    una policy sin GRANT deja la tabla muda para service_role)
-- ─────────────────────────────────────────────────────────────

grant select, insert, update on public.freight_carriers to authenticated;
grant all    on public.freight_carriers to service_role;

grant select, insert, update on public.carrier_tariffs to authenticated;
grant all    on public.carrier_tariffs to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — leer: cualquiera del tenant · escribir: sólo admin
-- ─────────────────────────────────────────────────────────────

alter table public.freight_carriers enable row level security;
alter table public.carrier_tariffs  enable row level security;

create policy "freight_carriers read by tenant"
  on public.freight_carriers for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "freight_carriers insert by admin"
  on public.freight_carriers for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = freight_carriers.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "freight_carriers update by admin"
  on public.freight_carriers for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = freight_carriers.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = freight_carriers.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "freight_carriers service_role all"
  on public.freight_carriers for all
  to service_role
  using (true)
  with check (true);

create policy "carrier_tariffs read by tenant"
  on public.carrier_tariffs for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "carrier_tariffs insert by admin"
  on public.carrier_tariffs for insert
  to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = carrier_tariffs.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "carrier_tariffs update by admin"
  on public.carrier_tariffs for update
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = carrier_tariffs.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = carrier_tariffs.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "carrier_tariffs service_role all"
  on public.carrier_tariffs for all
  to service_role
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────
-- 5. Triggers updated_at (reusa la función de 0002_shipments.sql)
-- ─────────────────────────────────────────────────────────────

drop trigger if exists freight_carriers_touch on public.freight_carriers;
create trigger freight_carriers_touch
  before update on public.freight_carriers
  for each row execute function public.touch_updated_at();

drop trigger if exists carrier_tariffs_touch on public.carrier_tariffs;
create trigger carrier_tariffs_touch
  before update on public.carrier_tariffs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. RPC pública — SÓLO el predeterminado, SÓLO el precio de venta
-- ─────────────────────────────────────────────────────────────
-- El sitio público no sabe quién es el transportista, no ve el costo y no ve
-- las ofertas de los demás proveedores. Devuelve el mínimo que necesita la
-- calculadora para cotizar y para avisarle al cliente cuándo sale el camión.

drop function if exists public.public_carrier_tariffs(uuid);

create or replace function public.public_carrier_tariffs(p_tenant uuid default null)
returns table (
  city_slug               text,
  price_usd_cbm           numeric,
  min_charge_usd          numeric,
  dispatch_frequency_days int,
  transit_days            text
)
language sql
stable
security definer
set search_path = public
as $$
  select ct.city_slug,
         ct.price_usd_cbm,
         ct.min_charge_usd,
         ct.dispatch_frequency_days,
         ct.transit_days
  from public.carrier_tariffs ct
  join public.freight_carriers fc
    on fc.id = ct.carrier_id
   and fc.tenant_id = ct.tenant_id
  join public.tenants t on t.id = ct.tenant_id
  where (
          (p_tenant is not null and t.id = p_tenant)
          or (p_tenant is null and t.slug = 'dtd')
        )
    and fc.is_default
    and fc.active
    and fc.deleted_at is null
    and ct.deleted_at is null
    and (ct.valid_from is null or ct.valid_from <= current_date)
    and (ct.valid_to   is null or ct.valid_to   >= current_date)
  order by ct.city_slug asc;
$$;

comment on function public.public_carrier_tariffs(uuid) is
  'Endpoint público (anon) del tarifario terrestre (SDD-0236). Devuelve SÓLO las tarifas vigentes del transportista PREDETERMINADO del tenant dtd (o p_tenant): city_slug + precio de VENTA + mínimo + cada cuántos días sale + tránsito. NUNCA expone cost_usd_cbm, el nombre del transportista, su RIF ni las ofertas de los demás. Par con public_calculator_cities() y public_cbm_rate(). Sin filas → el sitio deriva al asesor, no inventa precio.';

revoke all on function public.public_carrier_tariffs(uuid) from public;
grant execute on function public.public_carrier_tariffs(uuid) to anon, authenticated;
