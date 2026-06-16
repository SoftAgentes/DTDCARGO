-- ─────────────────────────────────────────────────────────────
-- 0142 · SDD-0090 · Motor de oferta al cliente — matriz de cruce configurable
--
-- Agrega a service_configs las 3 columnas que hacen la matriz de oferta CONFIGURABLE
-- en Studio (decisión founder 2026-06-16). El DEFAULT derivable vive en código
-- (lib/shared/service-offer.ts); estas columnas lo PISAN por servicio cuando el
-- founder las seede en el Studio. Patrón "DB pisa, código respalda" (= mergeServicios-
-- Publicados / 0130).
--
--   · suggests_keys text[] — otros servicios a OFRECER cuando este es el núcleo elegido.
--   · includes_keys text[] — servicios ya PLEGADOS en este (no se ofrecen; ej. DDP→aduana).
--   · charge_mode   text   — cómo se cobra (calculadora|tabla_comision|valorizacion|asesor|honorarios).
--
-- Distinto de service_addons (recargos DENTRO de un servicio: almacenaje, fuera de casco).
-- Acá modelamos el GRAFO de oferta ENTRE servicios.
--
-- Las 3 son PÚBLICAS (el sitio las necesita para armar la oferta) → se agregan al
-- whitelist de public_servicios(). NO se expone nada interno nuevo.
--
-- Idempotente (add column if not exists / create or replace). NO aplicar a prod desde
-- la rama — la aplica la ventana de coordinación (regla de la ventana secundaria).
-- Skills Supabase (seguridad + postgres-best-practices) invocados antes de tocar schema.
-- ─────────────────────────────────────────────────────────────

-- ── 1) Columnas nuevas en service_configs ────────────────────
alter table public.service_configs
  add column if not exists suggests_keys text[] not null default '{}',
  add column if not exists includes_keys text[] not null default '{}',
  add column if not exists charge_mode   text;

-- charge_mode: enum lógico validado por CHECK (espejo de ChargeMode en service-offer.ts).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_configs_charge_mode_chk'
  ) then
    alter table public.service_configs
      add constraint service_configs_charge_mode_chk
      check (charge_mode is null or charge_mode in
        ('calculadora','tabla_comision','valorizacion','asesor','honorarios'));
  end if;
end $$;

comment on column public.service_configs.suggests_keys is
  'SDD-0090: service_keys de otros servicios a ofrecer cuando este es el núcleo elegido (matriz de oferta). Pisa el default de lib/shared/service-offer.ts. Público.';
comment on column public.service_configs.includes_keys is
  'SDD-0090: service_keys ya plegados en este servicio (no se ofrecen aparte; ej. DDP incluye aduana). Público.';
comment on column public.service_configs.charge_mode is
  'SDD-0090: cómo se cobra el servicio (calculadora|tabla_comision|valorizacion|asesor|honorarios), para la UI de oferta. Público.';

-- ── 2) public_servicios(): agregar las 3 columnas al whitelist ──
-- Recrea la RPC de 0130 sumando suggests_keys/includes_keys/charge_mode. Sigue siendo
-- security definer + search_path fijo + solo tenant dtd + is_public. NO proyecta ninguna
-- columna interna (notes_internal/internal_price_ref/mapeo_contable siguen fuera).
drop function if exists public.public_servicios();
create or replace function public.public_servicios()
returns table (
  service_key text, shipment_service public.shipment_service, title_public text,
  description_public text, includes_public text[], excludes_public text[],
  price_text text, price_table jsonb, charge_moment text, payment_methods text[],
  how_to_request text, timelines_public text, note_public text,
  condiciones_politicas text, service_state text,
  suggests_keys text[], includes_keys text[], charge_mode text
)
language sql stable security definer set search_path = public as $$
  select sc.service_key, sc.shipment_service, sc.title_public, sc.description_public,
         sc.includes_public, sc.excludes_public, sc.price_text, sc.price_table,
         sc.charge_moment, sc.payment_methods, sc.how_to_request, sc.timelines_public,
         sc.note_public, sc.condiciones_politicas, sc.service_state,
         sc.suggests_keys, sc.includes_keys, sc.charge_mode
  from public.service_configs sc
  join public.tenants t on t.id = sc.tenant_id
  where t.slug = 'dtd' and sc.is_public = true and sc.deleted_at is null;
$$;

comment on function public.public_servicios() is
  'Endpoint público (anon) de los servicios publicados del tenant dtd (SDD-0076 Fase 3 + SDD-0090 matriz de oferta). Whitelist de columnas: NO proyecta notes_internal/internal_price_ref/mapeo_contable. Par de public_service_faqs().';

revoke all on function public.public_servicios() from public;
grant execute on function public.public_servicios() to anon, authenticated;
