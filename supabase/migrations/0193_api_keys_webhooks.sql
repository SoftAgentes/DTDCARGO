-- ─────────────────────────────────────────────────────────────
-- 0193 · SDD-0128 · API keys & webhooks (Administración · PRO)
--   api_keys        (tokens para integrar sistemas externos)
--   webhooks        (endpoints salientes para sincronizar eventos)
--
-- Gestión de credenciales de integración. El token en claro NUNCA se guarda:
-- se almacena solo su SHA-256 (`key_hash`) + un prefijo visible (`key_prefix`)
-- para identificarlo en la lista. El token completo se muestra UNA sola vez al
-- crearlo (lo devuelve la server action). Revocar = `revoked_at`.
--
-- ⚠️ Esto modela la GESTIÓN de credenciales. El consumo (middleware que
-- autentica requests entrantes con la key; dispatcher que dispara los webhooks)
-- es un follow-up de otra spec. Sin consumidor, estas filas no autorizan ni
-- disparan nada todavía.
--
-- Convención del repo: RLS por tenant, grants explícitos (auto-expose OFF),
-- soft-delete/revoke, touch_updated_at(). Edición admin-only en la app.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder.
-- ─────────────────────────────────────────────────────────────

-- ── API keys ──────────────────────────────────────────────────
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,

  name         text not null,               -- "Integración BI", "CRM externo"
  -- Prefijo visible para identificar la key en la lista (NO es secreto).
  key_prefix   text not null,               -- ej "dtd_live_1a2b3c4d"
  -- SHA-256 hex del token completo. El token en claro no se guarda nunca.
  key_hash     text not null,

  last_used_at timestamptz,                  -- nullable · lo setea el consumidor (follow-up)
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz                   -- revocar = setear esto
);

comment on table public.api_keys is
  'SDD-0128: tokens de integración por tenant. Se guarda SOLO el SHA-256 del token (key_hash) + prefijo visible; el token en claro se muestra una vez al crearlo. RLS por tenant; edición admin-only app-level. Revocar = revoked_at.';

-- El hash es único (evita colisión / doble alta del mismo token).
create unique index if not exists api_keys_hash_uniq on public.api_keys (key_hash);
create index if not exists api_keys_tenant_idx
  on public.api_keys (tenant_id, created_at desc) where revoked_at is null;

grant select, insert, update on public.api_keys to authenticated;
revoke all on public.api_keys from anon;

alter table public.api_keys enable row level security;
create policy "api_keys by tenant" on public.api_keys for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- ── Webhooks ──────────────────────────────────────────────────
create table if not exists public.webhooks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,

  name        text not null,
  url         text not null,
  -- Eventos suscritos (claves libres: 'shipment.created', 'invoice.paid'…).
  events      jsonb not null default '[]'::jsonb,
  -- Secreto de firma HMAC compartido con el receptor (no secreto de servidor;
  -- se muestra para configurarlo del otro lado).
  secret      text not null,
  active      boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table public.webhooks is
  'SDD-0128: endpoints salientes por tenant (url + eventos suscritos + secreto de firma). RLS por tenant; edición admin-only. El dispatcher que los dispara es follow-up. Soft delete.';

create index if not exists webhooks_tenant_idx
  on public.webhooks (tenant_id, created_at desc) where deleted_at is null;

grant select, insert, update on public.webhooks to authenticated;
revoke all on public.webhooks from anon;

alter table public.webhooks enable row level security;
create policy "webhooks by tenant" on public.webhooks for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger webhooks_touch
  before update on public.webhooks
  for each row execute function public.touch_updated_at();
