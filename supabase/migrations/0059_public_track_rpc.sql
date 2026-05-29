-- ─────────────────────────────────────────────────────────────
-- 0059 · public_track_shipment · Portal Cliente Tracking Real (Sprint A v2)
--
-- Justificación negocio: el cliente VE pregunta "¿dónde está mi caja?"
-- por WhatsApp → admin abre Studio → responde. Cada cliente = N
-- WhatsApps/semana al admin. Una página `/track/[code]` real (no mock)
-- que el cliente abra del link que el admin manda = corta el 60% de
-- WhatsApps de tracking.
--
-- RPC SECURITY DEFINER porque el cliente no está autenticado:
--   - grant execute to anon → cualquiera con el código consulta.
--   - Retorna data MINIMAL (status + ETA + timeline + POD photo
--     opcional). NO retorna: tenant_id, client_id, valores comerciales
--     sensibles, otros shipments del cliente.
--   - Resuelve contra shipments.code (formato S-YYYY-NNNN).
--
-- Rate limit blando: tabla `public_track_log` para auditar. Bloqueo
-- duro vía middleware Next.js (out of scope acá).
--
-- Idempotente: usa create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- Tabla de auditoría (no rate limit estricto — solo log para detectar abuso)
create table if not exists public.public_track_log (
  id            uuid primary key default gen_random_uuid(),
  ip            text,                                            -- request IP (puede ser null si no se pasa)
  code          text not null,
  found         boolean not null,                                 -- resolvió a algún shipment?
  requested_at  timestamptz not null default now()
);

comment on table public.public_track_log is
  'Audit log de consultas al endpoint público /track/[code]. NO incluye user_agent ni datos sensibles. Útil para detectar scraping/abuso.';

create index if not exists public_track_log_code_idx
  on public.public_track_log (code, requested_at desc);

create index if not exists public_track_log_ip_idx
  on public.public_track_log (ip, requested_at desc)
  where ip is not null;

-- ─────────────────────────────────────────────────────────────
-- RPC public_track_shipment
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_track_shipment(text, text);

create or replace function public.public_track_shipment(
  p_code text,
  p_ip text default null
)
returns table (
  found                  boolean,
  code                   text,
  status                 text,
  shipment_service       text,
  origin                 text,
  destination            text,
  weight_kg              numeric,
  volume_m3              numeric,
  vehicle_category       text,
  arrived_destination_at timestamptz,
  delivered_at           timestamptz,
  pod_signed_by          text,
  created_at             timestamptz,
  events                 jsonb              -- [{status, note, occurred_at}]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_shipment_id uuid;
begin
  -- Sanity: code no vacío + longitud razonable
  if p_code is null or length(p_code) < 3 or length(p_code) > 32 then
    insert into public_track_log (ip, code, found) values (p_ip, coalesce(p_code, ''), false);
    return query select false, ''::text, ''::text, ''::text, ''::text, ''::text,
                        null::numeric, null::numeric, ''::text,
                        null::timestamptz, null::timestamptz, ''::text,
                        null::timestamptz, '[]'::jsonb;
    return;
  end if;

  -- Normalize: trim + upper
  v_normalized := upper(trim(p_code));

  -- Resolver: match exacto sobre shipments.code (sin importar tenant — código es único globalmente
  -- por unique constraint (tenant_id, code), pero entre tenants puede haber colisiones.
  -- En la práctica DTD opera con 1 tenant, así que el primer match es válido. Si hay multi-tenant
  -- en el futuro, esto necesita revisión).
  -- IMPORTANTE: qualifiers `s.*` obligatorios porque RETURNS TABLE define cols con
  -- mismos nombres (code, status, deleted_at) — sin qualifier, PL/pgSQL falla con
  -- "column reference ambiguous" (42702).
  select s.id into v_shipment_id
    from public.shipments s
   where upper(s.code) = v_normalized
     and s.deleted_at is null
   limit 1;

  if v_shipment_id is null then
    insert into public.public_track_log (ip, code, found) values (p_ip, v_normalized, false);
    return query select false, ''::text, ''::text, ''::text, ''::text, ''::text,
                        null::numeric, null::numeric, ''::text,
                        null::timestamptz, null::timestamptz, ''::text,
                        null::timestamptz, '[]'::jsonb;
    return;
  end if;

  insert into public.public_track_log (ip, code, found) values (p_ip, v_normalized, true);

  -- Devolver shipment + eventos en jsonb (orden cronológico ascendente, viejo → reciente)
  return query
  select
    true,
    s.code,
    s.status::text,
    s.shipment_service::text,
    s.origin,
    s.destination,
    s.weight_kg,
    s.volume_m3,
    s.vehicle_category,
    s.arrived_destination_at,
    s.delivered_at,
    s.pod_signed_by,
    s.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', e.status::text,
            'note', e.note,
            'occurred_at', e.occurred_at
          )
          order by e.occurred_at asc
        )
        from public.shipment_events e
        where e.shipment_id = s.id
          and e.deleted_at is null
      ),
      '[]'::jsonb
    ) as events
  from public.shipments s
  where s.id = v_shipment_id;
end;
$$;

comment on function public.public_track_shipment(text, text) is
  'Endpoint público para tracking cliente (Sprint A v2). Resuelve shipments.code → devuelve status + timeline + POD si entregado. Anon execute. Audit log en public_track_log.';

-- Grants
revoke all on function public.public_track_shipment(text, text) from public;
grant execute on function public.public_track_shipment(text, text) to anon, authenticated;

-- Permitir lectura del log al service_role (admin debug) + anon insert (via la propia función)
grant select on public.public_track_log to service_role;
grant insert on public.public_track_log to anon, authenticated;

-- RLS para public_track_log: nadie SELECT excepto service_role
alter table public.public_track_log enable row level security;

-- Sin policies de select = nadie del cliente puede leer el audit.
-- Service_role bypassea RLS.

create policy public_track_log_anon_insert on public.public_track_log
  for insert to anon, authenticated
  with check (true);
