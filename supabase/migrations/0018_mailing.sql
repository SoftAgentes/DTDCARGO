-- ─────────────────────────────────────────────────────────────
-- SDD-0026 Fase 1 · Schema base de Mailing & Notificaciones
--
-- Contenido:
--   - 5 enums
--   - 6 tablas (mail_templates, mail_signatures, mail_logs,
--     mail_rules, mail_config, mail_blacklist)
--   - 2 RPCs (mail_increment_template_metrics, mail_check_blacklist)
--   - RLS por tenant + user-scoped en signatures
--   - Logs append-only via service_role (UPDATE solo desde webhook
--     handler con service_role)
--   - Seed: mail_config row por cada tenant existente con defaults
--     (test_mode=true, daily_limit=1000, etc.)
--
-- NO incluido en esta migración:
--   - Templates seed inicial (lo hace scripts/seed-mail-templates.ts
--     con UPSERT desde TS — fuente de verdad en código)
--   - Cliente Resend ni endpoint webhook (Fase 2)
--   - UI ni server actions (Fase 3)
--
-- Prereq:
--   - Tabla `tenants` (Studio Shell SDD-0007)
--   - Tabla `auth.users` (Supabase Auth)
--   - Función `get_user_tenant_id()` (helper existente del Studio)
-- ─────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────
create type mail_channel as enum ('email', 'whatsapp');

create type mail_category as enum (
  'operativo',
  'comercial',
  'cobranza',
  'cliente',
  'interno',
  'sistema'
);

create type mail_log_status as enum (
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'opened',
  'clicked',
  'failed'
);

create type mail_rule_event as enum (
  'shipment_created',
  'shipment_arrived',
  'quote_sent',
  'quote_accepted',
  'invoice_emitted',
  'invoice_overdue',
  'no_olvidar_recovery_requested',
  'agent_run_failed'
);

create type mail_signature_layout as enum (
  'minimal',
  'card',
  'corporate',
  'inline',
  'image_only'
);

-- ─── Tabla: mail_templates ───────────────────────────────────
create table public.mail_templates (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  slug                text not null,
  name                text not null,
  category            mail_category not null,
  channel             mail_channel not null default 'email',
  subject             text not null,
  body_html           text not null,
  body_text           text,                              -- auto si null
  variables           text[] not null default '{}',      -- vars del template
  lang                text not null default 'es',
  active              boolean not null default true,
  metrics_sent        int not null default 0,
  metrics_opened      int not null default 0,
  metrics_clicked     int not null default 0,
  metrics_bounced     int not null default 0,
  test_recipient      text,                              -- default "Enviar prueba"
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, slug)
);

comment on table public.mail_templates is
  'Templates de email del Studio. RLS por tenant. variables[] declarativo para autocompletado y validación. metrics_* se actualizan vía RPC y webhook.';

create index mail_templates_tenant_active_idx
  on public.mail_templates (tenant_id, category, channel)
  where deleted_at is null and active = true;
create index mail_templates_tenant_slug_idx
  on public.mail_templates (tenant_id, slug) where deleted_at is null;

-- ─── Tabla: mail_signatures ──────────────────────────────────
create table public.mail_signatures (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  layout              mail_signature_layout not null default 'card',
  full_name           text not null,
  role_label          text,
  phone               text,
  email               text,
  whatsapp            text,
  avatar_url          text,
  photo_url           text,
  company_name        text not null default 'DTD Cargo',
  show_offices_link   boolean not null default true,
  custom_html         text,                              -- override del layout
  is_default          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.mail_signatures is
  'Firmas por usuario. 1 default por user (asegurado via partial unique index). custom_html opcional override.';

create unique index mail_signatures_user_default_uniq
  on public.mail_signatures (user_id) where is_default = true;
create index mail_signatures_tenant_user_idx
  on public.mail_signatures (tenant_id, user_id);

-- ─── Tabla: mail_logs ────────────────────────────────────────
create table public.mail_logs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  template_id         uuid references public.mail_templates(id) on delete set null,
  template_slug       text,                              -- denorm para no perder ref
  sent_by             uuid references auth.users(id) on delete set null,
  to_email            text not null,
  to_name             text,
  cc                  text[] not null default '{}',
  bcc                 text[] not null default '{}',
  subject             text not null,
  rendered_variables  jsonb not null default '{}'::jsonb,
  status              mail_log_status not null default 'queued',
  resend_message_id   text,                              -- id de Resend
  error               text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  bounced_at          timestamptz,
  complained_at       timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

comment on table public.mail_logs is
  'Append-only log de envíos. INSERT via service_role (server actions). UPDATE via service_role (webhook handler Resend). NO se borra.';

create index mail_logs_tenant_created_idx
  on public.mail_logs (tenant_id, created_at desc);
create index mail_logs_resend_message_id_idx
  on public.mail_logs (resend_message_id) where resend_message_id is not null;
create index mail_logs_status_idx
  on public.mail_logs (status, created_at desc);
create index mail_logs_to_email_idx
  on public.mail_logs (tenant_id, to_email, created_at desc);
create index mail_logs_template_id_fk_idx
  on public.mail_logs (template_id) where template_id is not null;

-- ─── Tabla: mail_rules ───────────────────────────────────────
create table public.mail_rules (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  event               mail_rule_event not null,
  template_id         uuid not null references public.mail_templates(id) on delete cascade,
  recipient_kind      text not null check (recipient_kind in ('client', 'internal', 'custom')),
  recipient_value     text,                              -- email si custom
  active              boolean not null default true,
  last_triggered_at   timestamptz,
  trigger_count       int not null default 0,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, event, template_id, recipient_kind),
  check (
    (recipient_kind = 'custom' and recipient_value is not null)
    or (recipient_kind in ('client', 'internal'))
  )
);

comment on table public.mail_rules is
  'Reglas evento → template. V1 schema + UI. Disparo automático llega en SDD-0021 con pg_net.';

create index mail_rules_tenant_event_active_idx
  on public.mail_rules (tenant_id, event) where active = true;

-- ─── Tabla: mail_config ──────────────────────────────────────
create table public.mail_config (
  tenant_id                   uuid primary key references public.tenants(id) on delete cascade,
  provider                    text not null default 'resend' check (provider in ('resend')),
  from_email                  text not null,
  from_name                   text not null default 'DTD Cargo',
  reply_to                    text,
  daily_limit                 int not null default 1000,
  rate_per_minute             int not null default 30,
  domain_verified             boolean not null default false,
  domain_verification_token   text,
  test_mode                   boolean not null default true,
  internal_test_email         text,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references auth.users(id) on delete set null
);

comment on table public.mail_config is
  '1 row por tenant. test_mode=true redirige TODO envío a internal_test_email para no spamear clientes en dev.';

-- ─── Tabla: mail_blacklist ───────────────────────────────────
create table public.mail_blacklist (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  reason      text not null check (reason in ('bounce', 'complaint', 'manual', 'unsubscribe')),
  added_by    uuid references auth.users(id) on delete set null,
  added_at    timestamptz not null default now(),
  notes       text,
  unique (tenant_id, email)
);

comment on table public.mail_blacklist is
  'Emails bloqueados por tenant. Auto-INSERT desde webhook handler para bounce/complaint. Manual desde UI para casos custom.';

create index mail_blacklist_tenant_email_idx
  on public.mail_blacklist (tenant_id, email);

-- ─── RPC: mail_increment_template_metrics ────────────────────
create or replace function public.mail_increment_template_metrics(
  p_template_id uuid,
  p_field text,
  p_amount int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field not in ('sent', 'opened', 'clicked', 'bounced') then
    raise exception 'Campo inválido: %', p_field using errcode = '22023';
  end if;

  case p_field
    when 'sent' then
      update public.mail_templates set metrics_sent = metrics_sent + p_amount
      where id = p_template_id;
    when 'opened' then
      update public.mail_templates set metrics_opened = metrics_opened + p_amount
      where id = p_template_id;
    when 'clicked' then
      update public.mail_templates set metrics_clicked = metrics_clicked + p_amount
      where id = p_template_id;
    when 'bounced' then
      update public.mail_templates set metrics_bounced = metrics_bounced + p_amount
      where id = p_template_id;
  end case;
end;
$$;

comment on function public.mail_increment_template_metrics is
  'Increment atómico de metrics. Usado por send-email.ts y webhook-handler.ts para evitar race en updates concurrentes.';

-- ─── RPC: mail_check_blacklist ───────────────────────────────
create or replace function public.mail_check_blacklist(
  p_tenant_id uuid,
  p_email text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.mail_blacklist
    where tenant_id = p_tenant_id and lower(email) = lower(p_email)
  );
$$;

comment on function public.mail_check_blacklist is
  'Devuelve true si el email está en blacklist del tenant. Caso-insensitive. Usar pre-envío en send-email.ts.';

-- ─── GRANTs ──────────────────────────────────────────────────
-- mail_templates: read/write a authenticated (RLS filtra tenant)
grant select, insert, update, delete on public.mail_templates to authenticated;

-- mail_signatures: read/write a authenticated (RLS user_id + tenant)
grant select, insert, update, delete on public.mail_signatures to authenticated;

-- mail_logs: SELECT a authenticated (RLS por tenant). INSERT+UPDATE solo
-- service_role (send-email orchestrator + webhook handler).
grant select on public.mail_logs to authenticated;
grant insert, update on public.mail_logs to service_role;

-- mail_rules: read/write a authenticated
grant select, insert, update, delete on public.mail_rules to authenticated;

-- mail_config: SELECT todos los del tenant. UPDATE solo admin (V1 sin
-- check de admin — confiar en quien tiene acceso al Studio). INSERT/DELETE
-- bloqueado (1 row por tenant, se crea en seed).
grant select, update on public.mail_config to authenticated;

-- mail_blacklist: read/write a authenticated. Auto-INSERT desde webhook
-- via service_role queda cubierto por GRANT all también (no necesita
-- GRANT específico al rol).
grant select, insert, delete on public.mail_blacklist to authenticated;

-- RPCs
grant execute on function public.mail_increment_template_metrics(uuid, text, int) to authenticated, service_role;
grant execute on function public.mail_check_blacklist(uuid, text) to authenticated, service_role;

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.mail_templates enable row level security;
alter table public.mail_signatures enable row level security;
alter table public.mail_logs enable row level security;
alter table public.mail_rules enable row level security;
alter table public.mail_config enable row level security;
alter table public.mail_blacklist enable row level security;

-- ── mail_templates: por tenant (pattern DIA3 audit con SELECT wrap) ──
create policy "mail_templates_by_tenant"
  on public.mail_templates for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- ── mail_signatures: por user + tenant check ──
create policy "mail_signatures_owner_select"
  on public.mail_signatures for select to authenticated
  using (
    user_id = (select auth.uid())
    and tenant_id = (select public.get_user_tenant_id())
  );

create policy "mail_signatures_owner_insert"
  on public.mail_signatures for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and tenant_id = (select public.get_user_tenant_id())
  );

create policy "mail_signatures_owner_update"
  on public.mail_signatures for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and tenant_id = (select public.get_user_tenant_id())
  );

create policy "mail_signatures_owner_delete"
  on public.mail_signatures for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── mail_logs: SELECT por tenant. INSERT/UPDATE NO desde authenticated. ──
create policy "mail_logs_tenant_select"
  on public.mail_logs for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "mail_logs_no_insert_authenticated"
  on public.mail_logs for insert to authenticated
  with check (false);

create policy "mail_logs_no_update_authenticated"
  on public.mail_logs for update to authenticated
  using (false);

create policy "mail_logs_no_delete"
  on public.mail_logs for delete
  using (false);

-- ── mail_rules: por tenant ──
create policy "mail_rules_by_tenant"
  on public.mail_rules for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- ── mail_config: por tenant (1 row) ──
create policy "mail_config_by_tenant_select"
  on public.mail_config for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "mail_config_by_tenant_update"
  on public.mail_config for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- ── mail_blacklist: por tenant ──
create policy "mail_blacklist_by_tenant"
  on public.mail_blacklist for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- ─── Seed: mail_config row por cada tenant existente ─────────
-- Defaults seguros: test_mode=true para evitar spamear clientes hasta
-- que el founder confirme el dominio en Resend.
insert into public.mail_config (
  tenant_id,
  from_email,
  from_name,
  reply_to,
  test_mode,
  internal_test_email
)
select
  t.id,
  'noreply@dtdcargo.com',
  'DTD Cargo',
  'comercial@dtdcargo.com',
  true,                                      -- test_mode ON inicial
  'comercial@dtdcargo.com'                   -- redirect destino en test mode
from public.tenants t
on conflict (tenant_id) do nothing;

-- ─── NO se siembran templates aquí ───────────────────────────
-- Los 8 templates iniciales (cotización, factura, embarque, recovery
-- no-olvidar, bienvenida cliente, etc.) se siembran desde TS con UPSERT
-- via scripts/seed-mail-templates.ts. Esto permite:
--   - Source of truth en código (versionable, diffable)
--   - Templates HTML con backticks JS sin tener que escapar SQL
--   - Re-deploy actualiza el body sin migración manual
--
-- Correr post-deploy:
--   pnpm seed
