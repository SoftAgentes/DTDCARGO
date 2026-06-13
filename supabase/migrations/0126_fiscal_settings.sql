-- ─────────────────────────────────────────────────────────────
-- SDD-0073 · Fiscal · SENIAT (módulo configurable) — fiscal_settings
--
-- Principio rector del módulo: el software NO hardcodea reglas tributarias,
-- las PARAMETRIZA. Esta tabla es la fuente única de la configuración fiscal
-- per-tenant (1 row/tenant): calificación del servicio (exento/gravado/…),
-- alícuota, condición de contribuyente especial, agente de retención de IVA,
-- % de retención, modo de IVA de compras y periodicidad de declaración.
-- Los Libros de IVA (Ventas + Compras) la LEEN; nunca asumen "exento"/"16%".
--
-- Patrón RLS espejado de feature_flags (0042): SELECT a authenticated del
-- tenant · INSERT/UPDATE solo admin (lazy upsert al guardar la config) ·
-- DELETE bloqueado para authenticated · service_role all. Reusa
-- get_user_tenant_id() (0001) y touch_updated_at() (0002).
--
-- Defaults = el caso DTD hoy (spec §5): servicio exento (transporte de carga),
-- agente de retención de IVA sí, alícuota 16%, periodicidad mensual. Todos
-- editables por el admin en la UI sin tocar código ni re-deployar.
--
-- ⚠️ Correlativo: 0126 (el 0125 lo toma 0125_sales_orders en la lane
--    feat/orden-venta, aún sin mergear → se sube al siguiente libre por encima
--    de 0125 para evitar la colisión). NO se aplica a prod desde acá (lo hace
--    el founder). Aditiva: no toca tablas existentes. SIN seed (la config se
--    crea lazy al guardar; si no hay row, getFiscalSettings cae a los
--    DEFAULT_FISCAL_SETTINGS del código).
-- ─────────────────────────────────────────────────────────────

create table public.fiscal_settings (
  tenant_id                uuid primary key references public.tenants(id) on delete cascade,
  -- Calificación tributaria del servicio (la decide el contador):
  --   exento    → operación exenta de IVA (transporte de carga, reforma 2018)
  --   gravado   → operación gravada a la alícuota general (iva_rate)
  --   tasa_cero → gravada a tasa 0% (exportación de servicios, etc.)
  --   mixto     → conviven gravadas y exentas (el libro discrimina por factura)
  service_iva_treatment    text not null default 'exento'
    check (service_iva_treatment in ('exento', 'gravado', 'tasa_cero', 'mixto')),
  iva_rate                 numeric(5,2)  not null default 16,    -- alícuota general vigente (%)
  is_special_taxpayer      boolean       not null default false, -- contribuyente especial (SENIAT)
  is_iva_withholding_agent boolean       not null default true,  -- agente de retención de IVA (DTD lo es)
  iva_withholding_pct      numeric(5,2)  not null default 75,    -- % de retención de IVA (75 o 100)
  -- Fuente del IVA de las compras en el Libro de Compras:
  --   derivado  → se deriva del total/base del documento (supplier_bills hoy no
  --               discrimina IVA → si no hay fuente, la columna queda en "—")
  --   capturado → campo explícito por compra (V2: requiere migración a compras)
  purchase_iva_mode        text not null default 'derivado'
    check (purchase_iva_mode in ('derivado', 'capturado')),
  declaration_period       text not null default 'mensual'
    check (declaration_period in ('mensual')),                  -- el IVA se declara por mes
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users(id) on delete set null,
  -- Cordura: una config inválida sesgaría los libros.
  constraint fiscal_settings_iva_rate_range check (iva_rate >= 0 and iva_rate <= 100),
  constraint fiscal_settings_withholding_range check (iva_withholding_pct >= 0 and iva_withholding_pct <= 100)
);

comment on table public.fiscal_settings is
  'SDD-0073: configuración fiscal per-tenant (1 row/tenant). Fuente única de las reglas tributarias del módulo Fiscal/SENIAT (calificación del servicio, alícuota, contribuyente especial, agente de retención, modo de IVA de compras, periodicidad). Los Libros de IVA la LEEN; el código nunca hardcodea exento/16%/retiene. Defaults = caso DTD hoy, editables por el admin sin deploy. RLS por tenant_id, write admin-only (patrón feature_flags 0042).';

comment on column public.fiscal_settings.service_iva_treatment is
  'SDD-0073: calificación tributaria del servicio. exento|gravado|tasa_cero|mixto. La decide el contador. El Libro de Ventas clasifica cada factura según este valor (exento → IVA 0; gravado → débito a iva_rate).';

comment on column public.fiscal_settings.purchase_iva_mode is
  'SDD-0073: fuente del IVA en el Libro de Compras. derivado = del total/base del documento (si no hay fuente → "—" honesto, regla §3.2). capturado = campo explícito por compra (V2, requiere migración).';

-- ─── GRANTs (auto-expose new tables OFF en este proyecto) ─────
grant select, insert, update on public.fiscal_settings to authenticated;
grant all on public.fiscal_settings to service_role;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.fiscal_settings enable row level security;

-- SELECT: cualquier usuario autenticado del tenant ve su config.
create policy "fiscal_settings_tenant_select"
  on public.fiscal_settings for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- INSERT (lazy upsert): solo admin del tenant. with check ancla el tenant
-- propio + verifica rol admin → un usuario no puede sembrar la config de otro.
create policy "fiscal_settings_admin_insert"
  on public.fiscal_settings for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = fiscal_settings.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

-- UPDATE: solo admin del tenant. USING (qué filas puede tocar) Y WITH CHECK
-- (qué valores quedan) — ambos exigidos para una policy de UPDATE segura.
create policy "fiscal_settings_admin_update"
  on public.fiscal_settings for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = fiscal_settings.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );

-- DELETE bloqueado para authenticated (la config es singleton, no se borra).
create policy "fiscal_settings_no_delete_authenticated"
  on public.fiscal_settings for delete to authenticated using (false);

-- service_role: acceso total (jobs/admin client).
create policy "service_role_all_fiscal_settings"
  on public.fiscal_settings for all to service_role using (true) with check (true);

-- ─── Trigger updated_at (reusa function de 0002_shipments.sql) ─
create trigger fiscal_settings_touch
  before update on public.fiscal_settings
  for each row execute function public.touch_updated_at();
