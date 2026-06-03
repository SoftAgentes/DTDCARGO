-- ─────────────────────────────────────────────────────────────
-- SDD-0042 §10: anti-abuso del registro self-service del Portal.
--
-- El endpoint público `/portal/registro` (registerClientAction) corre con
-- service_role (el registrante es anónimo). Sumamos throttle por IP en DB,
-- gratis y sin keys: cada intento por debajo del límite deja una fila acá;
-- la action cuenta las filas recientes de la IP antes del trabajo pesado y
-- rechaza si excede el límite (REGISTRO_IP_LIMIT/REGISTRO_WINDOW_MINUTES en
-- la action). (La otra capa, honeypot, es 100% in-action, no toca DB.)
--
-- Tabla PRIVILEGIADA: SOLO la toca service_role (que bypassa RLS). RLS queda
-- HABILITADA y SIN ninguna policy → cero acceso anon/authenticated (espeja el
-- patrón de buckets privados sin policy de INSERT público, p.ej. client-docs en
-- 0091). No tiene tenant_id a propósito: el throttle es pre-cuenta (el cliente
-- todavía no tiene tenant ni MARKBOX) y la IP es global al endpoint público.
--
-- Aditiva, sin DDL destructivo. NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.portal_registro_throttle (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

comment on table public.portal_registro_throttle is
  'SDD-0042 §10: registro de intentos del alta self-service /portal/registro para throttle por IP. Una fila por intento que pasa el honeypot y queda bajo el límite. Tabla privilegiada: solo service_role la escribe/lee (RLS habilitada SIN policy → cero acceso anon/authenticated). Sin tenant_id: el throttle es pre-cuenta y global al endpoint público.';

-- Índice para el conteo por ventana: WHERE ip = $1 AND created_at >= now() - interval.
create index if not exists portal_registro_throttle_ip_created_idx
  on public.portal_registro_throttle (ip, created_at);

-- RLS habilitada SIN policy → bloquea anon/authenticated por completo.
-- service_role bypassa RLS, así que la action (admin client) sí puede leer/insertar.
alter table public.portal_registro_throttle enable row level security;
