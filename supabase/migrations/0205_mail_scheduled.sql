-- ─────────────────────────────────────────────────────────────
-- SDD-0140 · Mailing al Norte — Programados (Slice D)
--
-- Cola de correos programados. El Compose (Envío manual) inserta filas
-- con status='queued' + scheduled_for futura; el cron
-- /api/cron/mail-scheduled las procesa cuando vencen (scheduled_for <= now)
-- y llama sendEmail() por cada una. El admin puede adelantar ("Enviar ya")
-- o cancelar desde la vista Programados.
--
-- Prereq:
--   - Tabla `tenants` (Studio Shell SDD-0007)
--   - Tabla `mail_logs` + enum `mail_channel` (0018_mailing.sql)
--   - Tabla `auth.users` (Supabase Auth)
--   - Función `public.get_user_tenant_id()` (helper del Studio)
--
-- RLS: tenant-scoped (mismo estilo que mail_logs/mail_config de 0018/0204).
--   El gating a rol admin lo hace la APP (módulo Mailing admin-only:
--   page.tsx redirige a no-admin + moduleEditDenial en las server actions).
-- ─────────────────────────────────────────────────────────────

create table public.mail_scheduled (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  scheduled_for      timestamptz not null,
  channel            mail_channel not null default 'email',
  to_email           text not null,
  to_name            text,
  cc                 text[] not null default '{}',
  bcc                text[] not null default '{}',
  subject            text not null,
  body_html          text not null,
  template_slug      text,
  signature_user_id  uuid references auth.users(id) on delete set null,
  status             text not null default 'queued'
                       check (status in ('queued', 'sent', 'canceled', 'failed')),
  attachments_count  int not null default 0,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz,
  sent_log_id        uuid references public.mail_logs(id) on delete set null,
  error              text
);

comment on table public.mail_scheduled is
  'Cola de correos programados (SDD-0140 Slice D). El cron mail-scheduled procesa los queued con scheduled_for <= now(). RLS por tenant; gating admin en la app.';

-- Índice de la cola: el cron filtra por status+scheduled_for; la vista por tenant.
create index mail_scheduled_tenant_status_when_idx
  on public.mail_scheduled (tenant_id, status, scheduled_for);

-- ─── GRANTs ──────────────────────────────────────────────────
grant select, insert, update, delete on public.mail_scheduled to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.mail_scheduled enable row level security;

-- Tenant-scoped for all (mismo patrón que mail_config/mail_templates de 0018).
-- El módulo es admin-only en la capa app: el gating a rol lo hace la app,
-- no la policy (regla de la casa: "RLS por tenant, rol en la app").
create policy "mail_scheduled_by_tenant"
  on public.mail_scheduled for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));
