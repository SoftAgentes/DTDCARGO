-- ─────────────────────────────────────────────────────────────
-- Throttle por IP para la verificación pública /verificar.
--
-- /verificar (destino del QR de cajas y diplomas) usa service_role para
-- confirmar existencia de un Shipping Mark (DTD-NNNN) o leer un diploma
-- (DTD-AC-YYYY-NNNN). Ambos códigos son SECUENCIALES → enumerables. La rama de
-- diploma expone `student_name` (PII): sin límite, un atacante cosecha nombres
-- probando folios. Esta tabla acota cuántas verificaciones puede hacer una IP
-- por ventana; pasado el límite, la página responde en estado neutro (ni
-- confirma ni niega), sin tocar más la DB ni revelar PII.
--
-- Tabla separada de portal_registro_throttle a propósito: el límite de registro
-- (5/60min) es mucho más bajo que el de escaneo legítimo de cajas; mezclarlas
-- bloquearía cruzado. Misma forma e idéntico patrón (SDD-0042 §10 / migr 0094).
--
-- Tabla privilegiada: RLS habilitada SIN policy → cero acceso anon/authenticated;
-- solo service_role la lee/escribe. Sin tenant_id: el throttle es global al
-- endpoint público. El cron purge-throttle puede limpiarla por antigüedad.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.public_verify_throttle (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

comment on table public.public_verify_throttle is
  'Throttle por IP de /verificar (QR de cajas/diplomas). Una fila por verificación que queda bajo el límite. Privilegiada: solo service_role (RLS sin policy). Sin tenant_id: global al endpoint público. Tabla separada de portal_registro_throttle (límites distintos).';

-- Índice para el conteo por ventana: WHERE ip = $1 AND created_at >= now() - interval.
create index if not exists public_verify_throttle_ip_created_idx
  on public.public_verify_throttle (ip, created_at);

-- RLS habilitada SIN policy → bloquea anon/authenticated por completo.
-- service_role bypassa RLS, así que el render del page (admin client) sí lee/inserta.
alter table public.public_verify_throttle enable row level security;
