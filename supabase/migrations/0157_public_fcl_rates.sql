-- ─────────────────────────────────────────────────────────────
-- 0157 · Calculadora FCL pública · RPC public_fcl_rates() (anon, security definer)
--
-- Justificación negocio: de los 4 servicios, FCL (reserva_FCL · contenedor
-- completo) es el ÚNICO sin estimado automático para el cliente. El motor
-- flat_rate y los datos ya existen en `rates`; falta SOLO exponer las rutas FCL
-- públicas al sitio. Esta migración agrega únicamente el endpoint de lectura.
--
-- NO cambia el schema: `is_public` y `valid_from` ya existen (0101). El admin
-- marca qué rutas FCL son públicas desde /studio/tarifas (RateDrawer · is_public
-- ya soportado para filas flat_rate; el índice singleton
-- `rates_one_public_cbm_per_tenant` SOLO restringe per_cbm → puede haber VARIAS
-- rutas FCL públicas a la vez).
--
-- Seguridad (espeja public_cbm_rate, 0101): SECURITY DEFINER endurecida —
-- `set search_path = public`, refs schema-qualified, `revoke all from public` +
-- `grant execute a anon, authenticated`. Retorno MÍNIMO (sin tenant_id, notes,
-- per_cbm ni data comercial sensible). Scoped a slug='dtd' (mono-tenant en la
-- práctica), determinista. STABLE (solo lee). Dataset chico + índice
-- rates_tenant_service_idx (tenant_id, service) → eficiente.
--
-- Idempotente: drop if exists + create or replace.
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_fcl_rates();

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
    and r.service = 'reserva_FCL'
    and r.is_public = true
    and r.deleted_at is null
    and r.flat_rate is not null
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_until is null or r.valid_until >= current_date)
  order by r.origin, r.destination;
$$;

comment on function public.public_fcl_rates() is
  'Endpoint público (anon) para la calculadora FCL del sitio. Devuelve las rutas reserva_FCL marcadas is_public del tenant dtd: origin + destination + flat_rate + min_charge + transit_days + valid_until. Retorno MÍNIMO, sin tenant_id/notes/per_cbm. Scoped a slug=dtd. Espeja public_cbm_rate (0101).';

-- Grants: solo execute, anon + authenticated. Nadie más (no PUBLIC default).
revoke all on function public.public_fcl_rates() from public;
grant execute on function public.public_fcl_rates() to anon, authenticated;
