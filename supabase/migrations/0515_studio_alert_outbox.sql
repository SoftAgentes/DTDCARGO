-- ─────────────────────────────────────────────────────────────
-- 0515 · SDD-0606 — Cola durable de avisos del Studio a Discord.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md) y pasar por el Director
--    General. No bloquea el código: sin la tabla, un aviso que Discord no
--    guardó sigue por Telegram, como antes.
--
-- ── Para qué (revisión de Codex, A3) ─────────────────────────
-- Si Discord no guarda un aviso de una categoría que no puede perderse
-- (registro de clientes, bugs, reporte diario), el aviso entra a esta cola y el
-- cron de reintentos (`/api/cron/bug-notifications-drain`, cada 5 minutos) lo
-- vuelve a mandar por Discord con espera creciente, hasta 8 intentos.
--
-- ── Qué guarda ───────────────────────────────────────────────
-- SÓLO el aviso mínimo que ya sale a Discord: título fijo, código del registro,
-- enlace al Studio y conteos. Nunca el texto completo (nombre, teléfono, montos):
-- el código no lo pasa y el CHECK de `payload` rechaza cualquier otra clave.
-- Además, los IDs de Discord del personal a mencionar. Las filas cerradas se
-- borran a los 30 días (lo hace el mismo cron).
--
-- ── Quién la ve ──────────────────────────────────────────────
-- Nadie desde la aplicación: RLS activada sin policies para `authenticated` y
-- sin privilegios para `anon` ni `authenticated`. Sólo `service_role` (el cron
-- y los avisos del servidor) lee y escribe.
--
-- ── Qué toca ─────────────────────────────────────────────────
-- Una tabla nueva y sus índices. Sin cambios de filas en tablas existentes, sin
-- funciones, sin cambios de RLS ni grants de otras tablas.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null then
    raise exception '0515: falta public.tenants';
  end if;
  -- Si ya existe una tabla con este nombre y no tiene la forma de esta
  -- migración, parar: no es la nuestra.
  if pg_catalog.to_regclass('public.studio_alert_outbox') is not null
     and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'studio_alert_outbox'
          and column_name = 'mention_user_ids'
     ) then
    raise exception '0515: public.studio_alert_outbox ya existe con otra forma';
  end if;
end
$preflight$;

create table if not exists public.studio_alert_outbox (
  id                  uuid primary key default extensions.gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  category            text not null,
  payload             jsonb not null,
  mention_user_ids    text[] not null default '{}',
  attempts            integer not null default 1,
  next_attempt_at     timestamptz not null default now(),
  delivered_at        timestamptz,
  abandoned_at        timestamptz,
  discord_message_id  text,
  last_error          text,
  created_at          timestamptz not null default now(),

  constraint studio_alert_outbox_category_valida
    check (category in ('registro', 'conversaciones', 'bugs', 'reportes', 'equipo')),
  -- Sólo las claves del aviso mínimo, con título y de tamaño acotado.
  constraint studio_alert_outbox_payload_minimo
    check (
      jsonb_typeof(payload) = 'object'
      and payload ? 'titulo'
      and jsonb_typeof(payload -> 'titulo') = 'string'
      and (payload - array['titulo', 'codigo', 'url', 'conteos']) = '{}'::jsonb
      and octet_length(payload::text) <= 2048
    ),
  constraint studio_alert_outbox_menciones_validas
    check (
      cardinality(mention_user_ids) <= 100
      and array_to_string(mention_user_ids, ',') ~ '^([0-9]{17,20}(,[0-9]{17,20})*)?$'
    ),
  constraint studio_alert_outbox_intentos check (attempts between 0 and 100),
  constraint studio_alert_outbox_un_cierre
    check (delivered_at is null or abandoned_at is null),
  constraint studio_alert_outbox_mensaje_snowflake
    check (discord_message_id is null or discord_message_id ~ '^[0-9]{17,20}$'),
  constraint studio_alert_outbox_error_corto
    check (last_error is null or char_length(last_error) <= 500)
);

comment on table public.studio_alert_outbox is
  'SDD-0606: cola de avisos del Studio que Discord no guardó (registro, bugs, reportes). '
  'Sólo el aviso mínimo (título, código, enlace, conteos) e IDs de Discord del personal. '
  'La drena /api/cron/bug-notifications-drain; las filas cerradas se borran a los 30 días.';

-- Las pendientes, por vencimiento: lo que lee cada drenado.
create index if not exists studio_alert_outbox_pendientes_idx
  on public.studio_alert_outbox (next_attempt_at)
  where delivered_at is null and abandoned_at is null;

alter table public.studio_alert_outbox enable row level security;

revoke all on public.studio_alert_outbox from public;
revoke all on public.studio_alert_outbox from anon;
revoke all on public.studio_alert_outbox from authenticated;
grant select, insert, update, delete on public.studio_alert_outbox to service_role;
