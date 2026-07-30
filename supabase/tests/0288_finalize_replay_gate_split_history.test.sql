\set ON_ERROR_STOP on

begin;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  statements text[] not null
);

insert into supabase_migrations.schema_migrations (version, name, statements)
values
(
  '20260730002206',
  '0280_repair_sdd0118_split_history',
  array[
    $sdd0118_finalizer_repair_0_0$-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0839e50eeb47a158382fc2f6c27d5fe9', 'c7b1f468087e249e2ca44359aa3f686f')
        )
        or (
          cardinality(statements) = 13
          and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
        )
      )
  ) then
    raise exception '0280 abortada: ledger 0271 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_split_preflight$$sdd0118_finalizer_repair_0_0$,
    $sdd0118_finalizer_repair_0_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_split_patched_0271$-- SDD-0118 · reparar el replay de branches sin ejecutar DDL de negocio.
-- La migración sólo modifica statements del ledger con precondiciones exactas.
-- Los SQL históricos quedan almacenados como texto para futuros replays.
-- 0280 acepta además la fragmentación exacta observada en un branch fresco.
-- 20260526213130 <- 0018_mailing.sql · md5 e2e1b4c3846c7fba431455c9130f0d34
-- 20260527073053 <- 0024_dispatch_core.sql · md5 fc9872ff14733d3d9cac5f0cbb330962
-- 20260527073053 <- 0025_operario_roles_extend.sql · md5 bc9153c31f543e4a74aaa2c570a7aff4
-- 20260528060005 <- 0026_welcome_email_template_seed.sql · md5 b0a7c682cc6031be6034940cb27a5702
-- 20260528060006 <- 0027_qr_print_orders.sql · md5 b760d6196dc02d67036148d33b4ce1f1
-- 20260528060007 <- 0031_fix_studio_invite_gen_random_bytes.sql · md5 8296dce3805f143e549a239995bd954a
-- 20260528060008 <- 0032_fix_studio_invite_ambiguous_token.sql · md5 bb5879cd44f1b5911511e223a0618e51
-- 20260528060009 <- 0033_grant_service_role_policies.sql · md5 a09e03f9f62c47b32ee0a5b4902fa834
-- 20260528060010 <- 0035_fix_verify_operario_pin_extensions.sql · md5 732f8ed961708b91b94cf4965ca8d797
-- 20260528060011 <- 0036_fk_user_tenants_profile.sql · md5 ba63f9c578e32019aaafc8e6d6247056
-- 20260528060012 <- 0037_harden_operario_pin_validator.sql · md5 6e3f5a4763cd32e66a33f189af2da876
-- 20260528060013 <- 0039_fix_bug_advance_state_actor_type_cast.sql · md5 f2872b0ac20dd9e070b14085a60a3fb6

do $sdd0118_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_0_0$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_0_0$
  ] || statements
where version = '20260526213130'
  and name = 'seed_team_invitation_template'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_1_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0029 Fase 1: Módulo Despacho · core (admin web)
--
-- Pipeline 3-actor (Admin/Bodeguero/Camionero) sobre Órdenes de
-- Despacho (ODs). Esta migración cubre SOLO el lado Admin (Fase 1).
-- Las apps móviles de bodeguero+camionero llegan en SDD-0030.
--
-- Cubre:
--   - 6 enums (status OD · hub · payment policy · route type · split reason · incident severity)
--   - Catálogo VE público (ve_locality_catalog): 24 estados · ~98 ciudades · IPOSTEL
--   - 5 tablas per-tenant: dispatch_orders · dispatch_order_packages
--                          dispatch_routes · dispatch_city_catalog
--                          dispatch_rules
--   - Extensión aditiva: warehouse_receipts_cn.description NULLABLE
--     (Wang Hua YIW-A1 y el wizard /m/cn/nueva siguen idénticos)
--   - 4 RPCs: next_dispatch_order_code · next_route_code
--             upsert_dispatch_rules · seed_tenant_cities_from_ve_catalog
--   - Trigger guard de transición de status
--   - RLS por tenant_id en las 5 tablas privadas
--
-- 100% aditivo y no destructivo. Catálogo VE es global (sin RLS, solo lectura).
-- ─────────────────────────────────────────────────────────────

-- ── ENUMS ────────────────────────────────────────────────────

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- ─────────────────────────────────────────────────────────────
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
-- ─────────────────────────────────────────────────────────────

create table public.ve_locality_catalog (
  state_code      text not null,             -- 'CAR'
  state_name      text not null,             -- 'Carabobo'
  state_region    text not null,             -- 'Centro'
  state_capital   text not null,
  municipio       text not null,             -- 'Valencia'
  city            text not null,             -- 'Valencia'
  postal_code     text not null,             -- '2001' (IPOSTEL)
  parroquias      text[] not null default '{}',
  barrios         text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant.';

create index ve_locality_catalog_postal_idx
  on public.ve_locality_catalog (postal_code);

create index ve_locality_catalog_region_idx
  on public.ve_locality_catalog (state_region);

grant select on public.ve_locality_catalog to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed catálogo VE (24 estados · ~98 ciudades · IPOSTEL)
-- ─────────────────────────────────────────────────────────────

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code, parroquias, barrios)
values
  -- Distrito Capital
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Centro)', '1010', ARRAY['Catedral','San José','La Pastora','El Recreo'], ARRAY['El Silencio','San Bernardino','Cotiza','La Candelaria']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Oeste)',  '1020', ARRAY['Antímano','Caricuao','La Vega','Macarao'], ARRAY['Caricuao','Antímano','La Yaguara']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Sur)',    '1080', ARRAY['El Valle','Coche','Santa Rosalía'], ARRAY['El Valle','Coche','Las Acacias']),

  -- Caracas Metropolitana (virtual · 4 alcaldías)
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Chacao',     'Chacao (Caracas)',  '1060', ARRAY['Chacao'], ARRAY['Chacao','La Castellana','Country Club','Altamira']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Baruta',     'Baruta (Caracas)',  '1080', ARRAY['Baruta','El Cafetal','Las Minas'], ARRAY['Las Mercedes','Santa Mónica','Sorocaima']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Sucre',      'Petare',            '1070', ARRAY['Petare','Caucagüita','Filas de Mariche','La Dolorita','Leoncio Martínez'], ARRAY['Petare','Mariperez','Cumbres de Curumo']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'El Hatillo', 'El Hatillo',        '1083', ARRAY['El Hatillo'], ARRAY['El Hatillo','La Lagunita','Oripoto']),

  -- Amazonas
  ('AMA', 'Amazonas', 'Guayana', 'Puerto Ayacucho', 'Atures', 'Puerto Ayacucho', '7101', ARRAY['Atures'], ARRAY['Centro']),

  -- Anzoátegui
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Simón Bolívar',              'Barcelona',         '6001', ARRAY['Bergantín','El Carmen','San Cristóbal'], ARRAY['Centro','Boyacá']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Sotillo',                    'Puerto La Cruz',    '6023', ARRAY['Pozuelos'], ARRAY['Centro','Lechería']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Diego Bautista Urbaneja',    'Lechería',          '6016', ARRAY['Lechería'], ARRAY['Lechería','El Morro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Anaco',                      'Anaco',             '6003', ARRAY['Anaco'], ARRAY['Centro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Pedro María Freites',        'Cantaura',          '6004', ARRAY['Cantaura'], ARRAY[]::text[]),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Independencia',              'Soledad',           '6010', ARRAY['Mamo'], ARRAY[]::text[]),

  -- Apure
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'San Fernando', 'San Fernando de Apure', '7001', ARRAY['San Fernando'], ARRAY['Centro']),
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'Páez',         'Guasdualito',           '7011', ARRAY['Guasdualito'], ARRAY[]::text[]),

  -- Aragua
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Girardot',                  'Maracay',     '2101', ARRAY['Las Delicias','José Casanova Godoy','Joaquín Crespo'], ARRAY['San Jacinto','Las Delicias','El Castaño','Caña de Azúcar','La Soledad']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Mario Briceño Iragorry',    'El Limón',    '2105', ARRAY['Caña de Azúcar'], ARRAY['El Limón']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Santiago Mariño',           'Turmero',     '2115', ARRAY['Turmero'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Sucre',                     'Cagua',       '2122', ARRAY['Cagua'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'José Ángel Lamas',          'Santa Cruz',  '2128', ARRAY['Santa Cruz'], ARRAY[]::text[]),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Linares Alcántara',         'Santa Rita',  '2123', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Barinas
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Barinas',                    'Barinas', '5201', ARRAY['Barinas','Alto Barinas'], ARRAY['Centro','Alto Barinas']),
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Antonio José de Sucre',      'Socopó',  '5212', ARRAY['Socopó'], ARRAY[]::text[]),

  -- Bolívar
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Heres',  'Ciudad Bolívar',                 '8001', ARRAY['Catedral','Vista Hermosa'], ARRAY['Centro','Vista Hermosa','Sabana del Hueso']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Caroní', 'Ciudad Guayana / Puerto Ordaz',  '8050', ARRAY['Cachamay','Universidad','Unare','Vista al Sol','Once de Abril'], ARRAY['Alta Vista','Castillito','Los Olivos','Villa Bolívar']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Piar',   'Upata',                          '8021', ARRAY['Upata'], ARRAY['Centro']),

  -- Carabobo
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia',       'Valencia',       '2001', ARRAY['San José','San Blas','Catedral','Candelaria'], ARRAY['El Viñedo','Trigal Norte','San José','Prebo','El Recreo','La Granja']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Naguanagua',     'Naguanagua',     '2005', ARRAY['Naguanagua'], ARRAY['Mañongo','La Granja','Bárbula']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'San Diego',      'San Diego',      '2006', ARRAY['San Diego'], ARRAY['Yuma','Castillito']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Los Guayos',     'Los Guayos',     '2014', ARRAY['Los Guayos'], ARRAY[]::text[]),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Guacara',        'Guacara',        '2015', ARRAY['Guacara'], ARRAY['Centro']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Puerto Cabello', 'Puerto Cabello', '2050', ARRAY['Fraternidad','Bartolomé Salom','Goaigoaza'], ARRAY['Centro','Cumboto']),

  -- Cojedes
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Ezequiel Zamora', 'San Carlos',  '2201', ARRAY['San Carlos'], ARRAY['Centro']),
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Tinaquillo',      'Tinaquillo',  '2204', ARRAY['Tinaquillo'], ARRAY['Centro']),

  -- Delta Amacuro
  ('DEL', 'Delta Amacuro', 'Guayana', 'Tucupita', 'Tucupita', 'Tucupita', '9001', ARRAY['Tucupita'], ARRAY['Centro']),

  -- Falcón
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Miranda',     'Coro',                       '4101', ARRAY['Santa Ana','San Antonio'], ARRAY['Centro','Cruz Verde','Curazaito']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Carirubana',  'Punto Fijo',                 '4102', ARRAY['Carirubana','Norte','Punta Cardón'], ARRAY['Centro','Las Pioneras','Cardón']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Los Taques',  'Santa Cruz de Los Taques',   '4106', ARRAY['Los Taques'], ARRAY[]::text[]),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Federación',  'Churuguara',                 '4115', ARRAY['Churuguara'], ARRAY[]::text[]),

  -- Guárico
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Juan Germán Roscio',     'San Juan de los Morros',  '2301', ARRAY['San Juan'], ARRAY['Casco Central','Pariata','La Toscana']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Francisco de Miranda',   'Calabozo',                '2312', ARRAY['Calabozo'], ARRAY['Centro']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Camaguán',               'Camaguán',                '2317', ARRAY['Camaguán'], ARRAY[]::text[]),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'José Tadeo Monagas',     'Altagracia de Orituco',   '2304', ARRAY['Altagracia'], ARRAY[]::text[]),

  -- La Guaira
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'La Guaira',     '1163', ARRAY['Catia La Mar','Maiquetía','La Guaira'], ARRAY['Maiquetía','Macuto']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Catia La Mar',  '1162', ARRAY['Catia La Mar'], ARRAY['Centro','Puerto Viejo']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Maiquetía',     '1161', ARRAY['Maiquetía'], ARRAY['Centro']),

  -- Lara
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Iribarren',  'Barquisimeto', '3001', ARRAY['Catedral','Concepción','Tamaca','El Cuji'], ARRAY['Centro','El Tostado','Las Trinitarias','Patarata']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Palavecino', 'Cabudare',     '3023', ARRAY['Cabudare'], ARRAY['Centro']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Crespo',     'Duaca',        '3050', ARRAY['Duaca'], ARRAY[]::text[]),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Torres',     'Carora',       '3040', ARRAY['Carora'], ARRAY['Centro']),

  -- Mérida
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Libertador',       'Mérida',     '5101', ARRAY['El Llano','Milla','Domingo Peña','Mariano Picón Salas'], ARRAY['La Hechicera','Belensate','Glorias Patrias','Mérida Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Campo Elías',      'Ejido',      '5113', ARRAY['Ejido'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Tovar',            'Tovar',      '5131', ARRAY['Tovar'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Alberto Adriani',  'El Vigía',   '5145', ARRAY['El Vigía'], ARRAY['Centro']),

  -- Miranda
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Guaicaipuro',     'Los Teques',        '1201', ARRAY['Los Teques','San Pedro'], ARRAY['Centro','San Pedro','Lomas de Urquía']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Plaza',           'Guarenas',          '1220', ARRAY['Guarenas'], ARRAY['Centro','Camatagua']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Zamora',          'Guatire',           '1221', ARRAY['Guatire'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Cristóbal Rojas', 'Charallave',        '1210', ARRAY['Charallave'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Urdaneta',        'Cúa',               '1213', ARRAY['Cúa'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Brión',           'Higuerote',         '1240', ARRAY['Higuerote'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Lander',          'Ocumare del Tuy',   '1211', ARRAY['Ocumare'], ARRAY['Centro']),

  -- Monagas
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Maturín',   'Maturín',     '6201', ARRAY['San Simón','San Vicente','Las Cocuizas'], ARRAY['La Floresta','Tipuro','Las Avenidas','Los Pinos']),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Caripe',    'Caripe',      '6225', ARRAY['Caripe'], ARRAY[]::text[]),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Punceres',  'Quiriquire',  '6213', ARRAY['Quiriquire'], ARRAY[]::text[]),

  -- Nueva Esparta
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Arismendi', 'La Asunción', '6301', ARRAY['La Asunción'], ARRAY['Centro']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Mariño',    'Porlamar',    '6313', ARRAY['Porlamar'], ARRAY['Centro','4 de Mayo','Genovés']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Maneiro',   'Pampatar',    '6315', ARRAY['Pampatar'], ARRAY['Centro','La Caranta']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Gómez',     'Santa Ana',   '6311', ARRAY['Santa Ana'], ARRAY[]::text[]),

  -- Portuguesa
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Guanare', 'Guanare',  '3322', ARRAY['Guanare','San Juan de Guanaguanare'], ARRAY['Centro','Mesa de Cavacas']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Páez',    'Acarigua', '3301', ARRAY['Acarigua'], ARRAY['Centro','Bolívar']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Araure',  'Araure',   '3303', ARRAY['Araure'], ARRAY['Centro']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Sucre',   'Biscucuy', '3330', ARRAY['Biscucuy'], ARRAY[]::text[]),

  -- Sucre
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Sucre',    'Cumaná',       '6101', ARRAY['Altagracia','Santa Inés','Valentín Valiente','Ayacucho'], ARRAY['Centro','Boca de Sabana','Los Tarales']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Bermúdez', 'Carúpano',     '6150', ARRAY['Santa Rosa','Santa Catalina'], ARRAY['Centro']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Cajigal',  'Yaguaraparo',  '6173', ARRAY['Yaguaraparo'], ARRAY[]::text[]),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Valdez',   'Güiria',       '6164', ARRAY['Güiria'], ARRAY[]::text[]),

  -- Táchira
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'San Cristóbal',         'San Cristóbal',              '5001', ARRAY['La Concordia','Pedro María Morantes','San Juan Bautista'], ARRAY['Centro','Pirineos','Las Lomas']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Cárdenas',              'Táriba',                     '5009', ARRAY['Táriba'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Bolívar',               'San Antonio del Táchira',    '5004', ARRAY['San Antonio'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Pedro María Ureña',     'Ureña',                      '5005', ARRAY['Ureña'], ARRAY[]::text[]),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Junín',                 'Rubio',                      '5030', ARRAY['Rubio'], ARRAY['Centro']),

  -- Trujillo
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Trujillo', 'Trujillo', '3101', ARRAY['Trujillo'], ARRAY['Centro']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Valera',   'Valera',   '3102', ARRAY['Valera','Mendoza'], ARRAY['Centro','La Plata','Plata III']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Boconó',   'Boconó',   '3104', ARRAY['Boconó'], ARRAY['Centro']),

  -- Yaracuy
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'San Felipe',    'San Felipe',    '3201', ARRAY['San Felipe','Albarico'], ARRAY['Centro','La Trinidad']),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Independencia', 'Independencia', '3206', ARRAY['Independencia'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Veroes',        'Farriar',       '3214', ARRAY['Farriar'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Bolívar',       'Aroa',          '3211', ARRAY['Aroa'], ARRAY[]::text[]),

  -- Zulia
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Maracaibo',              'Maracaibo',                '4001', ARRAY['Chiquinquirá','Coquivacoa','Cristo de Aranza','Bolívar','Santa Lucía'], ARRAY['Bella Vista','Tierra Negra','El Milagro','Indio Mara','Sabaneta']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'San Francisco',          'San Francisco',            '4002', ARRAY['San Francisco','Marcial Hernández'], ARRAY['Sierra Maestra','San Francisco Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Cabimas',                'Cabimas',                  '4013', ARRAY['Cabimas','Punta Gorda','Ambrosio'], ARRAY['Centro','Las Cabillas','La Rosa']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Lagunillas',             'Ciudad Ojeda',             '4019', ARRAY['Ciudad Ojeda'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Mara',                   'San Rafael del Moján',     '4012', ARRAY['Mara'], ARRAY[]::text[]),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Machiques de Perijá',    'Machiques',                '4045', ARRAY['Machiques'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Santa Rita',             'Santa Rita',               '4030', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Dependencias Federales
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'Los Roques',  'Gran Roque',  '1990', ARRAY[]::text[], ARRAY[]::text[]),
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'La Tortuga',  'Tortuga',     '1990', ARRAY[]::text[], ARRAY[]::text[]);

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_routes (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);

comment on table public.dispatch_routes is
  'Catálogo de rutas operativas per-tenant. Directa (origen→destino) o intermedias (con ciudades intermedias en jsonb). RLS por tenant. Soft-delete.';

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub)
  where deleted_at is null and active = true;

create index dispatch_routes_tenant_active_idx
  on public.dispatch_routes (tenant_id, active)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. dispatch_city_catalog (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

comment on table public.dispatch_city_catalog is
  'Catálogo de ciudades per-tenant. Se popula la primera vez con seed_tenant_cities_from_ve_catalog(). Tenant puede agregar ciudades custom o marcar is_hq.';

create index dispatch_city_catalog_tenant_active_idx
  on public.dispatch_city_catalog (tenant_id)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. dispatch_rules (1 row por tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring por tenant. 1 row por tenant. Editable desde /studio/despacho/reglas. Defaults aplicados si no existe row.';

-- ─────────────────────────────────────────────────────────────
-- 5. dispatch_orders (entidad central)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);

comment on table public.dispatch_orders is
  'Órdenes de Despacho (ODs). Entidad central del pipeline 3-actor. State machine cerrada (creada→cargando→lista→en_ruta→entregada→cerrada, terminal cancelada). Code OD-YYYY-NNNN.';

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status)
  where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_active_idx
  on public.dispatch_orders (tenant_id, driver_id)
  where status = 'lista';

create index dispatch_orders_parent_idx
  on public.dispatch_orders (parent_od_id)
  where parent_od_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 6. dispatch_order_packages (junction OD ↔ paquetes)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);

comment on table public.dispatch_order_packages is
  'Junction OD ↔ paquetes. Soporta carga fraccionada (boxes_shipped < boxes_total) con motivo obligatorio. FK polimórfico via package_kind + package_id (FK explícito en Fase 2 SDD-0030).';

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);

create index dispatch_order_packages_package_idx
  on public.dispatch_order_packages (package_kind, package_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Extensión aditiva: warehouse_receipts_cn.description NULLABLE
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE) + chofer entrega. NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá NOT NULL con 5to step opcional.';

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs
-- ─────────────────────────────────────────────────────────────

-- 8.1 · next_dispatch_order_code: secuencial OD-YYYY-NNNN por tenant
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_dispatch_order_code(uuid) is
  'Genera el próximo código OD-YYYY-NNNN para el tenant. Verifica que auth.uid() esté en user_tenants.';

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;

-- 8.2 · next_route_code: secuencial R-NNN por tenant (sin año)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(route_code from 'R-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-%';

  v_next := 'R-' || lpad((v_max + 1)::text, 3, '0');
  return v_next;
end;
$$;

comment on function public.next_route_code(uuid) is
  'Genera el próximo código R-NNN para el tenant. Verifica autorización.';

grant execute on function public.next_route_code(uuid) to authenticated;

-- 8.3 · upsert_dispatch_rules: idempotente, last-write-wins
create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes, updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules. Last-write-wins, sin lock optimista en Fase 1.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;

-- 8.4 · seed_tenant_cities_from_ve_catalog: copia inicial del catálogo público
create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ~98 ciudades del catálogo VE público a dispatch_city_catalog del tenant. Devuelve cuántas filas se insertaron (0 si ya estaban).';

grant execute on function public.seed_tenant_cities_from_ve_catalog(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger guard de transición de status
-- ─────────────────────────────────────────────────────────────

create or replace function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido modificar status desde terminales
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- entregada solo puede ir a cerrada
    if old.status = 'entregada' and new.status not in ('cerrada') then
      raise exception 'Desde entregada solo se puede ir a cerrada (intentado: %)', new.status;
    end if;

    -- lista no puede retroceder a cargando
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;

    -- en_ruta no puede retroceder a lista
    if old.status = 'en_ruta' and new.status = 'lista' then
      raise exception 'No se puede retroceder de en_ruta a lista';
    end if;

    -- Auto-stamp timestamps
    if new.status = 'en_ruta' and new.departed_at is null then
      new.departed_at := now();
    elsif new.status = 'entregada' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cerrada' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();

-- ─────────────────────────────────────────────────────────────
-- 10. RLS · tenant isolation
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- dispatch_orders: select + insert + update + delete via tenant_id
create policy dispatch_orders_select on public.dispatch_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_insert on public.dispatch_orders
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_update on public.dispatch_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_delete on public.dispatch_orders
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_order_packages: tenant via JOIN al OD
create policy dispatch_order_packages_select on public.dispatch_order_packages
  for select using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_insert on public.dispatch_order_packages
  for insert with check (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_update on public.dispatch_order_packages
  for update using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_delete on public.dispatch_order_packages
  for delete using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

-- dispatch_routes
create policy dispatch_routes_select on public.dispatch_routes
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_insert on public.dispatch_routes
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_update on public.dispatch_routes
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_delete on public.dispatch_routes
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_city_catalog
create policy dispatch_city_catalog_select on public.dispatch_city_catalog
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_insert on public.dispatch_city_catalog
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_update on public.dispatch_city_catalog
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_delete on public.dispatch_city_catalog
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_rules
create policy dispatch_rules_select on public.dispatch_rules
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_insert on public.dispatch_rules
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_update on public.dispatch_rules
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_packages to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_city_catalog to authenticated;
grant select, insert, update on public.dispatch_rules to authenticated;
$sdd0118_1_0$,
    $sdd0118_1_1$-- ─────────────────────────────────────────────────────────────
-- SDD-0030 Fase 2: Apps móviles bodeguero VE + camionero VE
--
-- Extiende operario_pins.role para soportar los 2 roles nuevos del
-- pipeline de Despacho (bodeguero arma camiones, camionero entrega).
-- + Tabla dispatch_pods (proofs of delivery).
-- + 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
--   camionero_advance_od · camionero_pod
-- + Update verify_operario_pin para devolver region.
--
-- 100% aditivo. NO toca operarios CN existentes (Wang Hua YIW-A1 sigue
-- idéntica · role='operario', region='cn').
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Extender CHECK constraint del role
-- ─────────────────────────────────────────────────────────────

alter table public.operario_pins drop constraint operario_pins_role_check;

alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );

comment on column public.operario_pins.role is
  'Rol del operario · operario|supervisor (CN almacén) o bodeguero|camionero (VE despacho). Bodeguero arma camiones; camionero entrega. SDD-0030.';

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla dispatch_pods (proofs of delivery)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

comment on table public.dispatch_pods is
  'Proofs of Delivery (POD) de Órdenes de Despacho. 1 fila por entrega confirmada por el camionero PWA. Photo + signature paths apuntan al bucket receipt-photos con prefijos pod/ y firma/.';

create index dispatch_pods_od_idx
  on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx
  on public.dispatch_pods (tenant_id, created_at desc);

alter table public.dispatch_pods enable row level security;

-- Admins del tenant pueden leer todos los PODs (consulta auditable)
create policy dispatch_pods_select on public.dispatch_pods
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- Inserts vienen via RPC (security definer · service_role bypass)
-- No exponemos insert a authenticated.

grant select on public.dispatch_pods to authenticated;
grant select, insert, update, delete on public.dispatch_pods to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Update RPC verify_operario_pin · agregar region en el return
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,             -- nullable desde SDD-0023 (chofer/bodeguero VE no necesariamente)
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region   -- NUEVO en SDD-0030
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030 extiende SDD-0027.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC bodeguero_advance_od
--
-- Transiciones permitidas para el bodeguero:
--   creada → cargando        (al abrir la OD)
--   cargando → lista         ("Cerrar carga")
--
-- Validaciones:
--   - operario activo + role='bodeguero' (o supervisor VE legacy)
--   - OD existe + tenant match
--   - Transición permitida por trigger guard (deja que el trigger valide)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE pueden actuar sobre Despacho' using errcode = 'P0003';
  end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede avanzar carga' using errcode = 'P0004';
  end if;

  -- 2. Validar OD tenant
  select tenant_id into v_od_tenant
    from public.dispatch_orders
   where id = p_od_id;

  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 3. Validar transición esperada (whitelist bodeguero)
  if p_status not in ('cargando', 'lista') then
    raise exception 'Transición % no permitida para bodeguero', p_status using errcode = 'P0007';
  end if;

  -- 4. Update (trigger guard valida la transición real desde el current)
  update public.dispatch_orders
     set status = p_status,
         updated_by = null,                    -- operario no tiene auth.uid
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status) is
  'Advance OD desde la PWA del bodeguero. Solo permite creada→cargando→lista. Resto bloqueado por el trigger guard.';

revoke all on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  from public, anon, authenticated;
grant execute on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC bodeguero_split_p2
--
-- Fracciona un paquete: actualiza la fila junction existente con
-- boxes_shipped < boxes_total y motivo, y crea una OD nueva (P2)
-- con parent_od_id apuntando a la P1.
--
-- La P2 queda con status='creada' sin camión/chofer (admin la asigna).
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_split_p2(
  p_operario_id        uuid,
  p_od_id              uuid,
  p_package_id         uuid,
  p_boxes_shipped      int,
  p_split_reason       dispatch_split_reason,
  p_split_reason_text  text
)
returns uuid           -- id de la OD P2 creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_role           text;
  v_region         operario_region;
  v_active         boolean;
  v_pkg            public.dispatch_order_packages%rowtype;
  v_od             public.dispatch_orders%rowtype;
  v_remaining      int;
  v_new_od_id      uuid;
  v_new_code       text;
begin
  -- 1. Validar operario (igual pattern que bodeguero_advance_od)
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede fraccionar' using errcode = 'P0004';
  end if;

  -- 2. Lock + leer el paquete
  select * into v_pkg
    from public.dispatch_order_packages
   where od_id = p_od_id and package_id = p_package_id
   for update;
  if v_pkg.od_id is null then
    raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
  end if;

  -- 3. Validar boxes_shipped
  if p_boxes_shipped <= 0 or p_boxes_shipped >= v_pkg.boxes_total then
    raise exception 'boxes_shipped debe estar entre 1 y boxes_total-1' using errcode = 'P0009';
  end if;

  v_remaining := v_pkg.boxes_total - p_boxes_shipped;

  -- 4. Validar OD tenant
  select * into v_od from public.dispatch_orders where id = p_od_id;
  if v_od.tenant_id <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 5. Update el junction P1: boxes_shipped + motivo
  update public.dispatch_order_packages
     set boxes_shipped = p_boxes_shipped,
         split_reason = p_split_reason,
         split_reason_text = p_split_reason_text
   where od_id = p_od_id and package_id = p_package_id;

  -- 6. Generar code P2 via RPC (no llamamos next_dispatch_order_code porque
  --    chequea auth.uid; usamos la lógica inline acá)
  declare
    v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
    v_max  int;
  begin
    select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
      into v_max
      from public.dispatch_orders
     where tenant_id = v_tenant_id
       and order_code like 'OD-' || v_year || '-%';
    v_new_code := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  end;

  -- 7. Crear OD P2 (sin camión/chofer · status='creada')
  insert into public.dispatch_orders (
    tenant_id, order_code, status, hub,
    route_id, truck_id, driver_id,
    total_kg, total_cbm, package_count,
    cities_ordered,
    parent_od_id
  ) values (
    v_tenant_id,
    v_new_code,
    'creada',
    v_od.hub,
    v_od.route_id,
    null,                                              -- admin reasigna
    null,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    1,
    array[v_pkg.city]::text[],
    p_od_id
  )
  returning id into v_new_od_id;

  -- 8. Insertar junction de la P2
  insert into public.dispatch_order_packages (
    od_id, package_kind, package_id, markbox, client_name, city, pay,
    description, boxes_total, boxes_shipped, weight_kg, cbm,
    hs_code, aes_code
  ) values (
    v_new_od_id, v_pkg.package_kind, v_pkg.package_id, v_pkg.markbox,
    v_pkg.client_name, v_pkg.city, v_pkg.pay,
    v_pkg.description, v_remaining, v_remaining,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    v_pkg.hs_code, v_pkg.aes_code
  );

  return v_new_od_id;
end;
$$;

comment on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text) is
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC camionero_advance_od
--
-- Transiciones permitidas para el camionero:
--   lista → en_ruta         ("Iniciar ruta")
--   en_ruta → entregada     (cuando hizo la última POD)
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status,
  p_progress       int,
  p_current_city   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
     set status = p_status,
         progress_pct = coalesce(p_progress, progress_pct),
         current_city = coalesce(p_current_city, current_city),
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.camionero_advance_od is
  'Advance OD desde la PWA del camionero. Solo permite lista→en_ruta y en_ruta→entregada.';

revoke all on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC camionero_pod
--
-- Crea fila dispatch_pods con foto/firma/receptor. No cambia status
-- automáticamente — eso lo hace camionero_advance_od cuando es la
-- última entrega.
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text
)
returns uuid          -- id del POD creado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod is
  'Confirma POD (Proof of Delivery) de una entrega: foto + firma + receptor. Llamada desde la PWA del camionero.';

revoke all on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
$sdd0118_1_1$
  ] || statements
where version = '20260527073053'
  and name = 'realtime_dispatch'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_2_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0032: Seed del template "Bienvenida MARKBOX" (welcome_markbox)
--
-- Upsert idempotente del template para todos los tenants existentes.
-- Si más tenants se crean después, agregar trigger o seed en alta de tenant.
--
-- Usado por:
--   - sendWelcomeEmailAction (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--
-- Schema base: mail_templates (SDD-0026, migración 0018_mailing.sql).
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'welcome_markbox',
      'Bienvenida MARKBOX',
      'cliente',
      'email',
      'Bienvenido a DTD Cargo · tu código es {{markbox}}',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu código MARKBOX:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Servicio puerta a puerta China-Venezuela</p>
</div>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox seedado por SDD-0032 para email de bienvenida automático al crear cliente con email.';
$sdd0118_2_0$
  ]
where version = '20260528060005'
  and name = '0026_welcome_email_template_seed'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_3_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0033: Cola de impresión QR · vista oficina
--
-- Tabla qr_print_orders que recibe órdenes del operario CN PWA
-- (push via RPC con cookie HTTP-only) y consume admin web en
-- /studio/cola-qr para imprimir + marcar entregado.
--
-- 2 enums + 1 tabla + 2 RPCs (next code + push as operario) +
-- trigger guard de transición + RLS por tenant + Realtime ready.
-- ─────────────────────────────────────────────────────────────

-- ENUMS

create type qr_order_status as enum (
  'pendiente',
  'imprimiendo',
  'impreso',
  'entregado',
  'cancelado'
);

create type qr_order_priority as enum ('urgent', 'normal');

-- ─────────────────────────────────────────────────────────────
-- Tabla qr_print_orders
-- ─────────────────────────────────────────────────────────────

create table public.qr_print_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  order_code               text not null,                                     -- 'QR-2026-0142'
  warehouse_id             uuid references public.warehouses_cn(id),
  markbox                  text not null,
  client_name              text not null,                                     -- denorm
  supplier_name            text,
  bultos                   int not null check (bultos > 0),

  -- Quién la mandó
  sent_by_operario_id      uuid references public.operario_pins(id) on delete set null,
  sent_by_name             text not null,                                     -- denorm snapshot
  sent_by_phone            text,
  sent_at                  timestamptz not null default now(),

  -- Estado
  priority                 qr_order_priority not null default 'normal',
  status                   qr_order_status not null default 'pendiente',
  assigned_printer         text,                                              -- label libre · sin tabla printers V1

  -- Lifecycle
  printed_at               timestamptz,
  printed_by               uuid references auth.users(id) on delete set null,
  delivered_at             timestamptz,
  delivered_by             uuid references auth.users(id) on delete set null,
  cancelled_at             timestamptz,
  cancelled_by             uuid references auth.users(id) on delete set null,
  cancel_reason            text,

  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (tenant_id, order_code)
);

comment on table public.qr_print_orders is
  'Cola de impresión de QR. Operario CN pushea via RPC (cookie HTTP-only · sin auth.uid). Admin web consume en /studio/cola-qr y marca como impreso/entregado.';

create index qr_print_orders_tenant_status_idx
  on public.qr_print_orders (tenant_id, status, sent_at desc)
  where status not in ('entregado', 'cancelado');

create index qr_print_orders_tenant_all_idx
  on public.qr_print_orders (tenant_id, sent_at desc);

create index qr_print_orders_markbox_idx
  on public.qr_print_orders (tenant_id, markbox, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC next_qr_order_code · secuencial QR-YYYY-NNNN por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_qr_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max  int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    -- También permitir service_role (operario · sin auth.uid)
    if auth.uid() is not null then
      raise exception 'No autorizado para tenant %', p_tenant_id;
    end if;
  end if;

  select coalesce(max((substring(order_code from 'QR-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.qr_print_orders
  where tenant_id = p_tenant_id
    and order_code like 'QR-' || v_year || '-%';

  return 'QR-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;

comment on function public.next_qr_order_code(uuid) is
  'Genera próximo QR-YYYY-NNNN para el tenant. Mismo patrón que next_dispatch_order_code. Permite caller con auth.uid o service_role.';

grant execute on function public.next_qr_order_code(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC push_qr_order_as_operario
--
-- Llamado desde server action /m/cn/* con service_role. Recibe
-- operario_id (de cookie HTTP-only) y crea la orden con status
-- 'pendiente'. Denormaliza display_name y phone del operario.
-- ─────────────────────────────────────────────────────────────

create or replace function public.push_qr_order_as_operario(
  p_operario_id     uuid,
  p_warehouse_id    uuid,                              -- nullable · puede sacarse del operario
  p_markbox         text,
  p_client_name     text,
  p_supplier_name   text,
  p_bultos          int,
  p_priority        qr_order_priority,
  p_notes           text
)
returns table (
  id          uuid,
  order_code  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_active     boolean;
  v_op_name    text;
  v_op_phone   text;
  v_wh_id      uuid;
  v_code       text;
  v_new_id     uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, active, display_name, last_login_at
    into v_tenant_id, v_role, v_active, v_op_name, v_op_phone
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Sanity
  if p_markbox is null or length(trim(p_markbox)) = 0 then
    raise exception 'markbox requerido' using errcode = 'P0003';
  end if;
  if p_bultos is null or p_bultos <= 0 then
    raise exception 'bultos debe ser > 0' using errcode = 'P0004';
  end if;

  -- 3. Warehouse: si no vino, lee el del operario
  if p_warehouse_id is null then
    select warehouse_id into v_wh_id
      from public.operario_pins where id = p_operario_id;
  else
    v_wh_id := p_warehouse_id;
  end if;

  -- 4. Generar code
  v_code := public.next_qr_order_code(v_tenant_id);

  -- 5. Insert
  insert into public.qr_print_orders (
    tenant_id, order_code, warehouse_id,
    markbox, client_name, supplier_name, bultos,
    sent_by_operario_id, sent_by_name, sent_by_phone,
    priority, status, notes
  ) values (
    v_tenant_id, v_code, v_wh_id,
    trim(p_markbox), trim(coalesce(p_client_name, '—')),
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_bultos,
    p_operario_id, v_op_name, nullif(trim(coalesce(v_op_phone, '')), ''),
    coalesce(p_priority, 'normal'),
    'pendiente',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning qr_print_orders.id into v_new_id;

  return query select v_new_id, v_code;
end;
$$;

comment on function public.push_qr_order_as_operario is
  'Operario CN pushea una orden de impresión desde el PWA /m/cn. security definer · invocado con service_role desde server action.';

revoke all on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) from public, anon, authenticated;
grant execute on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Trigger guard de transición
-- ─────────────────────────────────────────────────────────────

create or replace function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido desde terminal
    if old.status in ('entregado', 'cancelado') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- impreso solo puede ir a entregado o cancelado
    if old.status = 'impreso' and new.status not in ('entregado', 'cancelado') then
      raise exception 'Desde impreso solo se puede ir a entregado o cancelado';
    end if;

    -- imprimiendo no puede retroceder a pendiente
    if old.status = 'imprimiendo' and new.status = 'pendiente' then
      raise exception 'No se puede retroceder de imprimiendo a pendiente';
    end if;

    -- Auto-stamp
    if new.status = 'impreso' and new.printed_at is null then
      new.printed_at := now();
      new.printed_by := coalesce(new.printed_by, auth.uid());
    elsif new.status = 'entregado' and new.delivered_at is null then
      new.delivered_at := now();
      new.delivered_by := coalesce(new.delivered_by, auth.uid());
    elsif new.status = 'cancelado' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger qr_print_orders_status_guard
  before update on public.qr_print_orders
  for each row execute function public.qr_print_orders_status_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders enable row level security;

create policy qr_print_orders_select on public.qr_print_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy qr_print_orders_update on public.qr_print_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- INSERT NO desde authenticated · solo service_role (vía push_qr_order_as_operario)
create policy qr_print_orders_no_insert_auth on public.qr_print_orders
  for insert to authenticated with check (false);

-- DELETE NO desde authenticated · admin cancela cambiando status
create policy qr_print_orders_no_delete_auth on public.qr_print_orders
  for delete to authenticated using (false);

grant select, update on public.qr_print_orders to authenticated;
grant select, insert, update, delete on public.qr_print_orders to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (V2: cliente se suscribe al channel)
-- ─────────────────────────────────────────────────────────────

-- Agregar tabla a la publicación si la pub existe (Supabase la crea por default)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.qr_print_orders';
  end if;
exception when others then
  raise notice 'No se pudo agregar qr_print_orders a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
$sdd0118_3_0$
  ]
where version = '20260528060006'
  and name = '0027_qr_print_orders'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_4_0$-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_4_0$
  ]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_5_0$-- 0032_fix_studio_invite_ambiguous_token.sql
--
-- Fix bug: studio_invite_user falla con "column reference 'token' is ambiguous"
-- porque el RETURNS TABLE (invitation_id uuid, token text) declara una OUTPUT
-- column llamada `token` que clashea con la columna real
-- public.user_invitations.token en el RETURNING.
--
-- Detectado 2026-05-26 inmediatamente después de aplicar 0031 (gen_random_bytes
-- qualifier fix). Cuando se hizo el primer test real de invitación.
--
-- Fix: qualificar user_invitations.token en el RETURNING.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- FIX 0032: qualificar user_invitations.token en RETURNING porque
  -- el RETURNS TABLE declara una output column 'token' que clashea.
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_5_0$
  ]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_6_0$-- 0033_grant_service_role_policies.sql
--
-- Fix raíz: tablas mail_* y user_* del Studio fueron creadas SIN
-- GRANT base a service_role. Las policies para authenticated existían
-- pero PostgREST rechazaba al admin client antes incluso de evaluar RLS
-- porque service_role no tenía siquiera SELECT/INSERT permission.
--
-- Hint literal de PostgreSQL al hacer SELECT con service_role:
--   "permission denied for table mail_config
--    HINT: Grant the required privileges to the current role with:
--    GRANT SELECT ON public.mail_config TO service_role;"
--
-- Sin GRANT base, la policy nunca se evalúa.
--
-- Esto rompía:
--   - sendEmail() helper (no podía leer mail_config, escribir mail_logs)
--   - pnpm seed con seedAgents (skills sin grant) y seedMailTemplates
--     (tenants sin grant)
--   - Bug Reporter F5 cuando llegue (necesita admin email send)
--   - Webhook handler /api/webhooks/resend (admin update mail_logs)
--
-- Detectado 2026-05-26 al testear flow de invitación post-setup Resend.
-- Aplicado in-place en prod ese mismo día via MCP execute_sql.

-- 1. GRANTs base · service_role necesita acceso CRUD completo
grant all on public.mail_config to service_role;
grant all on public.mail_logs to service_role;
grant all on public.mail_blacklist to service_role;
grant all on public.mail_templates to service_role;
grant all on public.mail_rules to service_role;

grant all on public.tenants to service_role;
grant all on public.user_tenants to service_role;
grant all on public.user_invitations to service_role;
grant all on public.user_profiles to service_role;
grant all on public.skills to service_role;

-- 2. Defensive: futuras tablas en public auto-granteadas a service_role
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 3. Policies "service_role bypass" · defense in depth
-- (los grants ya alcanzan, pero las policies explícitas hacen el intent
-- evidente para future auditing)
create policy "service_role_all_mail_config"
  on public.mail_config for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_logs"
  on public.mail_logs for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_blacklist"
  on public.mail_blacklist for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_templates"
  on public.mail_templates for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_rules"
  on public.mail_rules for all to service_role
  using (true) with check (true);

create policy "service_role_all_tenants"
  on public.tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_tenants"
  on public.user_tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_invitations"
  on public.user_invitations for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_profiles"
  on public.user_profiles for all to service_role
  using (true) with check (true);
$sdd0118_6_0$
  ]
where version = '20260528060009'
  and name = '0033_grant_service_role_policies'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_7_0$-- 0035_fix_verify_operario_pin_extensions.sql
--
-- Fix regresión: la migración 0025 (SDD-0030) recreó verify_operario_pin
-- para agregar el campo `region` al return type, pero lo hizo con
-- `set search_path = public` (sin extensions). Eso rompió el lookup de
-- crypt() de pgcrypto que vive en schema extensions.
--
-- Impact: las PWAs operario (/m/cn login + /m/ve login + /m/admin login)
-- estaban TOTALMENTE rotas — el login con PIN devolvía "function
-- crypt(text, text) does not exist".
--
-- La migración 0020b había aplicado el fix originalmente, pero 0025 lo
-- pisó con DROP + CREATE sin preservar el search_path correcto.
--
-- Detectado 2026-05-26 noche durante audit preventivo post setup Resend.
-- Fix: re-aplicar con search_path = public, extensions.
--
-- Lección: cualquier RPC que use crypt/gen_salt/gen_random_bytes/digest/
-- uuid_generate_v4/hmac de pgcrypto DEBE tener `extensions` en search_path
-- o usar qualifier `extensions.X()` explícito.

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$func$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030. search_path incluye extensions para resolver crypt() de pgcrypto.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;
$sdd0118_7_0$
  ]
where version = '20260528060010'
  and name = '0035_fix_verify_operario_pin_extensions'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_8_0$-- 0036_fk_user_tenants_profile.sql
--
-- Fix bug: /studio/usuarios devolvía HTTP 400 al consumir
-- `user_tenants?select=...,profile:user_profiles(*)`.
--
-- Causa: PostgREST requiere FK declarada para resolver embed
-- `profile:user_profiles(*)`. La tabla user_tenants NO tenía
-- FK a user_profiles (solo a tenants), aunque user_tenants.user_id
-- y user_profiles.user_id son siempre el mismo uuid de auth.users.
--
-- Fix: agregar FK explícita. user_profiles.user_id ya es PK,
-- así que el target es válido. ON DELETE CASCADE matchea el
-- comportamiento de user_profiles → auth.users.
--
-- Detectado 2026-05-26 al revisar logs API durante audit post-Resend.

alter table public.user_tenants
  add constraint user_tenants_user_id_profile_fkey
  foreign key (user_id) references public.user_profiles(user_id)
  on delete cascade;

-- Refresh PostgREST schema cache para que reconozca la FK nueva inmediato
notify pgrst, 'reload schema';
$sdd0118_8_0$
  ]
where version = '20260528060011'
  and name = '0036_fk_user_tenants_profile'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_9_0$-- 0037_harden_operario_pin_validator.sql
--
-- Mejora seguridad: el validator validate_operario_pin_format solo
-- chequeaba que el PIN tuviera 4 dígitos numéricos. NO bloqueaba PINs
-- comunes (1234, 0000, etc) que son trivialmente vulnerable a brute force
-- en login PIN (sin lockout actual).
--
-- Detectado 2026-05-26: durante audit post-Resend, operario Yusneidy Pérez
-- tenía PIN '1234'. Top 10 PINs más comunes representan ~15% de todos los
-- PINs en estudios reales.
--
-- Fix: agregar blacklist explícita de 24 PINs débiles comunes al validator.
-- Aplica a admin_create_operario y admin_reset_operario_pin que llaman
-- a esta función.
--
-- Operarios existentes con PINs débiles NO se resetean automáticamente
-- (impactaría operación). El founder decide cuándo y con qué PIN nuevo.
--
-- Referencia: https://datagenetics.com/blog/september32012/

create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elegí uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

comment on function public.validate_operario_pin_format is
  'Valida format PIN (4 dígitos) + blacklist de PINs comunes. Llamada desde admin_create_operario y admin_reset_operario_pin.';
$sdd0118_9_0$
  ]
where version = '20260528060012'
  and name = '0037_harden_operario_pin_validator'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_10_0$-- 0039_fix_bug_advance_state_actor_type_cast.sql
--
-- Fix bug en bug_advance_state RPC: falla con
--   "column actor_type is of type bug_author_type but expression is of type text"
-- al intentar cambiar el estado de un bug desde el drawer admin.
--
-- Causa: el INSERT a bug_timeline pasa un `case when ... then 'admin' else 'user' end`
-- expression que PostgreSQL infiere como `text`. La columna actor_type es enum
-- bug_author_type y PostgreSQL no auto-castea text → enum en INSERT context.
--
-- Detectado 2026-05-26 al testear F5 mínimo viable (creé BUG-00003 crítico y
-- Sam intentó clickear "Tomar bug" desde el drawer).
--
-- Fix: cast explícito al final del case expression:
--   (case when ... else ... end)::bug_author_type

create or replace function public.bug_advance_state(
  p_bug_id uuid,
  p_new_state bug_state,
  p_note text default null
)
returns bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  if v_actor_role <> 'admin' then
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- FIX 0039: cast explícito a bug_author_type
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id, 'state_change', v_actor,
    (case when v_actor_role = 'admin' then 'admin' else 'user' end)::bug_author_type,
    jsonb_build_object('from_state', v_old_state, 'to_state', p_new_state, 'note', p_note)
  );

  return v_row;
end;
$func$;
$sdd0118_10_0$
  ]
where version = '20260528060013'
  and name = '0039_fix_bug_advance_state_actor_type_cast'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa';

do $sdd0118_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_postflight$;
$sdd0118_split_patched_0271$
]
where version = '20260729135053'
  and name = '0271_repair_branch_replay_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0839e50eeb47a158382fc2f6c27d5fe9'
    )
    or (
      cardinality(statements) = 13
      and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
    )
  )$sdd0118_finalizer_repair_0_1$,
    $sdd0118_finalizer_repair_0_2$do $sdd0118_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c7b1f468087e249e2ca44359aa3f686f'
  ) then
    raise exception '0280 abortada: 0271 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_split_postconditions$$sdd0118_finalizer_repair_0_2$
  ]
),
(
  '20260730011643',
  '0281_repair_invite_skip_split_history',
  array[
    $sdd0118_finalizer_repair_1_0$-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('887cc625c50ba8f6a2292bad25989fc5', '4242bf102d649559d13793b53e46f43c')
        )
        or (
          cardinality(statements) = 4
          and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
        )
      )
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$$sdd0118_finalizer_repair_1_0$,
    $sdd0118_finalizer_repair_1_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_invite_skip_split_patched_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f');

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f');

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_patched_0272$
]
where version = '20260729140214'
  and name = '0272_skip_superseded_invite_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '887cc625c50ba8f6a2292bad25989fc5'
    )
    or (
      cardinality(statements) = 4
      and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
    )
  )$sdd0118_finalizer_repair_1_1$,
    $sdd0118_finalizer_repair_1_2$do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$$sdd0118_finalizer_repair_1_2$
  ]
),
(
  '20260730130403',
  '0282_repair_platform_admin_skip_split_history',
  array[
    $sdd0118_finalizer_repair_2_0$-- SDD-0118 · hacer replay-safe el skip histórico de platform_admins.
-- Sólo sustituye el payload de 0273 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_platform_admin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('22cac3383ef1d3c9a0a814508cc4c817', '7866d00b211f8158f79117657fd8a8d1')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
        )
      )
  ) then
    raise exception '0282 abortada: ledger 0273 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_platform_admin_split_preflight$$sdd0118_finalizer_repair_2_0$,
    $sdd0118_finalizer_repair_2_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_split_patched_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            'cb374d4ad4c3b2bb62915e80a5a13793'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
        )
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
    )
  );

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_patched_0273$ || chr(13) || chr(10)
]
where version = '20260729141805'
  and name = '0273_skip_platform_admin_bootstrap_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '22cac3383ef1d3c9a0a814508cc4c817'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
    )
  )$sdd0118_finalizer_repair_2_1$,
    $sdd0118_finalizer_repair_2_2$do $sdd0118_platform_admin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7866d00b211f8158f79117657fd8a8d1'
  ) then
    raise exception '0282 abortada: 0273 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_platform_admin_split_postconditions$$sdd0118_finalizer_repair_2_2$
  ]
),
(
  '20260730132651',
  '0283_repair_calculator_settings_split_history',
  array[
    $sdd0118_finalizer_repair_3_0$-- SDD-0118 · hacer replay-safe el restaurador histórico de calculator_settings.
-- Sólo sustituye el payload de 0274 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_calculator_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6ddc823788cbdd6b280810d7ae61a86c', '7dec3bd4977326580000cbdb0d528305')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
        )
      )
  ) then
    raise exception '0283 abortada: ledger 0274 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_calculator_split_preflight$$sdd0118_finalizer_repair_3_0$,
    $sdd0118_finalizer_repair_3_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_split_patched_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
        )
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_settings_target$-- ─────────────────────────────────────────────────────────────
-- 0103 · Calculadora pública Fase 3 (Slice A) · calculator_settings
--        + RPC public_calculator_config() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) ya toma la
-- TARIFA BASE y el PISO desde la tarifa real del Studio (Fase 2, rates.is_public).
-- Pero el RESTO de las reglas (peso incluido por CBM, $/kg de excedente,
-- descuento Valencia, multiplicador de baterías, km del casco, $/km, recargo
-- de embalaje especial) sigue HARDCODEADO en lib/calculadora.ts (CONFIG).
-- Slice A las saca al Studio: el admin las edita en /studio/tarifas › Parámetros.
--
-- Alcance de esta tabla: SOLO las reglas escalares del calculador. La tarifa
-- base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
-- (fuente única, Fase 2). Ciudades y embalajes quedan para Slice B.
--
-- Mecanismo: una fila por tenant (singleton, tenant_id como PK). El sitio
-- público la lee vía RPC anon de retorno mínimo. Si no hay fila, el calculador
-- cae a los defaults de CONFIG (cero regresión).
--
-- Decisiones (mismo patrón que 0101):
--  · Singleton por tenant_id PK → no hay ambigüedad de "cuál config".
--  · CHECKs de cordura → previene config que rompa el cálculo (peso_max <
--    peso_incluido, multiplicador < 1, negativos).
--  · RPC scopeada a slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: create table if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla singleton por tenant
create table if not exists public.calculator_settings (
  tenant_id                 uuid primary key references public.tenants(id) on delete cascade,
  -- Reglas escalares del calculador LCL DDP (espejo de CONFIG en lib/calculadora.ts)
  peso_incluido_kg          numeric(10,2) not null default 500,   -- kg/CBM incluidos sin recargo
  peso_max_kg               numeric(10,2) not null default 600,   -- kg/CBM tope → alerta FCL
  recargo_excedente_kg      numeric(10,2) not null default 1,     -- $/kg sobre peso_incluido
  descuento_valencia        numeric(10,2) not null default 50,    -- $ off si destino = Valencia
  recargo_embalaje_especial numeric(10,2) not null default 50,    -- $ por embalaje madera/paleta
  recargo_bateria_mult      numeric(10,3) not null default 1.5,   -- ×flete si lleva baterías
  threshold_casco_km        numeric(10,2) not null default 200,   -- km de casco central (flat)
  tarifa_km_fuera_casco     numeric(10,2) not null default 1,     -- $/km fuera del casco
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id),
  -- Cordura: una config inválida rompería el calculador público.
  constraint calculator_settings_peso_incluido_pos check (peso_incluido_kg > 0),
  constraint calculator_settings_peso_max_gte_incluido check (peso_max_kg >= peso_incluido_kg),
  constraint calculator_settings_excedente_nonneg check (recargo_excedente_kg >= 0),
  constraint calculator_settings_descuento_nonneg check (descuento_valencia >= 0),
  constraint calculator_settings_embalaje_nonneg check (recargo_embalaje_especial >= 0),
  constraint calculator_settings_bateria_gte_one check (recargo_bateria_mult >= 1),
  constraint calculator_settings_casco_nonneg check (threshold_casco_km >= 0),
  constraint calculator_settings_km_nonneg check (tarifa_km_fuera_casco >= 0)
);

comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated;

-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security;

create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at();

-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config();

create or replace function public.public_calculator_config()
returns table (
  peso_incluido_kg          numeric,
  peso_max_kg               numeric,
  recargo_excedente_kg      numeric,
  descuento_valencia        numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult      numeric,
  threshold_casco_km        numeric,
  tarifa_km_fuera_casco     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;
$sdd0118_calculator_settings_target$
]
where version = '20260604131310'
  and name = '0103_calculator_settings'
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
    )
  );

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_postflight$;
$sdd0118_calculator_split_patched_0274$ || chr(13) || chr(10)
]
where version = '20260729143620'
  and name = '0274_restore_calculator_settings_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6ddc823788cbdd6b280810d7ae61a86c'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
    )
  )$sdd0118_finalizer_repair_3_1$,
    $sdd0118_finalizer_repair_3_2$do $sdd0118_calculator_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7dec3bd4977326580000cbdb0d528305'
  ) then
    raise exception '0283 abortada: 0274 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_calculator_split_postconditions$$sdd0118_finalizer_repair_3_2$
  ]
),
(
  '20260730160209',
  '0284_repair_pin_search_path_split_history',
  array[
    $sdd0118_finalizer_repair_4_0$-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('a217fa825ff964f2c2a4cb26d31c3dbc', 'cad36533b4225b674f1d8fd7b8c165ea')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
        )
      )
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$$sdd0118_finalizer_repair_4_0$,
    $sdd0118_finalizer_repair_4_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_split_patched_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
    )
  );

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_patched_0275$
]
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'a217fa825ff964f2c2a4cb26d31c3dbc'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
    )
  )$sdd0118_finalizer_repair_4_1$,
    $sdd0118_finalizer_repair_4_2$do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$$sdd0118_finalizer_repair_4_2$
  ]
),
(
  '20260730160939',
  '0285_repair_revoke_anon_split_history',
  array[
    $sdd0118_finalizer_repair_5_0$-- SDD-0118 · hacer replay-safe el restaurador histórico de revoke_anon.
-- Sólo sustituye el payload de 0276 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_revoke_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('784f95726bd9c6f21963722f1ce7e61d', '66df90af092b02ae8c0a87f5e2bc08e0')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
        )
      )
  ) then
    raise exception '0285 abortada: ledger 0276 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_revoke_split_preflight$$sdd0118_finalizer_repair_5_0$,
    $sdd0118_finalizer_repair_5_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_split_patched_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 101
          and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
--
-- Contexto: `create function` en Postgres otorga EXECUTE a PUBLIC por default.
-- Varias migraciones que recrearon funciones (`drop` + `create or replace`)
-- re-abrieron ese grant, dejando 57 funciones SECURITY DEFINER ejecutables por
-- `anon` vía /rest/v1/rpc/* (flag `anon_security_definer_function_executable`
-- del advisor de Supabase, 2026-07-03).
--
-- Este sweep cubre las 48 que NO son públicas intencionales:
--   - revoke execute from public, anon  → anon pierde la superficie
--   - grant execute to authenticated, service_role → cero regresión para los
--     callers legítimos (Studio/portal con cliente de usuario + server actions
--     y API routes con cliente admin).
--
-- Allowlist EXCLUIDA del sweep (diseñadas para anon, consumidas por
-- lib/public/* con getAnonClient() — calculadora, track, servicios — y
-- /verificar):
--   public_calculator_cities · public_calculator_config · public_cbm_rate
--   public_fcl_rates · public_ocean_rate · public_service_faqs
--   public_servicios · public_track_shipment · academy_verify_diploma
--
-- Verificación previa de riesgo (2026-07-03): las 4 más sensibles tienen guard
-- interno (get_user_tenant_id() / membresía user_tenants / operario_pins), y
-- ninguna superficie pre-auth del código llama RPCs de esta lista con cliente
-- anon. Regla permanente: toda migración nueva que cree funciones debe hacer
-- `revoke ... from public, anon` + grant explícito (memoria del repo).

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon;
grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role;
revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon;
grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate() to authenticated, service_role;
revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon;
grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role;
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.get_portal_client_tenant() from public, anon;
grant execute on function public.get_portal_client_tenant() to authenticated, service_role;
revoke execute on function public.has_any_back_role() from public, anon;
grant execute on function public.has_any_back_role() to authenticated, service_role;
revoke execute on function public.has_back_role(check_role back_role) from public, anon;
grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon;
grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon;
grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon;
grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon;
grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon;
grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon;
grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role;
revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon;
grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role;
revoke execute on function public.portal_post_message(p_body text) from public, anon;
grant execute on function public.portal_post_message(p_body text) to authenticated, service_role;
revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon;
grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon;
grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon;
grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon;
grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon;
grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.update_user_tenants_last_login() from public, anon;
grant execute on function public.update_user_tenants_last_login() to authenticated, service_role;
revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon;
grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role;
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and (
    statements is null
    or (
      cardinality(statements) = 101
      and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
    )
  );

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_patched_0276$
]
where version = '20260729163005'
  and name = '0276_restore_revoke_anon_rpc_sweep_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '784f95726bd9c6f21963722f1ce7e61d'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
    )
  )$sdd0118_finalizer_repair_5_1$,
    $sdd0118_finalizer_repair_5_2$do $sdd0118_revoke_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '66df90af092b02ae8c0a87f5e2bc08e0'
  ) then
    raise exception '0285 abortada: 0276 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_revoke_split_postconditions$$sdd0118_finalizer_repair_5_2$
  ]
),
(
  '20260730161446',
  '0286_repair_tenant_acl_split_history',
  array[
    $sdd0118_finalizer_repair_6_0$-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5251a9ca8ccbf579c5b81688e63acb01', 'd67b2e81a67028e56bd994f47ce16f6d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
        )
      )
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$$sdd0118_finalizer_repair_6_0$,
    $sdd0118_finalizer_repair_6_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_split_patched_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_patched_0279$ || chr(13) || chr(10)
]
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5251a9ca8ccbf579c5b81688e63acb01'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
    )
  )$sdd0118_finalizer_repair_6_1$,
    $sdd0118_finalizer_repair_6_2$do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$$sdd0118_finalizer_repair_6_2$
  ]
),
(
  '20260730162532',
  '0287_repair_replay_gate_split_history',
  array[$sdd0118_finalizer_source_0287$-- SDD-0118/SDD-0172 · hacer replay-safe los gates 0280–0286.
-- Sólo sustituye payloads del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_replay_gates_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('0cd59e31c466de0286c5b82091d3db32', '42542bfd279507a4a89c87c54a6c619b')
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('08ffa846d67496336012a46029848d1a', '19eb51d4802a0af27a12bf634fa2543d')
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('5525c9ef4374d967e99d8886d4ec9532', '6185c626816290531c5e287a25db1a95')
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('6614a85c247cf6ead23573f7a8cb2514', '8dd851b83f33abc1417d82d0d61c208c')
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('ca7f9d149eeb6eff924cb6d813094fef', 'd2f3bc6fac74a836c96be81c40c2bcce')
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('db953b1adc8f6dcad4bd040b59c461d7', '0d656e4a3a856160d1323c49b60baa70')
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('5d42c84f8fb245ea9514ee80cab24a39', 'fbf9cbd3180f161a4a0462fee2c3fea8')
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history ausente, ambiguo o con drift';
  end if;
end
$sdd0118_replay_gates_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_0$-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0839e50eeb47a158382fc2f6c27d5fe9', 'c7b1f468087e249e2ca44359aa3f686f')
        )
        or (
          cardinality(statements) = 13
          and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
        )
      )
  ) then
    raise exception '0280 abortada: ledger 0271 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_split_patched_0271$-- SDD-0118 · reparar el replay de branches sin ejecutar DDL de negocio.
-- La migración sólo modifica statements del ledger con precondiciones exactas.
-- Los SQL históricos quedan almacenados como texto para futuros replays.
-- 0280 acepta además la fragmentación exacta observada en un branch fresco.
-- 20260526213130 <- 0018_mailing.sql · md5 e2e1b4c3846c7fba431455c9130f0d34
-- 20260527073053 <- 0024_dispatch_core.sql · md5 fc9872ff14733d3d9cac5f0cbb330962
-- 20260527073053 <- 0025_operario_roles_extend.sql · md5 bc9153c31f543e4a74aaa2c570a7aff4
-- 20260528060005 <- 0026_welcome_email_template_seed.sql · md5 b0a7c682cc6031be6034940cb27a5702
-- 20260528060006 <- 0027_qr_print_orders.sql · md5 b760d6196dc02d67036148d33b4ce1f1
-- 20260528060007 <- 0031_fix_studio_invite_gen_random_bytes.sql · md5 8296dce3805f143e549a239995bd954a
-- 20260528060008 <- 0032_fix_studio_invite_ambiguous_token.sql · md5 bb5879cd44f1b5911511e223a0618e51
-- 20260528060009 <- 0033_grant_service_role_policies.sql · md5 a09e03f9f62c47b32ee0a5b4902fa834
-- 20260528060010 <- 0035_fix_verify_operario_pin_extensions.sql · md5 732f8ed961708b91b94cf4965ca8d797
-- 20260528060011 <- 0036_fk_user_tenants_profile.sql · md5 ba63f9c578e32019aaafc8e6d6247056
-- 20260528060012 <- 0037_harden_operario_pin_validator.sql · md5 6e3f5a4763cd32e66a33f189af2da876
-- 20260528060013 <- 0039_fix_bug_advance_state_actor_type_cast.sql · md5 f2872b0ac20dd9e070b14085a60a3fb6

do $sdd0118_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_0_0$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_0_0$
  ] || statements
where version = '20260526213130'
  and name = 'seed_team_invitation_template'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_1_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0029 Fase 1: Módulo Despacho · core (admin web)
--
-- Pipeline 3-actor (Admin/Bodeguero/Camionero) sobre Órdenes de
-- Despacho (ODs). Esta migración cubre SOLO el lado Admin (Fase 1).
-- Las apps móviles de bodeguero+camionero llegan en SDD-0030.
--
-- Cubre:
--   - 6 enums (status OD · hub · payment policy · route type · split reason · incident severity)
--   - Catálogo VE público (ve_locality_catalog): 24 estados · ~98 ciudades · IPOSTEL
--   - 5 tablas per-tenant: dispatch_orders · dispatch_order_packages
--                          dispatch_routes · dispatch_city_catalog
--                          dispatch_rules
--   - Extensión aditiva: warehouse_receipts_cn.description NULLABLE
--     (Wang Hua YIW-A1 y el wizard /m/cn/nueva siguen idénticos)
--   - 4 RPCs: next_dispatch_order_code · next_route_code
--             upsert_dispatch_rules · seed_tenant_cities_from_ve_catalog
--   - Trigger guard de transición de status
--   - RLS por tenant_id en las 5 tablas privadas
--
-- 100% aditivo y no destructivo. Catálogo VE es global (sin RLS, solo lectura).
-- ─────────────────────────────────────────────────────────────

-- ── ENUMS ────────────────────────────────────────────────────

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- ─────────────────────────────────────────────────────────────
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
-- ─────────────────────────────────────────────────────────────

create table public.ve_locality_catalog (
  state_code      text not null,             -- 'CAR'
  state_name      text not null,             -- 'Carabobo'
  state_region    text not null,             -- 'Centro'
  state_capital   text not null,
  municipio       text not null,             -- 'Valencia'
  city            text not null,             -- 'Valencia'
  postal_code     text not null,             -- '2001' (IPOSTEL)
  parroquias      text[] not null default '{}',
  barrios         text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant.';

create index ve_locality_catalog_postal_idx
  on public.ve_locality_catalog (postal_code);

create index ve_locality_catalog_region_idx
  on public.ve_locality_catalog (state_region);

grant select on public.ve_locality_catalog to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed catálogo VE (24 estados · ~98 ciudades · IPOSTEL)
-- ─────────────────────────────────────────────────────────────

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code, parroquias, barrios)
values
  -- Distrito Capital
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Centro)', '1010', ARRAY['Catedral','San José','La Pastora','El Recreo'], ARRAY['El Silencio','San Bernardino','Cotiza','La Candelaria']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Oeste)',  '1020', ARRAY['Antímano','Caricuao','La Vega','Macarao'], ARRAY['Caricuao','Antímano','La Yaguara']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Sur)',    '1080', ARRAY['El Valle','Coche','Santa Rosalía'], ARRAY['El Valle','Coche','Las Acacias']),

  -- Caracas Metropolitana (virtual · 4 alcaldías)
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Chacao',     'Chacao (Caracas)',  '1060', ARRAY['Chacao'], ARRAY['Chacao','La Castellana','Country Club','Altamira']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Baruta',     'Baruta (Caracas)',  '1080', ARRAY['Baruta','El Cafetal','Las Minas'], ARRAY['Las Mercedes','Santa Mónica','Sorocaima']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Sucre',      'Petare',            '1070', ARRAY['Petare','Caucagüita','Filas de Mariche','La Dolorita','Leoncio Martínez'], ARRAY['Petare','Mariperez','Cumbres de Curumo']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'El Hatillo', 'El Hatillo',        '1083', ARRAY['El Hatillo'], ARRAY['El Hatillo','La Lagunita','Oripoto']),

  -- Amazonas
  ('AMA', 'Amazonas', 'Guayana', 'Puerto Ayacucho', 'Atures', 'Puerto Ayacucho', '7101', ARRAY['Atures'], ARRAY['Centro']),

  -- Anzoátegui
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Simón Bolívar',              'Barcelona',         '6001', ARRAY['Bergantín','El Carmen','San Cristóbal'], ARRAY['Centro','Boyacá']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Sotillo',                    'Puerto La Cruz',    '6023', ARRAY['Pozuelos'], ARRAY['Centro','Lechería']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Diego Bautista Urbaneja',    'Lechería',          '6016', ARRAY['Lechería'], ARRAY['Lechería','El Morro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Anaco',                      'Anaco',             '6003', ARRAY['Anaco'], ARRAY['Centro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Pedro María Freites',        'Cantaura',          '6004', ARRAY['Cantaura'], ARRAY[]::text[]),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Independencia',              'Soledad',           '6010', ARRAY['Mamo'], ARRAY[]::text[]),

  -- Apure
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'San Fernando', 'San Fernando de Apure', '7001', ARRAY['San Fernando'], ARRAY['Centro']),
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'Páez',         'Guasdualito',           '7011', ARRAY['Guasdualito'], ARRAY[]::text[]),

  -- Aragua
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Girardot',                  'Maracay',     '2101', ARRAY['Las Delicias','José Casanova Godoy','Joaquín Crespo'], ARRAY['San Jacinto','Las Delicias','El Castaño','Caña de Azúcar','La Soledad']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Mario Briceño Iragorry',    'El Limón',    '2105', ARRAY['Caña de Azúcar'], ARRAY['El Limón']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Santiago Mariño',           'Turmero',     '2115', ARRAY['Turmero'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Sucre',                     'Cagua',       '2122', ARRAY['Cagua'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'José Ángel Lamas',          'Santa Cruz',  '2128', ARRAY['Santa Cruz'], ARRAY[]::text[]),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Linares Alcántara',         'Santa Rita',  '2123', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Barinas
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Barinas',                    'Barinas', '5201', ARRAY['Barinas','Alto Barinas'], ARRAY['Centro','Alto Barinas']),
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Antonio José de Sucre',      'Socopó',  '5212', ARRAY['Socopó'], ARRAY[]::text[]),

  -- Bolívar
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Heres',  'Ciudad Bolívar',                 '8001', ARRAY['Catedral','Vista Hermosa'], ARRAY['Centro','Vista Hermosa','Sabana del Hueso']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Caroní', 'Ciudad Guayana / Puerto Ordaz',  '8050', ARRAY['Cachamay','Universidad','Unare','Vista al Sol','Once de Abril'], ARRAY['Alta Vista','Castillito','Los Olivos','Villa Bolívar']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Piar',   'Upata',                          '8021', ARRAY['Upata'], ARRAY['Centro']),

  -- Carabobo
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia',       'Valencia',       '2001', ARRAY['San José','San Blas','Catedral','Candelaria'], ARRAY['El Viñedo','Trigal Norte','San José','Prebo','El Recreo','La Granja']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Naguanagua',     'Naguanagua',     '2005', ARRAY['Naguanagua'], ARRAY['Mañongo','La Granja','Bárbula']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'San Diego',      'San Diego',      '2006', ARRAY['San Diego'], ARRAY['Yuma','Castillito']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Los Guayos',     'Los Guayos',     '2014', ARRAY['Los Guayos'], ARRAY[]::text[]),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Guacara',        'Guacara',        '2015', ARRAY['Guacara'], ARRAY['Centro']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Puerto Cabello', 'Puerto Cabello', '2050', ARRAY['Fraternidad','Bartolomé Salom','Goaigoaza'], ARRAY['Centro','Cumboto']),

  -- Cojedes
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Ezequiel Zamora', 'San Carlos',  '2201', ARRAY['San Carlos'], ARRAY['Centro']),
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Tinaquillo',      'Tinaquillo',  '2204', ARRAY['Tinaquillo'], ARRAY['Centro']),

  -- Delta Amacuro
  ('DEL', 'Delta Amacuro', 'Guayana', 'Tucupita', 'Tucupita', 'Tucupita', '9001', ARRAY['Tucupita'], ARRAY['Centro']),

  -- Falcón
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Miranda',     'Coro',                       '4101', ARRAY['Santa Ana','San Antonio'], ARRAY['Centro','Cruz Verde','Curazaito']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Carirubana',  'Punto Fijo',                 '4102', ARRAY['Carirubana','Norte','Punta Cardón'], ARRAY['Centro','Las Pioneras','Cardón']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Los Taques',  'Santa Cruz de Los Taques',   '4106', ARRAY['Los Taques'], ARRAY[]::text[]),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Federación',  'Churuguara',                 '4115', ARRAY['Churuguara'], ARRAY[]::text[]),

  -- Guárico
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Juan Germán Roscio',     'San Juan de los Morros',  '2301', ARRAY['San Juan'], ARRAY['Casco Central','Pariata','La Toscana']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Francisco de Miranda',   'Calabozo',                '2312', ARRAY['Calabozo'], ARRAY['Centro']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Camaguán',               'Camaguán',                '2317', ARRAY['Camaguán'], ARRAY[]::text[]),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'José Tadeo Monagas',     'Altagracia de Orituco',   '2304', ARRAY['Altagracia'], ARRAY[]::text[]),

  -- La Guaira
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'La Guaira',     '1163', ARRAY['Catia La Mar','Maiquetía','La Guaira'], ARRAY['Maiquetía','Macuto']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Catia La Mar',  '1162', ARRAY['Catia La Mar'], ARRAY['Centro','Puerto Viejo']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Maiquetía',     '1161', ARRAY['Maiquetía'], ARRAY['Centro']),

  -- Lara
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Iribarren',  'Barquisimeto', '3001', ARRAY['Catedral','Concepción','Tamaca','El Cuji'], ARRAY['Centro','El Tostado','Las Trinitarias','Patarata']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Palavecino', 'Cabudare',     '3023', ARRAY['Cabudare'], ARRAY['Centro']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Crespo',     'Duaca',        '3050', ARRAY['Duaca'], ARRAY[]::text[]),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Torres',     'Carora',       '3040', ARRAY['Carora'], ARRAY['Centro']),

  -- Mérida
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Libertador',       'Mérida',     '5101', ARRAY['El Llano','Milla','Domingo Peña','Mariano Picón Salas'], ARRAY['La Hechicera','Belensate','Glorias Patrias','Mérida Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Campo Elías',      'Ejido',      '5113', ARRAY['Ejido'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Tovar',            'Tovar',      '5131', ARRAY['Tovar'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Alberto Adriani',  'El Vigía',   '5145', ARRAY['El Vigía'], ARRAY['Centro']),

  -- Miranda
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Guaicaipuro',     'Los Teques',        '1201', ARRAY['Los Teques','San Pedro'], ARRAY['Centro','San Pedro','Lomas de Urquía']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Plaza',           'Guarenas',          '1220', ARRAY['Guarenas'], ARRAY['Centro','Camatagua']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Zamora',          'Guatire',           '1221', ARRAY['Guatire'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Cristóbal Rojas', 'Charallave',        '1210', ARRAY['Charallave'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Urdaneta',        'Cúa',               '1213', ARRAY['Cúa'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Brión',           'Higuerote',         '1240', ARRAY['Higuerote'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Lander',          'Ocumare del Tuy',   '1211', ARRAY['Ocumare'], ARRAY['Centro']),

  -- Monagas
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Maturín',   'Maturín',     '6201', ARRAY['San Simón','San Vicente','Las Cocuizas'], ARRAY['La Floresta','Tipuro','Las Avenidas','Los Pinos']),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Caripe',    'Caripe',      '6225', ARRAY['Caripe'], ARRAY[]::text[]),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Punceres',  'Quiriquire',  '6213', ARRAY['Quiriquire'], ARRAY[]::text[]),

  -- Nueva Esparta
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Arismendi', 'La Asunción', '6301', ARRAY['La Asunción'], ARRAY['Centro']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Mariño',    'Porlamar',    '6313', ARRAY['Porlamar'], ARRAY['Centro','4 de Mayo','Genovés']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Maneiro',   'Pampatar',    '6315', ARRAY['Pampatar'], ARRAY['Centro','La Caranta']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Gómez',     'Santa Ana',   '6311', ARRAY['Santa Ana'], ARRAY[]::text[]),

  -- Portuguesa
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Guanare', 'Guanare',  '3322', ARRAY['Guanare','San Juan de Guanaguanare'], ARRAY['Centro','Mesa de Cavacas']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Páez',    'Acarigua', '3301', ARRAY['Acarigua'], ARRAY['Centro','Bolívar']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Araure',  'Araure',   '3303', ARRAY['Araure'], ARRAY['Centro']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Sucre',   'Biscucuy', '3330', ARRAY['Biscucuy'], ARRAY[]::text[]),

  -- Sucre
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Sucre',    'Cumaná',       '6101', ARRAY['Altagracia','Santa Inés','Valentín Valiente','Ayacucho'], ARRAY['Centro','Boca de Sabana','Los Tarales']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Bermúdez', 'Carúpano',     '6150', ARRAY['Santa Rosa','Santa Catalina'], ARRAY['Centro']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Cajigal',  'Yaguaraparo',  '6173', ARRAY['Yaguaraparo'], ARRAY[]::text[]),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Valdez',   'Güiria',       '6164', ARRAY['Güiria'], ARRAY[]::text[]),

  -- Táchira
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'San Cristóbal',         'San Cristóbal',              '5001', ARRAY['La Concordia','Pedro María Morantes','San Juan Bautista'], ARRAY['Centro','Pirineos','Las Lomas']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Cárdenas',              'Táriba',                     '5009', ARRAY['Táriba'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Bolívar',               'San Antonio del Táchira',    '5004', ARRAY['San Antonio'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Pedro María Ureña',     'Ureña',                      '5005', ARRAY['Ureña'], ARRAY[]::text[]),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Junín',                 'Rubio',                      '5030', ARRAY['Rubio'], ARRAY['Centro']),

  -- Trujillo
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Trujillo', 'Trujillo', '3101', ARRAY['Trujillo'], ARRAY['Centro']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Valera',   'Valera',   '3102', ARRAY['Valera','Mendoza'], ARRAY['Centro','La Plata','Plata III']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Boconó',   'Boconó',   '3104', ARRAY['Boconó'], ARRAY['Centro']),

  -- Yaracuy
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'San Felipe',    'San Felipe',    '3201', ARRAY['San Felipe','Albarico'], ARRAY['Centro','La Trinidad']),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Independencia', 'Independencia', '3206', ARRAY['Independencia'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Veroes',        'Farriar',       '3214', ARRAY['Farriar'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Bolívar',       'Aroa',          '3211', ARRAY['Aroa'], ARRAY[]::text[]),

  -- Zulia
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Maracaibo',              'Maracaibo',                '4001', ARRAY['Chiquinquirá','Coquivacoa','Cristo de Aranza','Bolívar','Santa Lucía'], ARRAY['Bella Vista','Tierra Negra','El Milagro','Indio Mara','Sabaneta']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'San Francisco',          'San Francisco',            '4002', ARRAY['San Francisco','Marcial Hernández'], ARRAY['Sierra Maestra','San Francisco Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Cabimas',                'Cabimas',                  '4013', ARRAY['Cabimas','Punta Gorda','Ambrosio'], ARRAY['Centro','Las Cabillas','La Rosa']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Lagunillas',             'Ciudad Ojeda',             '4019', ARRAY['Ciudad Ojeda'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Mara',                   'San Rafael del Moján',     '4012', ARRAY['Mara'], ARRAY[]::text[]),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Machiques de Perijá',    'Machiques',                '4045', ARRAY['Machiques'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Santa Rita',             'Santa Rita',               '4030', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Dependencias Federales
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'Los Roques',  'Gran Roque',  '1990', ARRAY[]::text[], ARRAY[]::text[]),
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'La Tortuga',  'Tortuga',     '1990', ARRAY[]::text[], ARRAY[]::text[]);

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_routes (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);

comment on table public.dispatch_routes is
  'Catálogo de rutas operativas per-tenant. Directa (origen→destino) o intermedias (con ciudades intermedias en jsonb). RLS por tenant. Soft-delete.';

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub)
  where deleted_at is null and active = true;

create index dispatch_routes_tenant_active_idx
  on public.dispatch_routes (tenant_id, active)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. dispatch_city_catalog (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

comment on table public.dispatch_city_catalog is
  'Catálogo de ciudades per-tenant. Se popula la primera vez con seed_tenant_cities_from_ve_catalog(). Tenant puede agregar ciudades custom o marcar is_hq.';

create index dispatch_city_catalog_tenant_active_idx
  on public.dispatch_city_catalog (tenant_id)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. dispatch_rules (1 row por tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring por tenant. 1 row por tenant. Editable desde /studio/despacho/reglas. Defaults aplicados si no existe row.';

-- ─────────────────────────────────────────────────────────────
-- 5. dispatch_orders (entidad central)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);

comment on table public.dispatch_orders is
  'Órdenes de Despacho (ODs). Entidad central del pipeline 3-actor. State machine cerrada (creada→cargando→lista→en_ruta→entregada→cerrada, terminal cancelada). Code OD-YYYY-NNNN.';

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status)
  where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_active_idx
  on public.dispatch_orders (tenant_id, driver_id)
  where status = 'lista';

create index dispatch_orders_parent_idx
  on public.dispatch_orders (parent_od_id)
  where parent_od_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 6. dispatch_order_packages (junction OD ↔ paquetes)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);

comment on table public.dispatch_order_packages is
  'Junction OD ↔ paquetes. Soporta carga fraccionada (boxes_shipped < boxes_total) con motivo obligatorio. FK polimórfico via package_kind + package_id (FK explícito en Fase 2 SDD-0030).';

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);

create index dispatch_order_packages_package_idx
  on public.dispatch_order_packages (package_kind, package_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Extensión aditiva: warehouse_receipts_cn.description NULLABLE
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE) + chofer entrega. NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá NOT NULL con 5to step opcional.';

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs
-- ─────────────────────────────────────────────────────────────

-- 8.1 · next_dispatch_order_code: secuencial OD-YYYY-NNNN por tenant
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_dispatch_order_code(uuid) is
  'Genera el próximo código OD-YYYY-NNNN para el tenant. Verifica que auth.uid() esté en user_tenants.';

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;

-- 8.2 · next_route_code: secuencial R-NNN por tenant (sin año)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(route_code from 'R-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-%';

  v_next := 'R-' || lpad((v_max + 1)::text, 3, '0');
  return v_next;
end;
$$;

comment on function public.next_route_code(uuid) is
  'Genera el próximo código R-NNN para el tenant. Verifica autorización.';

grant execute on function public.next_route_code(uuid) to authenticated;

-- 8.3 · upsert_dispatch_rules: idempotente, last-write-wins
create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes, updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules. Last-write-wins, sin lock optimista en Fase 1.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;

-- 8.4 · seed_tenant_cities_from_ve_catalog: copia inicial del catálogo público
create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ~98 ciudades del catálogo VE público a dispatch_city_catalog del tenant. Devuelve cuántas filas se insertaron (0 si ya estaban).';

grant execute on function public.seed_tenant_cities_from_ve_catalog(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger guard de transición de status
-- ─────────────────────────────────────────────────────────────

create or replace function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido modificar status desde terminales
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- entregada solo puede ir a cerrada
    if old.status = 'entregada' and new.status not in ('cerrada') then
      raise exception 'Desde entregada solo se puede ir a cerrada (intentado: %)', new.status;
    end if;

    -- lista no puede retroceder a cargando
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;

    -- en_ruta no puede retroceder a lista
    if old.status = 'en_ruta' and new.status = 'lista' then
      raise exception 'No se puede retroceder de en_ruta a lista';
    end if;

    -- Auto-stamp timestamps
    if new.status = 'en_ruta' and new.departed_at is null then
      new.departed_at := now();
    elsif new.status = 'entregada' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cerrada' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();

-- ─────────────────────────────────────────────────────────────
-- 10. RLS · tenant isolation
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- dispatch_orders: select + insert + update + delete via tenant_id
create policy dispatch_orders_select on public.dispatch_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_insert on public.dispatch_orders
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_update on public.dispatch_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_delete on public.dispatch_orders
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_order_packages: tenant via JOIN al OD
create policy dispatch_order_packages_select on public.dispatch_order_packages
  for select using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_insert on public.dispatch_order_packages
  for insert with check (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_update on public.dispatch_order_packages
  for update using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_delete on public.dispatch_order_packages
  for delete using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

-- dispatch_routes
create policy dispatch_routes_select on public.dispatch_routes
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_insert on public.dispatch_routes
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_update on public.dispatch_routes
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_delete on public.dispatch_routes
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_city_catalog
create policy dispatch_city_catalog_select on public.dispatch_city_catalog
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_insert on public.dispatch_city_catalog
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_update on public.dispatch_city_catalog
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_delete on public.dispatch_city_catalog
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_rules
create policy dispatch_rules_select on public.dispatch_rules
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_insert on public.dispatch_rules
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_update on public.dispatch_rules
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_packages to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_city_catalog to authenticated;
grant select, insert, update on public.dispatch_rules to authenticated;
$sdd0118_1_0$,
    $sdd0118_1_1$-- ─────────────────────────────────────────────────────────────
-- SDD-0030 Fase 2: Apps móviles bodeguero VE + camionero VE
--
-- Extiende operario_pins.role para soportar los 2 roles nuevos del
-- pipeline de Despacho (bodeguero arma camiones, camionero entrega).
-- + Tabla dispatch_pods (proofs of delivery).
-- + 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
--   camionero_advance_od · camionero_pod
-- + Update verify_operario_pin para devolver region.
--
-- 100% aditivo. NO toca operarios CN existentes (Wang Hua YIW-A1 sigue
-- idéntica · role='operario', region='cn').
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Extender CHECK constraint del role
-- ─────────────────────────────────────────────────────────────

alter table public.operario_pins drop constraint operario_pins_role_check;

alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );

comment on column public.operario_pins.role is
  'Rol del operario · operario|supervisor (CN almacén) o bodeguero|camionero (VE despacho). Bodeguero arma camiones; camionero entrega. SDD-0030.';

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla dispatch_pods (proofs of delivery)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

comment on table public.dispatch_pods is
  'Proofs of Delivery (POD) de Órdenes de Despacho. 1 fila por entrega confirmada por el camionero PWA. Photo + signature paths apuntan al bucket receipt-photos con prefijos pod/ y firma/.';

create index dispatch_pods_od_idx
  on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx
  on public.dispatch_pods (tenant_id, created_at desc);

alter table public.dispatch_pods enable row level security;

-- Admins del tenant pueden leer todos los PODs (consulta auditable)
create policy dispatch_pods_select on public.dispatch_pods
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- Inserts vienen via RPC (security definer · service_role bypass)
-- No exponemos insert a authenticated.

grant select on public.dispatch_pods to authenticated;
grant select, insert, update, delete on public.dispatch_pods to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Update RPC verify_operario_pin · agregar region en el return
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,             -- nullable desde SDD-0023 (chofer/bodeguero VE no necesariamente)
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region   -- NUEVO en SDD-0030
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030 extiende SDD-0027.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC bodeguero_advance_od
--
-- Transiciones permitidas para el bodeguero:
--   creada → cargando        (al abrir la OD)
--   cargando → lista         ("Cerrar carga")
--
-- Validaciones:
--   - operario activo + role='bodeguero' (o supervisor VE legacy)
--   - OD existe + tenant match
--   - Transición permitida por trigger guard (deja que el trigger valide)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE pueden actuar sobre Despacho' using errcode = 'P0003';
  end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede avanzar carga' using errcode = 'P0004';
  end if;

  -- 2. Validar OD tenant
  select tenant_id into v_od_tenant
    from public.dispatch_orders
   where id = p_od_id;

  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 3. Validar transición esperada (whitelist bodeguero)
  if p_status not in ('cargando', 'lista') then
    raise exception 'Transición % no permitida para bodeguero', p_status using errcode = 'P0007';
  end if;

  -- 4. Update (trigger guard valida la transición real desde el current)
  update public.dispatch_orders
     set status = p_status,
         updated_by = null,                    -- operario no tiene auth.uid
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status) is
  'Advance OD desde la PWA del bodeguero. Solo permite creada→cargando→lista. Resto bloqueado por el trigger guard.';

revoke all on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  from public, anon, authenticated;
grant execute on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC bodeguero_split_p2
--
-- Fracciona un paquete: actualiza la fila junction existente con
-- boxes_shipped < boxes_total y motivo, y crea una OD nueva (P2)
-- con parent_od_id apuntando a la P1.
--
-- La P2 queda con status='creada' sin camión/chofer (admin la asigna).
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_split_p2(
  p_operario_id        uuid,
  p_od_id              uuid,
  p_package_id         uuid,
  p_boxes_shipped      int,
  p_split_reason       dispatch_split_reason,
  p_split_reason_text  text
)
returns uuid           -- id de la OD P2 creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_role           text;
  v_region         operario_region;
  v_active         boolean;
  v_pkg            public.dispatch_order_packages%rowtype;
  v_od             public.dispatch_orders%rowtype;
  v_remaining      int;
  v_new_od_id      uuid;
  v_new_code       text;
begin
  -- 1. Validar operario (igual pattern que bodeguero_advance_od)
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede fraccionar' using errcode = 'P0004';
  end if;

  -- 2. Lock + leer el paquete
  select * into v_pkg
    from public.dispatch_order_packages
   where od_id = p_od_id and package_id = p_package_id
   for update;
  if v_pkg.od_id is null then
    raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
  end if;

  -- 3. Validar boxes_shipped
  if p_boxes_shipped <= 0 or p_boxes_shipped >= v_pkg.boxes_total then
    raise exception 'boxes_shipped debe estar entre 1 y boxes_total-1' using errcode = 'P0009';
  end if;

  v_remaining := v_pkg.boxes_total - p_boxes_shipped;

  -- 4. Validar OD tenant
  select * into v_od from public.dispatch_orders where id = p_od_id;
  if v_od.tenant_id <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 5. Update el junction P1: boxes_shipped + motivo
  update public.dispatch_order_packages
     set boxes_shipped = p_boxes_shipped,
         split_reason = p_split_reason,
         split_reason_text = p_split_reason_text
   where od_id = p_od_id and package_id = p_package_id;

  -- 6. Generar code P2 via RPC (no llamamos next_dispatch_order_code porque
  --    chequea auth.uid; usamos la lógica inline acá)
  declare
    v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
    v_max  int;
  begin
    select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
      into v_max
      from public.dispatch_orders
     where tenant_id = v_tenant_id
       and order_code like 'OD-' || v_year || '-%';
    v_new_code := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  end;

  -- 7. Crear OD P2 (sin camión/chofer · status='creada')
  insert into public.dispatch_orders (
    tenant_id, order_code, status, hub,
    route_id, truck_id, driver_id,
    total_kg, total_cbm, package_count,
    cities_ordered,
    parent_od_id
  ) values (
    v_tenant_id,
    v_new_code,
    'creada',
    v_od.hub,
    v_od.route_id,
    null,                                              -- admin reasigna
    null,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    1,
    array[v_pkg.city]::text[],
    p_od_id
  )
  returning id into v_new_od_id;

  -- 8. Insertar junction de la P2
  insert into public.dispatch_order_packages (
    od_id, package_kind, package_id, markbox, client_name, city, pay,
    description, boxes_total, boxes_shipped, weight_kg, cbm,
    hs_code, aes_code
  ) values (
    v_new_od_id, v_pkg.package_kind, v_pkg.package_id, v_pkg.markbox,
    v_pkg.client_name, v_pkg.city, v_pkg.pay,
    v_pkg.description, v_remaining, v_remaining,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    v_pkg.hs_code, v_pkg.aes_code
  );

  return v_new_od_id;
end;
$$;

comment on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text) is
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC camionero_advance_od
--
-- Transiciones permitidas para el camionero:
--   lista → en_ruta         ("Iniciar ruta")
--   en_ruta → entregada     (cuando hizo la última POD)
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status,
  p_progress       int,
  p_current_city   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
     set status = p_status,
         progress_pct = coalesce(p_progress, progress_pct),
         current_city = coalesce(p_current_city, current_city),
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.camionero_advance_od is
  'Advance OD desde la PWA del camionero. Solo permite lista→en_ruta y en_ruta→entregada.';

revoke all on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC camionero_pod
--
-- Crea fila dispatch_pods con foto/firma/receptor. No cambia status
-- automáticamente — eso lo hace camionero_advance_od cuando es la
-- última entrega.
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text
)
returns uuid          -- id del POD creado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod is
  'Confirma POD (Proof of Delivery) de una entrega: foto + firma + receptor. Llamada desde la PWA del camionero.';

revoke all on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
$sdd0118_1_1$
  ] || statements
where version = '20260527073053'
  and name = 'realtime_dispatch'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_2_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0032: Seed del template "Bienvenida MARKBOX" (welcome_markbox)
--
-- Upsert idempotente del template para todos los tenants existentes.
-- Si más tenants se crean después, agregar trigger o seed en alta de tenant.
--
-- Usado por:
--   - sendWelcomeEmailAction (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--
-- Schema base: mail_templates (SDD-0026, migración 0018_mailing.sql).
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'welcome_markbox',
      'Bienvenida MARKBOX',
      'cliente',
      'email',
      'Bienvenido a DTD Cargo · tu código es {{markbox}}',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu código MARKBOX:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Servicio puerta a puerta China-Venezuela</p>
</div>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox seedado por SDD-0032 para email de bienvenida automático al crear cliente con email.';
$sdd0118_2_0$
  ]
where version = '20260528060005'
  and name = '0026_welcome_email_template_seed'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_3_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0033: Cola de impresión QR · vista oficina
--
-- Tabla qr_print_orders que recibe órdenes del operario CN PWA
-- (push via RPC con cookie HTTP-only) y consume admin web en
-- /studio/cola-qr para imprimir + marcar entregado.
--
-- 2 enums + 1 tabla + 2 RPCs (next code + push as operario) +
-- trigger guard de transición + RLS por tenant + Realtime ready.
-- ─────────────────────────────────────────────────────────────

-- ENUMS

create type qr_order_status as enum (
  'pendiente',
  'imprimiendo',
  'impreso',
  'entregado',
  'cancelado'
);

create type qr_order_priority as enum ('urgent', 'normal');

-- ─────────────────────────────────────────────────────────────
-- Tabla qr_print_orders
-- ─────────────────────────────────────────────────────────────

create table public.qr_print_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  order_code               text not null,                                     -- 'QR-2026-0142'
  warehouse_id             uuid references public.warehouses_cn(id),
  markbox                  text not null,
  client_name              text not null,                                     -- denorm
  supplier_name            text,
  bultos                   int not null check (bultos > 0),

  -- Quién la mandó
  sent_by_operario_id      uuid references public.operario_pins(id) on delete set null,
  sent_by_name             text not null,                                     -- denorm snapshot
  sent_by_phone            text,
  sent_at                  timestamptz not null default now(),

  -- Estado
  priority                 qr_order_priority not null default 'normal',
  status                   qr_order_status not null default 'pendiente',
  assigned_printer         text,                                              -- label libre · sin tabla printers V1

  -- Lifecycle
  printed_at               timestamptz,
  printed_by               uuid references auth.users(id) on delete set null,
  delivered_at             timestamptz,
  delivered_by             uuid references auth.users(id) on delete set null,
  cancelled_at             timestamptz,
  cancelled_by             uuid references auth.users(id) on delete set null,
  cancel_reason            text,

  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (tenant_id, order_code)
);

comment on table public.qr_print_orders is
  'Cola de impresión de QR. Operario CN pushea via RPC (cookie HTTP-only · sin auth.uid). Admin web consume en /studio/cola-qr y marca como impreso/entregado.';

create index qr_print_orders_tenant_status_idx
  on public.qr_print_orders (tenant_id, status, sent_at desc)
  where status not in ('entregado', 'cancelado');

create index qr_print_orders_tenant_all_idx
  on public.qr_print_orders (tenant_id, sent_at desc);

create index qr_print_orders_markbox_idx
  on public.qr_print_orders (tenant_id, markbox, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC next_qr_order_code · secuencial QR-YYYY-NNNN por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_qr_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max  int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    -- También permitir service_role (operario · sin auth.uid)
    if auth.uid() is not null then
      raise exception 'No autorizado para tenant %', p_tenant_id;
    end if;
  end if;

  select coalesce(max((substring(order_code from 'QR-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.qr_print_orders
  where tenant_id = p_tenant_id
    and order_code like 'QR-' || v_year || '-%';

  return 'QR-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;

comment on function public.next_qr_order_code(uuid) is
  'Genera próximo QR-YYYY-NNNN para el tenant. Mismo patrón que next_dispatch_order_code. Permite caller con auth.uid o service_role.';

grant execute on function public.next_qr_order_code(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC push_qr_order_as_operario
--
-- Llamado desde server action /m/cn/* con service_role. Recibe
-- operario_id (de cookie HTTP-only) y crea la orden con status
-- 'pendiente'. Denormaliza display_name y phone del operario.
-- ─────────────────────────────────────────────────────────────

create or replace function public.push_qr_order_as_operario(
  p_operario_id     uuid,
  p_warehouse_id    uuid,                              -- nullable · puede sacarse del operario
  p_markbox         text,
  p_client_name     text,
  p_supplier_name   text,
  p_bultos          int,
  p_priority        qr_order_priority,
  p_notes           text
)
returns table (
  id          uuid,
  order_code  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_active     boolean;
  v_op_name    text;
  v_op_phone   text;
  v_wh_id      uuid;
  v_code       text;
  v_new_id     uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, active, display_name, last_login_at
    into v_tenant_id, v_role, v_active, v_op_name, v_op_phone
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Sanity
  if p_markbox is null or length(trim(p_markbox)) = 0 then
    raise exception 'markbox requerido' using errcode = 'P0003';
  end if;
  if p_bultos is null or p_bultos <= 0 then
    raise exception 'bultos debe ser > 0' using errcode = 'P0004';
  end if;

  -- 3. Warehouse: si no vino, lee el del operario
  if p_warehouse_id is null then
    select warehouse_id into v_wh_id
      from public.operario_pins where id = p_operario_id;
  else
    v_wh_id := p_warehouse_id;
  end if;

  -- 4. Generar code
  v_code := public.next_qr_order_code(v_tenant_id);

  -- 5. Insert
  insert into public.qr_print_orders (
    tenant_id, order_code, warehouse_id,
    markbox, client_name, supplier_name, bultos,
    sent_by_operario_id, sent_by_name, sent_by_phone,
    priority, status, notes
  ) values (
    v_tenant_id, v_code, v_wh_id,
    trim(p_markbox), trim(coalesce(p_client_name, '—')),
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_bultos,
    p_operario_id, v_op_name, nullif(trim(coalesce(v_op_phone, '')), ''),
    coalesce(p_priority, 'normal'),
    'pendiente',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning qr_print_orders.id into v_new_id;

  return query select v_new_id, v_code;
end;
$$;

comment on function public.push_qr_order_as_operario is
  'Operario CN pushea una orden de impresión desde el PWA /m/cn. security definer · invocado con service_role desde server action.';

revoke all on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) from public, anon, authenticated;
grant execute on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Trigger guard de transición
-- ─────────────────────────────────────────────────────────────

create or replace function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido desde terminal
    if old.status in ('entregado', 'cancelado') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- impreso solo puede ir a entregado o cancelado
    if old.status = 'impreso' and new.status not in ('entregado', 'cancelado') then
      raise exception 'Desde impreso solo se puede ir a entregado o cancelado';
    end if;

    -- imprimiendo no puede retroceder a pendiente
    if old.status = 'imprimiendo' and new.status = 'pendiente' then
      raise exception 'No se puede retroceder de imprimiendo a pendiente';
    end if;

    -- Auto-stamp
    if new.status = 'impreso' and new.printed_at is null then
      new.printed_at := now();
      new.printed_by := coalesce(new.printed_by, auth.uid());
    elsif new.status = 'entregado' and new.delivered_at is null then
      new.delivered_at := now();
      new.delivered_by := coalesce(new.delivered_by, auth.uid());
    elsif new.status = 'cancelado' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger qr_print_orders_status_guard
  before update on public.qr_print_orders
  for each row execute function public.qr_print_orders_status_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders enable row level security;

create policy qr_print_orders_select on public.qr_print_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy qr_print_orders_update on public.qr_print_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- INSERT NO desde authenticated · solo service_role (vía push_qr_order_as_operario)
create policy qr_print_orders_no_insert_auth on public.qr_print_orders
  for insert to authenticated with check (false);

-- DELETE NO desde authenticated · admin cancela cambiando status
create policy qr_print_orders_no_delete_auth on public.qr_print_orders
  for delete to authenticated using (false);

grant select, update on public.qr_print_orders to authenticated;
grant select, insert, update, delete on public.qr_print_orders to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (V2: cliente se suscribe al channel)
-- ─────────────────────────────────────────────────────────────

-- Agregar tabla a la publicación si la pub existe (Supabase la crea por default)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.qr_print_orders';
  end if;
exception when others then
  raise notice 'No se pudo agregar qr_print_orders a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
$sdd0118_3_0$
  ]
where version = '20260528060006'
  and name = '0027_qr_print_orders'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_4_0$-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_4_0$
  ]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_5_0$-- 0032_fix_studio_invite_ambiguous_token.sql
--
-- Fix bug: studio_invite_user falla con "column reference 'token' is ambiguous"
-- porque el RETURNS TABLE (invitation_id uuid, token text) declara una OUTPUT
-- column llamada `token` que clashea con la columna real
-- public.user_invitations.token en el RETURNING.
--
-- Detectado 2026-05-26 inmediatamente después de aplicar 0031 (gen_random_bytes
-- qualifier fix). Cuando se hizo el primer test real de invitación.
--
-- Fix: qualificar user_invitations.token en el RETURNING.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- FIX 0032: qualificar user_invitations.token en RETURNING porque
  -- el RETURNS TABLE declara una output column 'token' que clashea.
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_5_0$
  ]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_6_0$-- 0033_grant_service_role_policies.sql
--
-- Fix raíz: tablas mail_* y user_* del Studio fueron creadas SIN
-- GRANT base a service_role. Las policies para authenticated existían
-- pero PostgREST rechazaba al admin client antes incluso de evaluar RLS
-- porque service_role no tenía siquiera SELECT/INSERT permission.
--
-- Hint literal de PostgreSQL al hacer SELECT con service_role:
--   "permission denied for table mail_config
--    HINT: Grant the required privileges to the current role with:
--    GRANT SELECT ON public.mail_config TO service_role;"
--
-- Sin GRANT base, la policy nunca se evalúa.
--
-- Esto rompía:
--   - sendEmail() helper (no podía leer mail_config, escribir mail_logs)
--   - pnpm seed con seedAgents (skills sin grant) y seedMailTemplates
--     (tenants sin grant)
--   - Bug Reporter F5 cuando llegue (necesita admin email send)
--   - Webhook handler /api/webhooks/resend (admin update mail_logs)
--
-- Detectado 2026-05-26 al testear flow de invitación post-setup Resend.
-- Aplicado in-place en prod ese mismo día via MCP execute_sql.

-- 1. GRANTs base · service_role necesita acceso CRUD completo
grant all on public.mail_config to service_role;
grant all on public.mail_logs to service_role;
grant all on public.mail_blacklist to service_role;
grant all on public.mail_templates to service_role;
grant all on public.mail_rules to service_role;

grant all on public.tenants to service_role;
grant all on public.user_tenants to service_role;
grant all on public.user_invitations to service_role;
grant all on public.user_profiles to service_role;
grant all on public.skills to service_role;

-- 2. Defensive: futuras tablas en public auto-granteadas a service_role
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 3. Policies "service_role bypass" · defense in depth
-- (los grants ya alcanzan, pero las policies explícitas hacen el intent
-- evidente para future auditing)
create policy "service_role_all_mail_config"
  on public.mail_config for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_logs"
  on public.mail_logs for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_blacklist"
  on public.mail_blacklist for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_templates"
  on public.mail_templates for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_rules"
  on public.mail_rules for all to service_role
  using (true) with check (true);

create policy "service_role_all_tenants"
  on public.tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_tenants"
  on public.user_tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_invitations"
  on public.user_invitations for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_profiles"
  on public.user_profiles for all to service_role
  using (true) with check (true);
$sdd0118_6_0$
  ]
where version = '20260528060009'
  and name = '0033_grant_service_role_policies'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_7_0$-- 0035_fix_verify_operario_pin_extensions.sql
--
-- Fix regresión: la migración 0025 (SDD-0030) recreó verify_operario_pin
-- para agregar el campo `region` al return type, pero lo hizo con
-- `set search_path = public` (sin extensions). Eso rompió el lookup de
-- crypt() de pgcrypto que vive en schema extensions.
--
-- Impact: las PWAs operario (/m/cn login + /m/ve login + /m/admin login)
-- estaban TOTALMENTE rotas — el login con PIN devolvía "function
-- crypt(text, text) does not exist".
--
-- La migración 0020b había aplicado el fix originalmente, pero 0025 lo
-- pisó con DROP + CREATE sin preservar el search_path correcto.
--
-- Detectado 2026-05-26 noche durante audit preventivo post setup Resend.
-- Fix: re-aplicar con search_path = public, extensions.
--
-- Lección: cualquier RPC que use crypt/gen_salt/gen_random_bytes/digest/
-- uuid_generate_v4/hmac de pgcrypto DEBE tener `extensions` en search_path
-- o usar qualifier `extensions.X()` explícito.

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$func$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030. search_path incluye extensions para resolver crypt() de pgcrypto.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;
$sdd0118_7_0$
  ]
where version = '20260528060010'
  and name = '0035_fix_verify_operario_pin_extensions'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_8_0$-- 0036_fk_user_tenants_profile.sql
--
-- Fix bug: /studio/usuarios devolvía HTTP 400 al consumir
-- `user_tenants?select=...,profile:user_profiles(*)`.
--
-- Causa: PostgREST requiere FK declarada para resolver embed
-- `profile:user_profiles(*)`. La tabla user_tenants NO tenía
-- FK a user_profiles (solo a tenants), aunque user_tenants.user_id
-- y user_profiles.user_id son siempre el mismo uuid de auth.users.
--
-- Fix: agregar FK explícita. user_profiles.user_id ya es PK,
-- así que el target es válido. ON DELETE CASCADE matchea el
-- comportamiento de user_profiles → auth.users.
--
-- Detectado 2026-05-26 al revisar logs API durante audit post-Resend.

alter table public.user_tenants
  add constraint user_tenants_user_id_profile_fkey
  foreign key (user_id) references public.user_profiles(user_id)
  on delete cascade;

-- Refresh PostgREST schema cache para que reconozca la FK nueva inmediato
notify pgrst, 'reload schema';
$sdd0118_8_0$
  ]
where version = '20260528060011'
  and name = '0036_fk_user_tenants_profile'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_9_0$-- 0037_harden_operario_pin_validator.sql
--
-- Mejora seguridad: el validator validate_operario_pin_format solo
-- chequeaba que el PIN tuviera 4 dígitos numéricos. NO bloqueaba PINs
-- comunes (1234, 0000, etc) que son trivialmente vulnerable a brute force
-- en login PIN (sin lockout actual).
--
-- Detectado 2026-05-26: durante audit post-Resend, operario Yusneidy Pérez
-- tenía PIN '1234'. Top 10 PINs más comunes representan ~15% de todos los
-- PINs en estudios reales.
--
-- Fix: agregar blacklist explícita de 24 PINs débiles comunes al validator.
-- Aplica a admin_create_operario y admin_reset_operario_pin que llaman
-- a esta función.
--
-- Operarios existentes con PINs débiles NO se resetean automáticamente
-- (impactaría operación). El founder decide cuándo y con qué PIN nuevo.
--
-- Referencia: https://datagenetics.com/blog/september32012/

create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elegí uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

comment on function public.validate_operario_pin_format is
  'Valida format PIN (4 dígitos) + blacklist de PINs comunes. Llamada desde admin_create_operario y admin_reset_operario_pin.';
$sdd0118_9_0$
  ]
where version = '20260528060012'
  and name = '0037_harden_operario_pin_validator'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_10_0$-- 0039_fix_bug_advance_state_actor_type_cast.sql
--
-- Fix bug en bug_advance_state RPC: falla con
--   "column actor_type is of type bug_author_type but expression is of type text"
-- al intentar cambiar el estado de un bug desde el drawer admin.
--
-- Causa: el INSERT a bug_timeline pasa un `case when ... then 'admin' else 'user' end`
-- expression que PostgreSQL infiere como `text`. La columna actor_type es enum
-- bug_author_type y PostgreSQL no auto-castea text → enum en INSERT context.
--
-- Detectado 2026-05-26 al testear F5 mínimo viable (creé BUG-00003 crítico y
-- Sam intentó clickear "Tomar bug" desde el drawer).
--
-- Fix: cast explícito al final del case expression:
--   (case when ... else ... end)::bug_author_type

create or replace function public.bug_advance_state(
  p_bug_id uuid,
  p_new_state bug_state,
  p_note text default null
)
returns bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  if v_actor_role <> 'admin' then
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- FIX 0039: cast explícito a bug_author_type
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id, 'state_change', v_actor,
    (case when v_actor_role = 'admin' then 'admin' else 'user' end)::bug_author_type,
    jsonb_build_object('from_state', v_old_state, 'to_state', p_new_state, 'note', p_note)
  );

  return v_row;
end;
$func$;
$sdd0118_10_0$
  ]
where version = '20260528060013'
  and name = '0039_fix_bug_advance_state_actor_type_cast'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa';

do $sdd0118_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_postflight$;
$sdd0118_split_patched_0271$
]
where version = '20260729135053'
  and name = '0271_repair_branch_replay_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0839e50eeb47a158382fc2f6c27d5fe9'
    )
    or (
      cardinality(statements) = 13
      and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
    )
  );

do $sdd0118_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c7b1f468087e249e2ca44359aa3f686f'
  ) then
    raise exception '0280 abortada: 0271 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_split_postconditions$;

$sdd0118_replay_gate_0$
]
where version = '20260730002206'
  and name = '0280_repair_sdd0118_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '0cd59e31c466de0286c5b82091d3db32';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_1$-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('887cc625c50ba8f6a2292bad25989fc5', '4242bf102d649559d13793b53e46f43c')
        )
        or (
          cardinality(statements) = 4
          and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
        )
      )
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_invite_skip_split_patched_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f');

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f');

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_patched_0272$
]
where version = '20260729140214'
  and name = '0272_skip_superseded_invite_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '887cc625c50ba8f6a2292bad25989fc5'
    )
    or (
      cardinality(statements) = 4
      and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
    )
  );

do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$;

$sdd0118_replay_gate_1$
]
where version = '20260730011643'
  and name = '0281_repair_invite_skip_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '08ffa846d67496336012a46029848d1a';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_2$-- SDD-0118 · hacer replay-safe el skip histórico de platform_admins.
-- Sólo sustituye el payload de 0273 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_platform_admin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('22cac3383ef1d3c9a0a814508cc4c817', '7866d00b211f8158f79117657fd8a8d1')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
        )
      )
  ) then
    raise exception '0282 abortada: ledger 0273 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_platform_admin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_split_patched_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            'cb374d4ad4c3b2bb62915e80a5a13793'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
        )
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
    )
  );

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_patched_0273$ || chr(13) || chr(10)
]
where version = '20260729141805'
  and name = '0273_skip_platform_admin_bootstrap_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '22cac3383ef1d3c9a0a814508cc4c817'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
    )
  );

do $sdd0118_platform_admin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7866d00b211f8158f79117657fd8a8d1'
  ) then
    raise exception '0282 abortada: 0273 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_platform_admin_split_postconditions$;

$sdd0118_replay_gate_2$
]
where version = '20260730130403'
  and name = '0282_repair_platform_admin_skip_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '5525c9ef4374d967e99d8886d4ec9532';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_3$-- SDD-0118 · hacer replay-safe el restaurador histórico de calculator_settings.
-- Sólo sustituye el payload de 0274 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_calculator_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6ddc823788cbdd6b280810d7ae61a86c', '7dec3bd4977326580000cbdb0d528305')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
        )
      )
  ) then
    raise exception '0283 abortada: ledger 0274 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_calculator_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_split_patched_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
        )
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_settings_target$-- ─────────────────────────────────────────────────────────────
-- 0103 · Calculadora pública Fase 3 (Slice A) · calculator_settings
--        + RPC public_calculator_config() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) ya toma la
-- TARIFA BASE y el PISO desde la tarifa real del Studio (Fase 2, rates.is_public).
-- Pero el RESTO de las reglas (peso incluido por CBM, $/kg de excedente,
-- descuento Valencia, multiplicador de baterías, km del casco, $/km, recargo
-- de embalaje especial) sigue HARDCODEADO en lib/calculadora.ts (CONFIG).
-- Slice A las saca al Studio: el admin las edita en /studio/tarifas › Parámetros.
--
-- Alcance de esta tabla: SOLO las reglas escalares del calculador. La tarifa
-- base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
-- (fuente única, Fase 2). Ciudades y embalajes quedan para Slice B.
--
-- Mecanismo: una fila por tenant (singleton, tenant_id como PK). El sitio
-- público la lee vía RPC anon de retorno mínimo. Si no hay fila, el calculador
-- cae a los defaults de CONFIG (cero regresión).
--
-- Decisiones (mismo patrón que 0101):
--  · Singleton por tenant_id PK → no hay ambigüedad de "cuál config".
--  · CHECKs de cordura → previene config que rompa el cálculo (peso_max <
--    peso_incluido, multiplicador < 1, negativos).
--  · RPC scopeada a slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: create table if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla singleton por tenant
create table if not exists public.calculator_settings (
  tenant_id                 uuid primary key references public.tenants(id) on delete cascade,
  -- Reglas escalares del calculador LCL DDP (espejo de CONFIG en lib/calculadora.ts)
  peso_incluido_kg          numeric(10,2) not null default 500,   -- kg/CBM incluidos sin recargo
  peso_max_kg               numeric(10,2) not null default 600,   -- kg/CBM tope → alerta FCL
  recargo_excedente_kg      numeric(10,2) not null default 1,     -- $/kg sobre peso_incluido
  descuento_valencia        numeric(10,2) not null default 50,    -- $ off si destino = Valencia
  recargo_embalaje_especial numeric(10,2) not null default 50,    -- $ por embalaje madera/paleta
  recargo_bateria_mult      numeric(10,3) not null default 1.5,   -- ×flete si lleva baterías
  threshold_casco_km        numeric(10,2) not null default 200,   -- km de casco central (flat)
  tarifa_km_fuera_casco     numeric(10,2) not null default 1,     -- $/km fuera del casco
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id),
  -- Cordura: una config inválida rompería el calculador público.
  constraint calculator_settings_peso_incluido_pos check (peso_incluido_kg > 0),
  constraint calculator_settings_peso_max_gte_incluido check (peso_max_kg >= peso_incluido_kg),
  constraint calculator_settings_excedente_nonneg check (recargo_excedente_kg >= 0),
  constraint calculator_settings_descuento_nonneg check (descuento_valencia >= 0),
  constraint calculator_settings_embalaje_nonneg check (recargo_embalaje_especial >= 0),
  constraint calculator_settings_bateria_gte_one check (recargo_bateria_mult >= 1),
  constraint calculator_settings_casco_nonneg check (threshold_casco_km >= 0),
  constraint calculator_settings_km_nonneg check (tarifa_km_fuera_casco >= 0)
);

comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated;

-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security;

create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at();

-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config();

create or replace function public.public_calculator_config()
returns table (
  peso_incluido_kg          numeric,
  peso_max_kg               numeric,
  recargo_excedente_kg      numeric,
  descuento_valencia        numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult      numeric,
  threshold_casco_km        numeric,
  tarifa_km_fuera_casco     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;
$sdd0118_calculator_settings_target$
]
where version = '20260604131310'
  and name = '0103_calculator_settings'
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
    )
  );

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_postflight$;
$sdd0118_calculator_split_patched_0274$ || chr(13) || chr(10)
]
where version = '20260729143620'
  and name = '0274_restore_calculator_settings_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6ddc823788cbdd6b280810d7ae61a86c'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
    )
  );

do $sdd0118_calculator_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7dec3bd4977326580000cbdb0d528305'
  ) then
    raise exception '0283 abortada: 0274 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_calculator_split_postconditions$;

$sdd0118_replay_gate_3$
]
where version = '20260730132651'
  and name = '0283_repair_calculator_settings_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '6614a85c247cf6ead23573f7a8cb2514';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_4$-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('a217fa825ff964f2c2a4cb26d31c3dbc', 'cad36533b4225b674f1d8fd7b8c165ea')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
        )
      )
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_split_patched_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
    )
  );

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_patched_0275$
]
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'a217fa825ff964f2c2a4cb26d31c3dbc'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
    )
  );

do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$;

$sdd0118_replay_gate_4$
]
where version = '20260730160209'
  and name = '0284_repair_pin_search_path_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = 'ca7f9d149eeb6eff924cb6d813094fef';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_5$-- SDD-0118 · hacer replay-safe el restaurador histórico de revoke_anon.
-- Sólo sustituye el payload de 0276 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_revoke_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('784f95726bd9c6f21963722f1ce7e61d', '66df90af092b02ae8c0a87f5e2bc08e0')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
        )
      )
  ) then
    raise exception '0285 abortada: ledger 0276 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_revoke_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_split_patched_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 101
          and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
--
-- Contexto: `create function` en Postgres otorga EXECUTE a PUBLIC por default.
-- Varias migraciones que recrearon funciones (`drop` + `create or replace`)
-- re-abrieron ese grant, dejando 57 funciones SECURITY DEFINER ejecutables por
-- `anon` vía /rest/v1/rpc/* (flag `anon_security_definer_function_executable`
-- del advisor de Supabase, 2026-07-03).
--
-- Este sweep cubre las 48 que NO son públicas intencionales:
--   - revoke execute from public, anon  → anon pierde la superficie
--   - grant execute to authenticated, service_role → cero regresión para los
--     callers legítimos (Studio/portal con cliente de usuario + server actions
--     y API routes con cliente admin).
--
-- Allowlist EXCLUIDA del sweep (diseñadas para anon, consumidas por
-- lib/public/* con getAnonClient() — calculadora, track, servicios — y
-- /verificar):
--   public_calculator_cities · public_calculator_config · public_cbm_rate
--   public_fcl_rates · public_ocean_rate · public_service_faqs
--   public_servicios · public_track_shipment · academy_verify_diploma
--
-- Verificación previa de riesgo (2026-07-03): las 4 más sensibles tienen guard
-- interno (get_user_tenant_id() / membresía user_tenants / operario_pins), y
-- ninguna superficie pre-auth del código llama RPCs de esta lista con cliente
-- anon. Regla permanente: toda migración nueva que cree funciones debe hacer
-- `revoke ... from public, anon` + grant explícito (memoria del repo).

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon;
grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role;
revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon;
grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate() to authenticated, service_role;
revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon;
grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role;
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.get_portal_client_tenant() from public, anon;
grant execute on function public.get_portal_client_tenant() to authenticated, service_role;
revoke execute on function public.has_any_back_role() from public, anon;
grant execute on function public.has_any_back_role() to authenticated, service_role;
revoke execute on function public.has_back_role(check_role back_role) from public, anon;
grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon;
grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon;
grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon;
grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon;
grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon;
grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon;
grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role;
revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon;
grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role;
revoke execute on function public.portal_post_message(p_body text) from public, anon;
grant execute on function public.portal_post_message(p_body text) to authenticated, service_role;
revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon;
grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon;
grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon;
grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon;
grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon;
grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.update_user_tenants_last_login() from public, anon;
grant execute on function public.update_user_tenants_last_login() to authenticated, service_role;
revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon;
grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role;
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and (
    statements is null
    or (
      cardinality(statements) = 101
      and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
    )
  );

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_patched_0276$
]
where version = '20260729163005'
  and name = '0276_restore_revoke_anon_rpc_sweep_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '784f95726bd9c6f21963722f1ce7e61d'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
    )
  );

do $sdd0118_revoke_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '66df90af092b02ae8c0a87f5e2bc08e0'
  ) then
    raise exception '0285 abortada: 0276 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_revoke_split_postconditions$;

$sdd0118_replay_gate_5$
]
where version = '20260730160939'
  and name = '0285_repair_revoke_anon_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = 'db953b1adc8f6dcad4bd040b59c461d7';

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_6$-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5251a9ca8ccbf579c5b81688e63acb01', 'd67b2e81a67028e56bd994f47ce16f6d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
        )
      )
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_split_patched_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_patched_0279$ || chr(13) || chr(10)
]
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5251a9ca8ccbf579c5b81688e63acb01'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
    )
  );

do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$;

$sdd0118_replay_gate_6$
]
where version = '20260730161446'
  and name = '0286_repair_tenant_acl_split_history'
  and cardinality(statements) = 1
  and md5(statements[1]) = '5d42c84f8fb245ea9514ee80cab24a39';

do $sdd0118_replay_gates_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '42542bfd279507a4a89c87c54a6c619b'
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '19eb51d4802a0af27a12bf634fa2543d'
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '6185c626816290531c5e287a25db1a95'
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '8dd851b83f33abc1417d82d0d61c208c'
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd2f3bc6fac74a836c96be81c40c2bcce'
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0d656e4a3a856160d1323c49b60baa70'
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'fbf9cbd3180f161a4a0462fee2c3fea8'
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history no quedó en el estado objetivo';
  end if;
end
$sdd0118_replay_gates_postconditions$;

$sdd0118_finalizer_source_0287$]
);

\ir ../migrations/0288_finalize_replay_gate_split_history.sql
\ir ../migrations/0288_finalize_replay_gate_split_history.sql

select statements[1]
from supabase_migrations.schema_migrations
where version = '20260730162532'
  and name = '0287_repair_replay_gate_split_history'
\gexec

do $repair_contracts$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '42542bfd279507a4a89c87c54a6c619b'
  ) then
    raise exception 'TEST 0288: 0280_repair_sdd0118_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '19eb51d4802a0af27a12bf634fa2543d'
  ) then
    raise exception 'TEST 0288: 0281_repair_invite_skip_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '6185c626816290531c5e287a25db1a95'
  ) then
    raise exception 'TEST 0288: 0282_repair_platform_admin_skip_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '8dd851b83f33abc1417d82d0d61c208c'
  ) then
    raise exception 'TEST 0288: 0283_repair_calculator_settings_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd2f3bc6fac74a836c96be81c40c2bcce'
  ) then
    raise exception 'TEST 0288: 0284_repair_pin_search_path_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0d656e4a3a856160d1323c49b60baa70'
  ) then
    raise exception 'TEST 0288: 0285_repair_revoke_anon_split_history no colapsó';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'fbf9cbd3180f161a4a0462fee2c3fea8'
  ) then
    raise exception 'TEST 0288: 0286_repair_tenant_acl_split_history no colapsó';
  end if;
end
$repair_contracts$;

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_finalizer_0287_split_0$-- SDD-0118/SDD-0172 · hacer replay-safe los gates 0280–0286.
-- Sólo sustituye payloads del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_replay_gates_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0cd59e31c466de0286c5b82091d3db32', '42542bfd279507a4a89c87c54a6c619b')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '9028fffb80d2c9893aabf1e6ee7afb6e'
        )
      )
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('08ffa846d67496336012a46029848d1a', '19eb51d4802a0af27a12bf634fa2543d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '2497d8f67f2cda02d8cb5cab9b113844'
        )
      )
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5525c9ef4374d967e99d8886d4ec9532', '6185c626816290531c5e287a25db1a95')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '4ee8cb102e54fd9623f858df6e032910'
        )
      )
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6614a85c247cf6ead23573f7a8cb2514', '8dd851b83f33abc1417d82d0d61c208c')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '96ba90f48a4f9c1742d7d52aabdf8d8d'
        )
      )
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('ca7f9d149eeb6eff924cb6d813094fef', 'd2f3bc6fac74a836c96be81c40c2bcce')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '6b62b8b4eb08cce4a7cdf7f848f3857a'
        )
      )
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('db953b1adc8f6dcad4bd040b59c461d7', '0d656e4a3a856160d1323c49b60baa70')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = 'e7ef637390bc02fcbda73db1117581bb'
        )
      )
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5d42c84f8fb245ea9514ee80cab24a39', 'fbf9cbd3180f161a4a0462fee2c3fea8')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '8cc6e74326c8780d2002233d3e4cc989'
        )
      )
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history ausente, ambiguo o con drift';
  end if;
end
$sdd0118_replay_gates_preflight$$sdd0118_finalizer_0287_split_0$,
    $sdd0118_finalizer_0287_split_1$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_0$-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0839e50eeb47a158382fc2f6c27d5fe9', 'c7b1f468087e249e2ca44359aa3f686f')
        )
        or (
          cardinality(statements) = 13
          and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
        )
      )
  ) then
    raise exception '0280 abortada: ledger 0271 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_split_patched_0271$-- SDD-0118 · reparar el replay de branches sin ejecutar DDL de negocio.
-- La migración sólo modifica statements del ledger con precondiciones exactas.
-- Los SQL históricos quedan almacenados como texto para futuros replays.
-- 0280 acepta además la fragmentación exacta observada en un branch fresco.
-- 20260526213130 <- 0018_mailing.sql · md5 e2e1b4c3846c7fba431455c9130f0d34
-- 20260527073053 <- 0024_dispatch_core.sql · md5 fc9872ff14733d3d9cac5f0cbb330962
-- 20260527073053 <- 0025_operario_roles_extend.sql · md5 bc9153c31f543e4a74aaa2c570a7aff4
-- 20260528060005 <- 0026_welcome_email_template_seed.sql · md5 b0a7c682cc6031be6034940cb27a5702
-- 20260528060006 <- 0027_qr_print_orders.sql · md5 b760d6196dc02d67036148d33b4ce1f1
-- 20260528060007 <- 0031_fix_studio_invite_gen_random_bytes.sql · md5 8296dce3805f143e549a239995bd954a
-- 20260528060008 <- 0032_fix_studio_invite_ambiguous_token.sql · md5 bb5879cd44f1b5911511e223a0618e51
-- 20260528060009 <- 0033_grant_service_role_policies.sql · md5 a09e03f9f62c47b32ee0a5b4902fa834
-- 20260528060010 <- 0035_fix_verify_operario_pin_extensions.sql · md5 732f8ed961708b91b94cf4965ca8d797
-- 20260528060011 <- 0036_fk_user_tenants_profile.sql · md5 ba63f9c578e32019aaafc8e6d6247056
-- 20260528060012 <- 0037_harden_operario_pin_validator.sql · md5 6e3f5a4763cd32e66a33f189af2da876
-- 20260528060013 <- 0039_fix_bug_advance_state_actor_type_cast.sql · md5 f2872b0ac20dd9e070b14085a60a3fb6

do $sdd0118_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_0_0$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_0_0$
  ] || statements
where version = '20260526213130'
  and name = 'seed_team_invitation_template'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_1_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0029 Fase 1: Módulo Despacho · core (admin web)
--
-- Pipeline 3-actor (Admin/Bodeguero/Camionero) sobre Órdenes de
-- Despacho (ODs). Esta migración cubre SOLO el lado Admin (Fase 1).
-- Las apps móviles de bodeguero+camionero llegan en SDD-0030.
--
-- Cubre:
--   - 6 enums (status OD · hub · payment policy · route type · split reason · incident severity)
--   - Catálogo VE público (ve_locality_catalog): 24 estados · ~98 ciudades · IPOSTEL
--   - 5 tablas per-tenant: dispatch_orders · dispatch_order_packages
--                          dispatch_routes · dispatch_city_catalog
--                          dispatch_rules
--   - Extensión aditiva: warehouse_receipts_cn.description NULLABLE
--     (Wang Hua YIW-A1 y el wizard /m/cn/nueva siguen idénticos)
--   - 4 RPCs: next_dispatch_order_code · next_route_code
--             upsert_dispatch_rules · seed_tenant_cities_from_ve_catalog
--   - Trigger guard de transición de status
--   - RLS por tenant_id en las 5 tablas privadas
--
-- 100% aditivo y no destructivo. Catálogo VE es global (sin RLS, solo lectura).
-- ─────────────────────────────────────────────────────────────

-- ── ENUMS ────────────────────────────────────────────────────

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- ─────────────────────────────────────────────────────────────
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
-- ─────────────────────────────────────────────────────────────

create table public.ve_locality_catalog (
  state_code      text not null,             -- 'CAR'
  state_name      text not null,             -- 'Carabobo'
  state_region    text not null,             -- 'Centro'
  state_capital   text not null,
  municipio       text not null,             -- 'Valencia'
  city            text not null,             -- 'Valencia'
  postal_code     text not null,             -- '2001' (IPOSTEL)
  parroquias      text[] not null default '{}',
  barrios         text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant.';

create index ve_locality_catalog_postal_idx
  on public.ve_locality_catalog (postal_code);

create index ve_locality_catalog_region_idx
  on public.ve_locality_catalog (state_region);

grant select on public.ve_locality_catalog to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed catálogo VE (24 estados · ~98 ciudades · IPOSTEL)
-- ─────────────────────────────────────────────────────────────

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code, parroquias, barrios)
values
  -- Distrito Capital
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Centro)', '1010', ARRAY['Catedral','San José','La Pastora','El Recreo'], ARRAY['El Silencio','San Bernardino','Cotiza','La Candelaria']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Oeste)',  '1020', ARRAY['Antímano','Caricuao','La Vega','Macarao'], ARRAY['Caricuao','Antímano','La Yaguara']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Sur)',    '1080', ARRAY['El Valle','Coche','Santa Rosalía'], ARRAY['El Valle','Coche','Las Acacias']),

  -- Caracas Metropolitana (virtual · 4 alcaldías)
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Chacao',     'Chacao (Caracas)',  '1060', ARRAY['Chacao'], ARRAY['Chacao','La Castellana','Country Club','Altamira']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Baruta',     'Baruta (Caracas)',  '1080', ARRAY['Baruta','El Cafetal','Las Minas'], ARRAY['Las Mercedes','Santa Mónica','Sorocaima']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Sucre',      'Petare',            '1070', ARRAY['Petare','Caucagüita','Filas de Mariche','La Dolorita','Leoncio Martínez'], ARRAY['Petare','Mariperez','Cumbres de Curumo']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'El Hatillo', 'El Hatillo',        '1083', ARRAY['El Hatillo'], ARRAY['El Hatillo','La Lagunita','Oripoto']),

  -- Amazonas
  ('AMA', 'Amazonas', 'Guayana', 'Puerto Ayacucho', 'Atures', 'Puerto Ayacucho', '7101', ARRAY['Atures'], ARRAY['Centro']),

  -- Anzoátegui
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Simón Bolívar',              'Barcelona',         '6001', ARRAY['Bergantín','El Carmen','San Cristóbal'], ARRAY['Centro','Boyacá']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Sotillo',                    'Puerto La Cruz',    '6023', ARRAY['Pozuelos'], ARRAY['Centro','Lechería']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Diego Bautista Urbaneja',    'Lechería',          '6016', ARRAY['Lechería'], ARRAY['Lechería','El Morro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Anaco',                      'Anaco',             '6003', ARRAY['Anaco'], ARRAY['Centro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Pedro María Freites',        'Cantaura',          '6004', ARRAY['Cantaura'], ARRAY[]::text[]),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Independencia',              'Soledad',           '6010', ARRAY['Mamo'], ARRAY[]::text[]),

  -- Apure
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'San Fernando', 'San Fernando de Apure', '7001', ARRAY['San Fernando'], ARRAY['Centro']),
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'Páez',         'Guasdualito',           '7011', ARRAY['Guasdualito'], ARRAY[]::text[]),

  -- Aragua
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Girardot',                  'Maracay',     '2101', ARRAY['Las Delicias','José Casanova Godoy','Joaquín Crespo'], ARRAY['San Jacinto','Las Delicias','El Castaño','Caña de Azúcar','La Soledad']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Mario Briceño Iragorry',    'El Limón',    '2105', ARRAY['Caña de Azúcar'], ARRAY['El Limón']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Santiago Mariño',           'Turmero',     '2115', ARRAY['Turmero'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Sucre',                     'Cagua',       '2122', ARRAY['Cagua'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'José Ángel Lamas',          'Santa Cruz',  '2128', ARRAY['Santa Cruz'], ARRAY[]::text[]),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Linares Alcántara',         'Santa Rita',  '2123', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Barinas
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Barinas',                    'Barinas', '5201', ARRAY['Barinas','Alto Barinas'], ARRAY['Centro','Alto Barinas']),
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Antonio José de Sucre',      'Socopó',  '5212', ARRAY['Socopó'], ARRAY[]::text[]),

  -- Bolívar
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Heres',  'Ciudad Bolívar',                 '8001', ARRAY['Catedral','Vista Hermosa'], ARRAY['Centro','Vista Hermosa','Sabana del Hueso']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Caroní', 'Ciudad Guayana / Puerto Ordaz',  '8050', ARRAY['Cachamay','Universidad','Unare','Vista al Sol','Once de Abril'], ARRAY['Alta Vista','Castillito','Los Olivos','Villa Bolívar']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Piar',   'Upata',                          '8021', ARRAY['Upata'], ARRAY['Centro']),

  -- Carabobo
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia',       'Valencia',       '2001', ARRAY['San José','San Blas','Catedral','Candelaria'], ARRAY['El Viñedo','Trigal Norte','San José','Prebo','El Recreo','La Granja']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Naguanagua',     'Naguanagua',     '2005', ARRAY['Naguanagua'], ARRAY['Mañongo','La Granja','Bárbula']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'San Diego',      'San Diego',      '2006', ARRAY['San Diego'], ARRAY['Yuma','Castillito']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Los Guayos',     'Los Guayos',     '2014', ARRAY['Los Guayos'], ARRAY[]::text[]),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Guacara',        'Guacara',        '2015', ARRAY['Guacara'], ARRAY['Centro']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Puerto Cabello', 'Puerto Cabello', '2050', ARRAY['Fraternidad','Bartolomé Salom','Goaigoaza'], ARRAY['Centro','Cumboto']),

  -- Cojedes
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Ezequiel Zamora', 'San Carlos',  '2201', ARRAY['San Carlos'], ARRAY['Centro']),
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Tinaquillo',      'Tinaquillo',  '2204', ARRAY['Tinaquillo'], ARRAY['Centro']),

  -- Delta Amacuro
  ('DEL', 'Delta Amacuro', 'Guayana', 'Tucupita', 'Tucupita', 'Tucupita', '9001', ARRAY['Tucupita'], ARRAY['Centro']),

  -- Falcón
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Miranda',     'Coro',                       '4101', ARRAY['Santa Ana','San Antonio'], ARRAY['Centro','Cruz Verde','Curazaito']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Carirubana',  'Punto Fijo',                 '4102', ARRAY['Carirubana','Norte','Punta Cardón'], ARRAY['Centro','Las Pioneras','Cardón']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Los Taques',  'Santa Cruz de Los Taques',   '4106', ARRAY['Los Taques'], ARRAY[]::text[]),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Federación',  'Churuguara',                 '4115', ARRAY['Churuguara'], ARRAY[]::text[]),

  -- Guárico
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Juan Germán Roscio',     'San Juan de los Morros',  '2301', ARRAY['San Juan'], ARRAY['Casco Central','Pariata','La Toscana']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Francisco de Miranda',   'Calabozo',                '2312', ARRAY['Calabozo'], ARRAY['Centro']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Camaguán',               'Camaguán',                '2317', ARRAY['Camaguán'], ARRAY[]::text[]),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'José Tadeo Monagas',     'Altagracia de Orituco',   '2304', ARRAY['Altagracia'], ARRAY[]::text[]),

  -- La Guaira
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'La Guaira',     '1163', ARRAY['Catia La Mar','Maiquetía','La Guaira'], ARRAY['Maiquetía','Macuto']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Catia La Mar',  '1162', ARRAY['Catia La Mar'], ARRAY['Centro','Puerto Viejo']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Maiquetía',     '1161', ARRAY['Maiquetía'], ARRAY['Centro']),

  -- Lara
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Iribarren',  'Barquisimeto', '3001', ARRAY['Catedral','Concepción','Tamaca','El Cuji'], ARRAY['Centro','El Tostado','Las Trinitarias','Patarata']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Palavecino', 'Cabudare',     '3023', ARRAY['Cabudare'], ARRAY['Centro']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Crespo',     'Duaca',        '3050', ARRAY['Duaca'], ARRAY[]::text[]),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Torres',     'Carora',       '3040', ARRAY['Carora'], ARRAY['Centro']),

  -- Mérida
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Libertador',       'Mérida',     '5101', ARRAY['El Llano','Milla','Domingo Peña','Mariano Picón Salas'], ARRAY['La Hechicera','Belensate','Glorias Patrias','Mérida Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Campo Elías',      'Ejido',      '5113', ARRAY['Ejido'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Tovar',            'Tovar',      '5131', ARRAY['Tovar'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Alberto Adriani',  'El Vigía',   '5145', ARRAY['El Vigía'], ARRAY['Centro']),

  -- Miranda
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Guaicaipuro',     'Los Teques',        '1201', ARRAY['Los Teques','San Pedro'], ARRAY['Centro','San Pedro','Lomas de Urquía']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Plaza',           'Guarenas',          '1220', ARRAY['Guarenas'], ARRAY['Centro','Camatagua']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Zamora',          'Guatire',           '1221', ARRAY['Guatire'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Cristóbal Rojas', 'Charallave',        '1210', ARRAY['Charallave'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Urdaneta',        'Cúa',               '1213', ARRAY['Cúa'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Brión',           'Higuerote',         '1240', ARRAY['Higuerote'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Lander',          'Ocumare del Tuy',   '1211', ARRAY['Ocumare'], ARRAY['Centro']),

  -- Monagas
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Maturín',   'Maturín',     '6201', ARRAY['San Simón','San Vicente','Las Cocuizas'], ARRAY['La Floresta','Tipuro','Las Avenidas','Los Pinos']),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Caripe',    'Caripe',      '6225', ARRAY['Caripe'], ARRAY[]::text[]),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Punceres',  'Quiriquire',  '6213', ARRAY['Quiriquire'], ARRAY[]::text[]),

  -- Nueva Esparta
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Arismendi', 'La Asunción', '6301', ARRAY['La Asunción'], ARRAY['Centro']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Mariño',    'Porlamar',    '6313', ARRAY['Porlamar'], ARRAY['Centro','4 de Mayo','Genovés']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Maneiro',   'Pampatar',    '6315', ARRAY['Pampatar'], ARRAY['Centro','La Caranta']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Gómez',     'Santa Ana',   '6311', ARRAY['Santa Ana'], ARRAY[]::text[]),

  -- Portuguesa
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Guanare', 'Guanare',  '3322', ARRAY['Guanare','San Juan de Guanaguanare'], ARRAY['Centro','Mesa de Cavacas']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Páez',    'Acarigua', '3301', ARRAY['Acarigua'], ARRAY['Centro','Bolívar']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Araure',  'Araure',   '3303', ARRAY['Araure'], ARRAY['Centro']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Sucre',   'Biscucuy', '3330', ARRAY['Biscucuy'], ARRAY[]::text[]),

  -- Sucre
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Sucre',    'Cumaná',       '6101', ARRAY['Altagracia','Santa Inés','Valentín Valiente','Ayacucho'], ARRAY['Centro','Boca de Sabana','Los Tarales']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Bermúdez', 'Carúpano',     '6150', ARRAY['Santa Rosa','Santa Catalina'], ARRAY['Centro']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Cajigal',  'Yaguaraparo',  '6173', ARRAY['Yaguaraparo'], ARRAY[]::text[]),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Valdez',   'Güiria',       '6164', ARRAY['Güiria'], ARRAY[]::text[]),

  -- Táchira
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'San Cristóbal',         'San Cristóbal',              '5001', ARRAY['La Concordia','Pedro María Morantes','San Juan Bautista'], ARRAY['Centro','Pirineos','Las Lomas']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Cárdenas',              'Táriba',                     '5009', ARRAY['Táriba'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Bolívar',               'San Antonio del Táchira',    '5004', ARRAY['San Antonio'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Pedro María Ureña',     'Ureña',                      '5005', ARRAY['Ureña'], ARRAY[]::text[]),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Junín',                 'Rubio',                      '5030', ARRAY['Rubio'], ARRAY['Centro']),

  -- Trujillo
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Trujillo', 'Trujillo', '3101', ARRAY['Trujillo'], ARRAY['Centro']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Valera',   'Valera',   '3102', ARRAY['Valera','Mendoza'], ARRAY['Centro','La Plata','Plata III']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Boconó',   'Boconó',   '3104', ARRAY['Boconó'], ARRAY['Centro']),

  -- Yaracuy
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'San Felipe',    'San Felipe',    '3201', ARRAY['San Felipe','Albarico'], ARRAY['Centro','La Trinidad']),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Independencia', 'Independencia', '3206', ARRAY['Independencia'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Veroes',        'Farriar',       '3214', ARRAY['Farriar'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Bolívar',       'Aroa',          '3211', ARRAY['Aroa'], ARRAY[]::text[]),

  -- Zulia
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Maracaibo',              'Maracaibo',                '4001', ARRAY['Chiquinquirá','Coquivacoa','Cristo de Aranza','Bolívar','Santa Lucía'], ARRAY['Bella Vista','Tierra Negra','El Milagro','Indio Mara','Sabaneta']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'San Francisco',          'San Francisco',            '4002', ARRAY['San Francisco','Marcial Hernández'], ARRAY['Sierra Maestra','San Francisco Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Cabimas',                'Cabimas',                  '4013', ARRAY['Cabimas','Punta Gorda','Ambrosio'], ARRAY['Centro','Las Cabillas','La Rosa']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Lagunillas',             'Ciudad Ojeda',             '4019', ARRAY['Ciudad Ojeda'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Mara',                   'San Rafael del Moján',     '4012', ARRAY['Mara'], ARRAY[]::text[]),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Machiques de Perijá',    'Machiques',                '4045', ARRAY['Machiques'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Santa Rita',             'Santa Rita',               '4030', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Dependencias Federales
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'Los Roques',  'Gran Roque',  '1990', ARRAY[]::text[], ARRAY[]::text[]),
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'La Tortuga',  'Tortuga',     '1990', ARRAY[]::text[], ARRAY[]::text[]);

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_routes (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);

comment on table public.dispatch_routes is
  'Catálogo de rutas operativas per-tenant. Directa (origen→destino) o intermedias (con ciudades intermedias en jsonb). RLS por tenant. Soft-delete.';

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub)
  where deleted_at is null and active = true;

create index dispatch_routes_tenant_active_idx
  on public.dispatch_routes (tenant_id, active)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. dispatch_city_catalog (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

comment on table public.dispatch_city_catalog is
  'Catálogo de ciudades per-tenant. Se popula la primera vez con seed_tenant_cities_from_ve_catalog(). Tenant puede agregar ciudades custom o marcar is_hq.';

create index dispatch_city_catalog_tenant_active_idx
  on public.dispatch_city_catalog (tenant_id)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. dispatch_rules (1 row por tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring por tenant. 1 row por tenant. Editable desde /studio/despacho/reglas. Defaults aplicados si no existe row.';

-- ─────────────────────────────────────────────────────────────
-- 5. dispatch_orders (entidad central)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);

comment on table public.dispatch_orders is
  'Órdenes de Despacho (ODs). Entidad central del pipeline 3-actor. State machine cerrada (creada→cargando→lista→en_ruta→entregada→cerrada, terminal cancelada). Code OD-YYYY-NNNN.';

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status)
  where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_active_idx
  on public.dispatch_orders (tenant_id, driver_id)
  where status = 'lista';

create index dispatch_orders_parent_idx
  on public.dispatch_orders (parent_od_id)
  where parent_od_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 6. dispatch_order_packages (junction OD ↔ paquetes)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);

comment on table public.dispatch_order_packages is
  'Junction OD ↔ paquetes. Soporta carga fraccionada (boxes_shipped < boxes_total) con motivo obligatorio. FK polimórfico via package_kind + package_id (FK explícito en Fase 2 SDD-0030).';

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);

create index dispatch_order_packages_package_idx
  on public.dispatch_order_packages (package_kind, package_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Extensión aditiva: warehouse_receipts_cn.description NULLABLE
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE) + chofer entrega. NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá NOT NULL con 5to step opcional.';

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs
-- ─────────────────────────────────────────────────────────────

-- 8.1 · next_dispatch_order_code: secuencial OD-YYYY-NNNN por tenant
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_dispatch_order_code(uuid) is
  'Genera el próximo código OD-YYYY-NNNN para el tenant. Verifica que auth.uid() esté en user_tenants.';

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;

-- 8.2 · next_route_code: secuencial R-NNN por tenant (sin año)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(route_code from 'R-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-%';

  v_next := 'R-' || lpad((v_max + 1)::text, 3, '0');
  return v_next;
end;
$$;

comment on function public.next_route_code(uuid) is
  'Genera el próximo código R-NNN para el tenant. Verifica autorización.';

grant execute on function public.next_route_code(uuid) to authenticated;

-- 8.3 · upsert_dispatch_rules: idempotente, last-write-wins
create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes, updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules. Last-write-wins, sin lock optimista en Fase 1.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;

-- 8.4 · seed_tenant_cities_from_ve_catalog: copia inicial del catálogo público
create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ~98 ciudades del catálogo VE público a dispatch_city_catalog del tenant. Devuelve cuántas filas se insertaron (0 si ya estaban).';

grant execute on function public.seed_tenant_cities_from_ve_catalog(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger guard de transición de status
-- ─────────────────────────────────────────────────────────────

create or replace function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido modificar status desde terminales
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- entregada solo puede ir a cerrada
    if old.status = 'entregada' and new.status not in ('cerrada') then
      raise exception 'Desde entregada solo se puede ir a cerrada (intentado: %)', new.status;
    end if;

    -- lista no puede retroceder a cargando
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;

    -- en_ruta no puede retroceder a lista
    if old.status = 'en_ruta' and new.status = 'lista' then
      raise exception 'No se puede retroceder de en_ruta a lista';
    end if;

    -- Auto-stamp timestamps
    if new.status = 'en_ruta' and new.departed_at is null then
      new.departed_at := now();
    elsif new.status = 'entregada' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cerrada' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();

-- ─────────────────────────────────────────────────────────────
-- 10. RLS · tenant isolation
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- dispatch_orders: select + insert + update + delete via tenant_id
create policy dispatch_orders_select on public.dispatch_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_insert on public.dispatch_orders
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_update on public.dispatch_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_delete on public.dispatch_orders
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_order_packages: tenant via JOIN al OD
create policy dispatch_order_packages_select on public.dispatch_order_packages
  for select using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_insert on public.dispatch_order_packages
  for insert with check (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_update on public.dispatch_order_packages
  for update using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_delete on public.dispatch_order_packages
  for delete using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

-- dispatch_routes
create policy dispatch_routes_select on public.dispatch_routes
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_insert on public.dispatch_routes
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_update on public.dispatch_routes
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_delete on public.dispatch_routes
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_city_catalog
create policy dispatch_city_catalog_select on public.dispatch_city_catalog
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_insert on public.dispatch_city_catalog
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_update on public.dispatch_city_catalog
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_delete on public.dispatch_city_catalog
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_rules
create policy dispatch_rules_select on public.dispatch_rules
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_insert on public.dispatch_rules
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_update on public.dispatch_rules
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_packages to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_city_catalog to authenticated;
grant select, insert, update on public.dispatch_rules to authenticated;
$sdd0118_1_0$,
    $sdd0118_1_1$-- ─────────────────────────────────────────────────────────────
-- SDD-0030 Fase 2: Apps móviles bodeguero VE + camionero VE
--
-- Extiende operario_pins.role para soportar los 2 roles nuevos del
-- pipeline de Despacho (bodeguero arma camiones, camionero entrega).
-- + Tabla dispatch_pods (proofs of delivery).
-- + 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
--   camionero_advance_od · camionero_pod
-- + Update verify_operario_pin para devolver region.
--
-- 100% aditivo. NO toca operarios CN existentes (Wang Hua YIW-A1 sigue
-- idéntica · role='operario', region='cn').
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Extender CHECK constraint del role
-- ─────────────────────────────────────────────────────────────

alter table public.operario_pins drop constraint operario_pins_role_check;

alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );

comment on column public.operario_pins.role is
  'Rol del operario · operario|supervisor (CN almacén) o bodeguero|camionero (VE despacho). Bodeguero arma camiones; camionero entrega. SDD-0030.';

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla dispatch_pods (proofs of delivery)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

comment on table public.dispatch_pods is
  'Proofs of Delivery (POD) de Órdenes de Despacho. 1 fila por entrega confirmada por el camionero PWA. Photo + signature paths apuntan al bucket receipt-photos con prefijos pod/ y firma/.';

create index dispatch_pods_od_idx
  on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx
  on public.dispatch_pods (tenant_id, created_at desc);

alter table public.dispatch_pods enable row level security;

-- Admins del tenant pueden leer todos los PODs (consulta auditable)
create policy dispatch_pods_select on public.dispatch_pods
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- Inserts vienen via RPC (security definer · service_role bypass)
-- No exponemos insert a authenticated.

grant select on public.dispatch_pods to authenticated;
grant select, insert, update, delete on public.dispatch_pods to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Update RPC verify_operario_pin · agregar region en el return
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,             -- nullable desde SDD-0023 (chofer/bodeguero VE no necesariamente)
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region   -- NUEVO en SDD-0030
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030 extiende SDD-0027.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC bodeguero_advance_od
--
-- Transiciones permitidas para el bodeguero:
--   creada → cargando        (al abrir la OD)
--   cargando → lista         ("Cerrar carga")
--
-- Validaciones:
--   - operario activo + role='bodeguero' (o supervisor VE legacy)
--   - OD existe + tenant match
--   - Transición permitida por trigger guard (deja que el trigger valide)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE pueden actuar sobre Despacho' using errcode = 'P0003';
  end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede avanzar carga' using errcode = 'P0004';
  end if;

  -- 2. Validar OD tenant
  select tenant_id into v_od_tenant
    from public.dispatch_orders
   where id = p_od_id;

  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 3. Validar transición esperada (whitelist bodeguero)
  if p_status not in ('cargando', 'lista') then
    raise exception 'Transición % no permitida para bodeguero', p_status using errcode = 'P0007';
  end if;

  -- 4. Update (trigger guard valida la transición real desde el current)
  update public.dispatch_orders
     set status = p_status,
         updated_by = null,                    -- operario no tiene auth.uid
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status) is
  'Advance OD desde la PWA del bodeguero. Solo permite creada→cargando→lista. Resto bloqueado por el trigger guard.';

revoke all on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  from public, anon, authenticated;
grant execute on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC bodeguero_split_p2
--
-- Fracciona un paquete: actualiza la fila junction existente con
-- boxes_shipped < boxes_total y motivo, y crea una OD nueva (P2)
-- con parent_od_id apuntando a la P1.
--
-- La P2 queda con status='creada' sin camión/chofer (admin la asigna).
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_split_p2(
  p_operario_id        uuid,
  p_od_id              uuid,
  p_package_id         uuid,
  p_boxes_shipped      int,
  p_split_reason       dispatch_split_reason,
  p_split_reason_text  text
)
returns uuid           -- id de la OD P2 creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_role           text;
  v_region         operario_region;
  v_active         boolean;
  v_pkg            public.dispatch_order_packages%rowtype;
  v_od             public.dispatch_orders%rowtype;
  v_remaining      int;
  v_new_od_id      uuid;
  v_new_code       text;
begin
  -- 1. Validar operario (igual pattern que bodeguero_advance_od)
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede fraccionar' using errcode = 'P0004';
  end if;

  -- 2. Lock + leer el paquete
  select * into v_pkg
    from public.dispatch_order_packages
   where od_id = p_od_id and package_id = p_package_id
   for update;
  if v_pkg.od_id is null then
    raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
  end if;

  -- 3. Validar boxes_shipped
  if p_boxes_shipped <= 0 or p_boxes_shipped >= v_pkg.boxes_total then
    raise exception 'boxes_shipped debe estar entre 1 y boxes_total-1' using errcode = 'P0009';
  end if;

  v_remaining := v_pkg.boxes_total - p_boxes_shipped;

  -- 4. Validar OD tenant
  select * into v_od from public.dispatch_orders where id = p_od_id;
  if v_od.tenant_id <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 5. Update el junction P1: boxes_shipped + motivo
  update public.dispatch_order_packages
     set boxes_shipped = p_boxes_shipped,
         split_reason = p_split_reason,
         split_reason_text = p_split_reason_text
   where od_id = p_od_id and package_id = p_package_id;

  -- 6. Generar code P2 via RPC (no llamamos next_dispatch_order_code porque
  --    chequea auth.uid; usamos la lógica inline acá)
  declare
    v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
    v_max  int;
  begin
    select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
      into v_max
      from public.dispatch_orders
     where tenant_id = v_tenant_id
       and order_code like 'OD-' || v_year || '-%';
    v_new_code := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  end;

  -- 7. Crear OD P2 (sin camión/chofer · status='creada')
  insert into public.dispatch_orders (
    tenant_id, order_code, status, hub,
    route_id, truck_id, driver_id,
    total_kg, total_cbm, package_count,
    cities_ordered,
    parent_od_id
  ) values (
    v_tenant_id,
    v_new_code,
    'creada',
    v_od.hub,
    v_od.route_id,
    null,                                              -- admin reasigna
    null,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    1,
    array[v_pkg.city]::text[],
    p_od_id
  )
  returning id into v_new_od_id;

  -- 8. Insertar junction de la P2
  insert into public.dispatch_order_packages (
    od_id, package_kind, package_id, markbox, client_name, city, pay,
    description, boxes_total, boxes_shipped, weight_kg, cbm,
    hs_code, aes_code
  ) values (
    v_new_od_id, v_pkg.package_kind, v_pkg.package_id, v_pkg.markbox,
    v_pkg.client_name, v_pkg.city, v_pkg.pay,
    v_pkg.description, v_remaining, v_remaining,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    v_pkg.hs_code, v_pkg.aes_code
  );

  return v_new_od_id;
end;
$$;

comment on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text) is
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC camionero_advance_od
--
-- Transiciones permitidas para el camionero:
--   lista → en_ruta         ("Iniciar ruta")
--   en_ruta → entregada     (cuando hizo la última POD)
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status,
  p_progress       int,
  p_current_city   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
     set status = p_status,
         progress_pct = coalesce(p_progress, progress_pct),
         current_city = coalesce(p_current_city, current_city),
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.camionero_advance_od is
  'Advance OD desde la PWA del camionero. Solo permite lista→en_ruta y en_ruta→entregada.';

revoke all on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC camionero_pod
--
-- Crea fila dispatch_pods con foto/firma/receptor. No cambia status
-- automáticamente — eso lo hace camionero_advance_od cuando es la
-- última entrega.
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text
)
returns uuid          -- id del POD creado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod is
  'Confirma POD (Proof of Delivery) de una entrega: foto + firma + receptor. Llamada desde la PWA del camionero.';

revoke all on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
$sdd0118_1_1$
  ] || statements
where version = '20260527073053'
  and name = 'realtime_dispatch'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_2_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0032: Seed del template "Bienvenida MARKBOX" (welcome_markbox)
--
-- Upsert idempotente del template para todos los tenants existentes.
-- Si más tenants se crean después, agregar trigger o seed en alta de tenant.
--
-- Usado por:
--   - sendWelcomeEmailAction (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--
-- Schema base: mail_templates (SDD-0026, migración 0018_mailing.sql).
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'welcome_markbox',
      'Bienvenida MARKBOX',
      'cliente',
      'email',
      'Bienvenido a DTD Cargo · tu código es {{markbox}}',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu código MARKBOX:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Servicio puerta a puerta China-Venezuela</p>
</div>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox seedado por SDD-0032 para email de bienvenida automático al crear cliente con email.';
$sdd0118_2_0$
  ]
where version = '20260528060005'
  and name = '0026_welcome_email_template_seed'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_3_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0033: Cola de impresión QR · vista oficina
--
-- Tabla qr_print_orders que recibe órdenes del operario CN PWA
-- (push via RPC con cookie HTTP-only) y consume admin web en
-- /studio/cola-qr para imprimir + marcar entregado.
--
-- 2 enums + 1 tabla + 2 RPCs (next code + push as operario) +
-- trigger guard de transición + RLS por tenant + Realtime ready.
-- ─────────────────────────────────────────────────────────────

-- ENUMS

create type qr_order_status as enum (
  'pendiente',
  'imprimiendo',
  'impreso',
  'entregado',
  'cancelado'
);

create type qr_order_priority as enum ('urgent', 'normal');

-- ─────────────────────────────────────────────────────────────
-- Tabla qr_print_orders
-- ─────────────────────────────────────────────────────────────

create table public.qr_print_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  order_code               text not null,                                     -- 'QR-2026-0142'
  warehouse_id             uuid references public.warehouses_cn(id),
  markbox                  text not null,
  client_name              text not null,                                     -- denorm
  supplier_name            text,
  bultos                   int not null check (bultos > 0),

  -- Quién la mandó
  sent_by_operario_id      uuid references public.operario_pins(id) on delete set null,
  sent_by_name             text not null,                                     -- denorm snapshot
  sent_by_phone            text,
  sent_at                  timestamptz not null default now(),

  -- Estado
  priority                 qr_order_priority not null default 'normal',
  status                   qr_order_status not null default 'pendiente',
  assigned_printer         text,                                              -- label libre · sin tabla printers V1

  -- Lifecycle
  printed_at               timestamptz,
  printed_by               uuid references auth.users(id) on delete set null,
  delivered_at             timestamptz,
  delivered_by             uuid references auth.users(id) on delete set null,
  cancelled_at             timestamptz,
  cancelled_by             uuid references auth.users(id) on delete set null,
  cancel_reason            text,

  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (tenant_id, order_code)
);

comment on table public.qr_print_orders is
  'Cola de impresión de QR. Operario CN pushea via RPC (cookie HTTP-only · sin auth.uid). Admin web consume en /studio/cola-qr y marca como impreso/entregado.';

create index qr_print_orders_tenant_status_idx
  on public.qr_print_orders (tenant_id, status, sent_at desc)
  where status not in ('entregado', 'cancelado');

create index qr_print_orders_tenant_all_idx
  on public.qr_print_orders (tenant_id, sent_at desc);

create index qr_print_orders_markbox_idx
  on public.qr_print_orders (tenant_id, markbox, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC next_qr_order_code · secuencial QR-YYYY-NNNN por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_qr_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max  int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    -- También permitir service_role (operario · sin auth.uid)
    if auth.uid() is not null then
      raise exception 'No autorizado para tenant %', p_tenant_id;
    end if;
  end if;

  select coalesce(max((substring(order_code from 'QR-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.qr_print_orders
  where tenant_id = p_tenant_id
    and order_code like 'QR-' || v_year || '-%';

  return 'QR-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;

comment on function public.next_qr_order_code(uuid) is
  'Genera próximo QR-YYYY-NNNN para el tenant. Mismo patrón que next_dispatch_order_code. Permite caller con auth.uid o service_role.';

grant execute on function public.next_qr_order_code(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC push_qr_order_as_operario
--
-- Llamado desde server action /m/cn/* con service_role. Recibe
-- operario_id (de cookie HTTP-only) y crea la orden con status
-- 'pendiente'. Denormaliza display_name y phone del operario.
-- ─────────────────────────────────────────────────────────────

create or replace function public.push_qr_order_as_operario(
  p_operario_id     uuid,
  p_warehouse_id    uuid,                              -- nullable · puede sacarse del operario
  p_markbox         text,
  p_client_name     text,
  p_supplier_name   text,
  p_bultos          int,
  p_priority        qr_order_priority,
  p_notes           text
)
returns table (
  id          uuid,
  order_code  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_active     boolean;
  v_op_name    text;
  v_op_phone   text;
  v_wh_id      uuid;
  v_code       text;
  v_new_id     uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, active, display_name, last_login_at
    into v_tenant_id, v_role, v_active, v_op_name, v_op_phone
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Sanity
  if p_markbox is null or length(trim(p_markbox)) = 0 then
    raise exception 'markbox requerido' using errcode = 'P0003';
  end if;
  if p_bultos is null or p_bultos <= 0 then
    raise exception 'bultos debe ser > 0' using errcode = 'P0004';
  end if;

  -- 3. Warehouse: si no vino, lee el del operario
  if p_warehouse_id is null then
    select warehouse_id into v_wh_id
      from public.operario_pins where id = p_operario_id;
  else
    v_wh_id := p_warehouse_id;
  end if;

  -- 4. Generar code
  v_code := public.next_qr_order_code(v_tenant_id);

  -- 5. Insert
  insert into public.qr_print_orders (
    tenant_id, order_code, warehouse_id,
    markbox, client_name, supplier_name, bultos,
    sent_by_operario_id, sent_by_name, sent_by_phone,
    priority, status, notes
  ) values (
    v_tenant_id, v_code, v_wh_id,
    trim(p_markbox), trim(coalesce(p_client_name, '—')),
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_bultos,
    p_operario_id, v_op_name, nullif(trim(coalesce(v_op_phone, '')), ''),
    coalesce(p_priority, 'normal'),
    'pendiente',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning qr_print_orders.id into v_new_id;

  return query select v_new_id, v_code;
end;
$$;

comment on function public.push_qr_order_as_operario is
  'Operario CN pushea una orden de impresión desde el PWA /m/cn. security definer · invocado con service_role desde server action.';

revoke all on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) from public, anon, authenticated;
grant execute on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Trigger guard de transición
-- ─────────────────────────────────────────────────────────────

create or replace function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido desde terminal
    if old.status in ('entregado', 'cancelado') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- impreso solo puede ir a entregado o cancelado
    if old.status = 'impreso' and new.status not in ('entregado', 'cancelado') then
      raise exception 'Desde impreso solo se puede ir a entregado o cancelado';
    end if;

    -- imprimiendo no puede retroceder a pendiente
    if old.status = 'imprimiendo' and new.status = 'pendiente' then
      raise exception 'No se puede retroceder de imprimiendo a pendiente';
    end if;

    -- Auto-stamp
    if new.status = 'impreso' and new.printed_at is null then
      new.printed_at := now();
      new.printed_by := coalesce(new.printed_by, auth.uid());
    elsif new.status = 'entregado' and new.delivered_at is null then
      new.delivered_at := now();
      new.delivered_by := coalesce(new.delivered_by, auth.uid());
    elsif new.status = 'cancelado' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger qr_print_orders_status_guard
  before update on public.qr_print_orders
  for each row execute function public.qr_print_orders_status_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders enable row level security;

create policy qr_print_orders_select on public.qr_print_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy qr_print_orders_update on public.qr_print_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- INSERT NO desde authenticated · solo service_role (vía push_qr_order_as_operario)
create policy qr_print_orders_no_insert_auth on public.qr_print_orders
  for insert to authenticated with check (false);

-- DELETE NO desde authenticated · admin cancela cambiando status
create policy qr_print_orders_no_delete_auth on public.qr_print_orders
  for delete to authenticated using (false);

grant select, update on public.qr_print_orders to authenticated;
grant select, insert, update, delete on public.qr_print_orders to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (V2: cliente se suscribe al channel)
-- ─────────────────────────────────────────────────────────────

-- Agregar tabla a la publicación si la pub existe (Supabase la crea por default)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.qr_print_orders';
  end if;
exception when others then
  raise notice 'No se pudo agregar qr_print_orders a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
$sdd0118_3_0$
  ]
where version = '20260528060006'
  and name = '0027_qr_print_orders'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_4_0$-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_4_0$
  ]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_5_0$-- 0032_fix_studio_invite_ambiguous_token.sql
--
-- Fix bug: studio_invite_user falla con "column reference 'token' is ambiguous"
-- porque el RETURNS TABLE (invitation_id uuid, token text) declara una OUTPUT
-- column llamada `token` que clashea con la columna real
-- public.user_invitations.token en el RETURNING.
--
-- Detectado 2026-05-26 inmediatamente después de aplicar 0031 (gen_random_bytes
-- qualifier fix). Cuando se hizo el primer test real de invitación.
--
-- Fix: qualificar user_invitations.token en el RETURNING.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- FIX 0032: qualificar user_invitations.token en RETURNING porque
  -- el RETURNS TABLE declara una output column 'token' que clashea.
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_5_0$
  ]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_6_0$-- 0033_grant_service_role_policies.sql
--
-- Fix raíz: tablas mail_* y user_* del Studio fueron creadas SIN
-- GRANT base a service_role. Las policies para authenticated existían
-- pero PostgREST rechazaba al admin client antes incluso de evaluar RLS
-- porque service_role no tenía siquiera SELECT/INSERT permission.
--
-- Hint literal de PostgreSQL al hacer SELECT con service_role:
--   "permission denied for table mail_config
--    HINT: Grant the required privileges to the current role with:
--    GRANT SELECT ON public.mail_config TO service_role;"
--
-- Sin GRANT base, la policy nunca se evalúa.
--
-- Esto rompía:
--   - sendEmail() helper (no podía leer mail_config, escribir mail_logs)
--   - pnpm seed con seedAgents (skills sin grant) y seedMailTemplates
--     (tenants sin grant)
--   - Bug Reporter F5 cuando llegue (necesita admin email send)
--   - Webhook handler /api/webhooks/resend (admin update mail_logs)
--
-- Detectado 2026-05-26 al testear flow de invitación post-setup Resend.
-- Aplicado in-place en prod ese mismo día via MCP execute_sql.

-- 1. GRANTs base · service_role necesita acceso CRUD completo
grant all on public.mail_config to service_role;
grant all on public.mail_logs to service_role;
grant all on public.mail_blacklist to service_role;
grant all on public.mail_templates to service_role;
grant all on public.mail_rules to service_role;

grant all on public.tenants to service_role;
grant all on public.user_tenants to service_role;
grant all on public.user_invitations to service_role;
grant all on public.user_profiles to service_role;
grant all on public.skills to service_role;

-- 2. Defensive: futuras tablas en public auto-granteadas a service_role
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 3. Policies "service_role bypass" · defense in depth
-- (los grants ya alcanzan, pero las policies explícitas hacen el intent
-- evidente para future auditing)
create policy "service_role_all_mail_config"
  on public.mail_config for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_logs"
  on public.mail_logs for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_blacklist"
  on public.mail_blacklist for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_templates"
  on public.mail_templates for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_rules"
  on public.mail_rules for all to service_role
  using (true) with check (true);

create policy "service_role_all_tenants"
  on public.tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_tenants"
  on public.user_tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_invitations"
  on public.user_invitations for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_profiles"
  on public.user_profiles for all to service_role
  using (true) with check (true);
$sdd0118_6_0$
  ]
where version = '20260528060009'
  and name = '0033_grant_service_role_policies'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_7_0$-- 0035_fix_verify_operario_pin_extensions.sql
--
-- Fix regresión: la migración 0025 (SDD-0030) recreó verify_operario_pin
-- para agregar el campo `region` al return type, pero lo hizo con
-- `set search_path = public` (sin extensions). Eso rompió el lookup de
-- crypt() de pgcrypto que vive en schema extensions.
--
-- Impact: las PWAs operario (/m/cn login + /m/ve login + /m/admin login)
-- estaban TOTALMENTE rotas — el login con PIN devolvía "function
-- crypt(text, text) does not exist".
--
-- La migración 0020b había aplicado el fix originalmente, pero 0025 lo
-- pisó con DROP + CREATE sin preservar el search_path correcto.
--
-- Detectado 2026-05-26 noche durante audit preventivo post setup Resend.
-- Fix: re-aplicar con search_path = public, extensions.
--
-- Lección: cualquier RPC que use crypt/gen_salt/gen_random_bytes/digest/
-- uuid_generate_v4/hmac de pgcrypto DEBE tener `extensions` en search_path
-- o usar qualifier `extensions.X()` explícito.

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$func$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030. search_path incluye extensions para resolver crypt() de pgcrypto.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;
$sdd0118_7_0$
  ]
where version = '20260528060010'
  and name = '0035_fix_verify_operario_pin_extensions'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_8_0$-- 0036_fk_user_tenants_profile.sql
--
-- Fix bug: /studio/usuarios devolvía HTTP 400 al consumir
-- `user_tenants?select=...,profile:user_profiles(*)`.
--
-- Causa: PostgREST requiere FK declarada para resolver embed
-- `profile:user_profiles(*)`. La tabla user_tenants NO tenía
-- FK a user_profiles (solo a tenants), aunque user_tenants.user_id
-- y user_profiles.user_id son siempre el mismo uuid de auth.users.
--
-- Fix: agregar FK explícita. user_profiles.user_id ya es PK,
-- así que el target es válido. ON DELETE CASCADE matchea el
-- comportamiento de user_profiles → auth.users.
--
-- Detectado 2026-05-26 al revisar logs API durante audit post-Resend.

alter table public.user_tenants
  add constraint user_tenants_user_id_profile_fkey
  foreign key (user_id) references public.user_profiles(user_id)
  on delete cascade;

-- Refresh PostgREST schema cache para que reconozca la FK nueva inmediato
notify pgrst, 'reload schema';
$sdd0118_8_0$
  ]
where version = '20260528060011'
  and name = '0036_fk_user_tenants_profile'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_9_0$-- 0037_harden_operario_pin_validator.sql
--
-- Mejora seguridad: el validator validate_operario_pin_format solo
-- chequeaba que el PIN tuviera 4 dígitos numéricos. NO bloqueaba PINs
-- comunes (1234, 0000, etc) que son trivialmente vulnerable a brute force
-- en login PIN (sin lockout actual).
--
-- Detectado 2026-05-26: durante audit post-Resend, operario Yusneidy Pérez
-- tenía PIN '1234'. Top 10 PINs más comunes representan ~15% de todos los
-- PINs en estudios reales.
--
-- Fix: agregar blacklist explícita de 24 PINs débiles comunes al validator.
-- Aplica a admin_create_operario y admin_reset_operario_pin que llaman
-- a esta función.
--
-- Operarios existentes con PINs débiles NO se resetean automáticamente
-- (impactaría operación). El founder decide cuándo y con qué PIN nuevo.
--
-- Referencia: https://datagenetics.com/blog/september32012/

create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elegí uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

comment on function public.validate_operario_pin_format is
  'Valida format PIN (4 dígitos) + blacklist de PINs comunes. Llamada desde admin_create_operario y admin_reset_operario_pin.';
$sdd0118_9_0$
  ]
where version = '20260528060012'
  and name = '0037_harden_operario_pin_validator'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_10_0$-- 0039_fix_bug_advance_state_actor_type_cast.sql
--
-- Fix bug en bug_advance_state RPC: falla con
--   "column actor_type is of type bug_author_type but expression is of type text"
-- al intentar cambiar el estado de un bug desde el drawer admin.
--
-- Causa: el INSERT a bug_timeline pasa un `case when ... then 'admin' else 'user' end`
-- expression que PostgreSQL infiere como `text`. La columna actor_type es enum
-- bug_author_type y PostgreSQL no auto-castea text → enum en INSERT context.
--
-- Detectado 2026-05-26 al testear F5 mínimo viable (creé BUG-00003 crítico y
-- Sam intentó clickear "Tomar bug" desde el drawer).
--
-- Fix: cast explícito al final del case expression:
--   (case when ... else ... end)::bug_author_type

create or replace function public.bug_advance_state(
  p_bug_id uuid,
  p_new_state bug_state,
  p_note text default null
)
returns bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  if v_actor_role <> 'admin' then
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- FIX 0039: cast explícito a bug_author_type
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id, 'state_change', v_actor,
    (case when v_actor_role = 'admin' then 'admin' else 'user' end)::bug_author_type,
    jsonb_build_object('from_state', v_old_state, 'to_state', p_new_state, 'note', p_note)
  );

  return v_row;
end;
$func$;
$sdd0118_10_0$
  ]
where version = '20260528060013'
  and name = '0039_fix_bug_advance_state_actor_type_cast'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa';

do $sdd0118_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_postflight$;
$sdd0118_split_patched_0271$
]
where version = '20260729135053'
  and name = '0271_repair_branch_replay_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0839e50eeb47a158382fc2f6c27d5fe9'
    )
    or (
      cardinality(statements) = 13
      and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
    )
  );

do $sdd0118_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c7b1f468087e249e2ca44359aa3f686f'
  ) then
    raise exception '0280 abortada: 0271 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_split_postconditions$;

$sdd0118_replay_gate_0$
]
where version = '20260730002206'
  and name = '0280_repair_sdd0118_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0cd59e31c466de0286c5b82091d3db32'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '9028fffb80d2c9893aabf1e6ee7afb6e'
    )
  )$sdd0118_finalizer_0287_split_1$,
    $sdd0118_finalizer_0287_split_2$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_1$-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('887cc625c50ba8f6a2292bad25989fc5', '4242bf102d649559d13793b53e46f43c')
        )
        or (
          cardinality(statements) = 4
          and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
        )
      )
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_invite_skip_split_patched_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f');

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f');

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_patched_0272$
]
where version = '20260729140214'
  and name = '0272_skip_superseded_invite_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '887cc625c50ba8f6a2292bad25989fc5'
    )
    or (
      cardinality(statements) = 4
      and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
    )
  );

do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$;

$sdd0118_replay_gate_1$
]
where version = '20260730011643'
  and name = '0281_repair_invite_skip_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '08ffa846d67496336012a46029848d1a'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '2497d8f67f2cda02d8cb5cab9b113844'
    )
  )$sdd0118_finalizer_0287_split_2$,
    $sdd0118_finalizer_0287_split_3$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_2$-- SDD-0118 · hacer replay-safe el skip histórico de platform_admins.
-- Sólo sustituye el payload de 0273 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_platform_admin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('22cac3383ef1d3c9a0a814508cc4c817', '7866d00b211f8158f79117657fd8a8d1')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
        )
      )
  ) then
    raise exception '0282 abortada: ledger 0273 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_platform_admin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_split_patched_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            'cb374d4ad4c3b2bb62915e80a5a13793'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
        )
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
    )
  );

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_patched_0273$ || chr(13) || chr(10)
]
where version = '20260729141805'
  and name = '0273_skip_platform_admin_bootstrap_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '22cac3383ef1d3c9a0a814508cc4c817'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
    )
  );

do $sdd0118_platform_admin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7866d00b211f8158f79117657fd8a8d1'
  ) then
    raise exception '0282 abortada: 0273 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_platform_admin_split_postconditions$;

$sdd0118_replay_gate_2$
]
where version = '20260730130403'
  and name = '0282_repair_platform_admin_skip_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5525c9ef4374d967e99d8886d4ec9532'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '4ee8cb102e54fd9623f858df6e032910'
    )
  )$sdd0118_finalizer_0287_split_3$,
    $sdd0118_finalizer_0287_split_4$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_3$-- SDD-0118 · hacer replay-safe el restaurador histórico de calculator_settings.
-- Sólo sustituye el payload de 0274 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_calculator_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6ddc823788cbdd6b280810d7ae61a86c', '7dec3bd4977326580000cbdb0d528305')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
        )
      )
  ) then
    raise exception '0283 abortada: ledger 0274 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_calculator_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_split_patched_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
        )
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_settings_target$-- ─────────────────────────────────────────────────────────────
-- 0103 · Calculadora pública Fase 3 (Slice A) · calculator_settings
--        + RPC public_calculator_config() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) ya toma la
-- TARIFA BASE y el PISO desde la tarifa real del Studio (Fase 2, rates.is_public).
-- Pero el RESTO de las reglas (peso incluido por CBM, $/kg de excedente,
-- descuento Valencia, multiplicador de baterías, km del casco, $/km, recargo
-- de embalaje especial) sigue HARDCODEADO en lib/calculadora.ts (CONFIG).
-- Slice A las saca al Studio: el admin las edita en /studio/tarifas › Parámetros.
--
-- Alcance de esta tabla: SOLO las reglas escalares del calculador. La tarifa
-- base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
-- (fuente única, Fase 2). Ciudades y embalajes quedan para Slice B.
--
-- Mecanismo: una fila por tenant (singleton, tenant_id como PK). El sitio
-- público la lee vía RPC anon de retorno mínimo. Si no hay fila, el calculador
-- cae a los defaults de CONFIG (cero regresión).
--
-- Decisiones (mismo patrón que 0101):
--  · Singleton por tenant_id PK → no hay ambigüedad de "cuál config".
--  · CHECKs de cordura → previene config que rompa el cálculo (peso_max <
--    peso_incluido, multiplicador < 1, negativos).
--  · RPC scopeada a slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: create table if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla singleton por tenant
create table if not exists public.calculator_settings (
  tenant_id                 uuid primary key references public.tenants(id) on delete cascade,
  -- Reglas escalares del calculador LCL DDP (espejo de CONFIG en lib/calculadora.ts)
  peso_incluido_kg          numeric(10,2) not null default 500,   -- kg/CBM incluidos sin recargo
  peso_max_kg               numeric(10,2) not null default 600,   -- kg/CBM tope → alerta FCL
  recargo_excedente_kg      numeric(10,2) not null default 1,     -- $/kg sobre peso_incluido
  descuento_valencia        numeric(10,2) not null default 50,    -- $ off si destino = Valencia
  recargo_embalaje_especial numeric(10,2) not null default 50,    -- $ por embalaje madera/paleta
  recargo_bateria_mult      numeric(10,3) not null default 1.5,   -- ×flete si lleva baterías
  threshold_casco_km        numeric(10,2) not null default 200,   -- km de casco central (flat)
  tarifa_km_fuera_casco     numeric(10,2) not null default 1,     -- $/km fuera del casco
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id),
  -- Cordura: una config inválida rompería el calculador público.
  constraint calculator_settings_peso_incluido_pos check (peso_incluido_kg > 0),
  constraint calculator_settings_peso_max_gte_incluido check (peso_max_kg >= peso_incluido_kg),
  constraint calculator_settings_excedente_nonneg check (recargo_excedente_kg >= 0),
  constraint calculator_settings_descuento_nonneg check (descuento_valencia >= 0),
  constraint calculator_settings_embalaje_nonneg check (recargo_embalaje_especial >= 0),
  constraint calculator_settings_bateria_gte_one check (recargo_bateria_mult >= 1),
  constraint calculator_settings_casco_nonneg check (threshold_casco_km >= 0),
  constraint calculator_settings_km_nonneg check (tarifa_km_fuera_casco >= 0)
);

comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated;

-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security;

create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at();

-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config();

create or replace function public.public_calculator_config()
returns table (
  peso_incluido_kg          numeric,
  peso_max_kg               numeric,
  recargo_excedente_kg      numeric,
  descuento_valencia        numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult      numeric,
  threshold_casco_km        numeric,
  tarifa_km_fuera_casco     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;
$sdd0118_calculator_settings_target$
]
where version = '20260604131310'
  and name = '0103_calculator_settings'
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
    )
  );

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_postflight$;
$sdd0118_calculator_split_patched_0274$ || chr(13) || chr(10)
]
where version = '20260729143620'
  and name = '0274_restore_calculator_settings_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6ddc823788cbdd6b280810d7ae61a86c'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
    )
  );

do $sdd0118_calculator_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7dec3bd4977326580000cbdb0d528305'
  ) then
    raise exception '0283 abortada: 0274 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_calculator_split_postconditions$;

$sdd0118_replay_gate_3$
]
where version = '20260730132651'
  and name = '0283_repair_calculator_settings_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6614a85c247cf6ead23573f7a8cb2514'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '96ba90f48a4f9c1742d7d52aabdf8d8d'
    )
  )$sdd0118_finalizer_0287_split_4$,
    $sdd0118_finalizer_0287_split_5$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_4$-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('a217fa825ff964f2c2a4cb26d31c3dbc', 'cad36533b4225b674f1d8fd7b8c165ea')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
        )
      )
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_split_patched_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
    )
  );

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_patched_0275$
]
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'a217fa825ff964f2c2a4cb26d31c3dbc'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
    )
  );

do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$;

$sdd0118_replay_gate_4$
]
where version = '20260730160209'
  and name = '0284_repair_pin_search_path_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'ca7f9d149eeb6eff924cb6d813094fef'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '6b62b8b4eb08cce4a7cdf7f848f3857a'
    )
  )$sdd0118_finalizer_0287_split_5$,
    $sdd0118_finalizer_0287_split_6$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_5$-- SDD-0118 · hacer replay-safe el restaurador histórico de revoke_anon.
-- Sólo sustituye el payload de 0276 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_revoke_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('784f95726bd9c6f21963722f1ce7e61d', '66df90af092b02ae8c0a87f5e2bc08e0')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
        )
      )
  ) then
    raise exception '0285 abortada: ledger 0276 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_revoke_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_split_patched_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 101
          and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
--
-- Contexto: `create function` en Postgres otorga EXECUTE a PUBLIC por default.
-- Varias migraciones que recrearon funciones (`drop` + `create or replace`)
-- re-abrieron ese grant, dejando 57 funciones SECURITY DEFINER ejecutables por
-- `anon` vía /rest/v1/rpc/* (flag `anon_security_definer_function_executable`
-- del advisor de Supabase, 2026-07-03).
--
-- Este sweep cubre las 48 que NO son públicas intencionales:
--   - revoke execute from public, anon  → anon pierde la superficie
--   - grant execute to authenticated, service_role → cero regresión para los
--     callers legítimos (Studio/portal con cliente de usuario + server actions
--     y API routes con cliente admin).
--
-- Allowlist EXCLUIDA del sweep (diseñadas para anon, consumidas por
-- lib/public/* con getAnonClient() — calculadora, track, servicios — y
-- /verificar):
--   public_calculator_cities · public_calculator_config · public_cbm_rate
--   public_fcl_rates · public_ocean_rate · public_service_faqs
--   public_servicios · public_track_shipment · academy_verify_diploma
--
-- Verificación previa de riesgo (2026-07-03): las 4 más sensibles tienen guard
-- interno (get_user_tenant_id() / membresía user_tenants / operario_pins), y
-- ninguna superficie pre-auth del código llama RPCs de esta lista con cliente
-- anon. Regla permanente: toda migración nueva que cree funciones debe hacer
-- `revoke ... from public, anon` + grant explícito (memoria del repo).

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon;
grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role;
revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon;
grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate() to authenticated, service_role;
revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon;
grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role;
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.get_portal_client_tenant() from public, anon;
grant execute on function public.get_portal_client_tenant() to authenticated, service_role;
revoke execute on function public.has_any_back_role() from public, anon;
grant execute on function public.has_any_back_role() to authenticated, service_role;
revoke execute on function public.has_back_role(check_role back_role) from public, anon;
grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon;
grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon;
grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon;
grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon;
grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon;
grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon;
grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role;
revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon;
grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role;
revoke execute on function public.portal_post_message(p_body text) from public, anon;
grant execute on function public.portal_post_message(p_body text) to authenticated, service_role;
revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon;
grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon;
grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon;
grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon;
grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon;
grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.update_user_tenants_last_login() from public, anon;
grant execute on function public.update_user_tenants_last_login() to authenticated, service_role;
revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon;
grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role;
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and (
    statements is null
    or (
      cardinality(statements) = 101
      and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
    )
  );

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_patched_0276$
]
where version = '20260729163005'
  and name = '0276_restore_revoke_anon_rpc_sweep_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '784f95726bd9c6f21963722f1ce7e61d'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
    )
  );

do $sdd0118_revoke_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '66df90af092b02ae8c0a87f5e2bc08e0'
  ) then
    raise exception '0285 abortada: 0276 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_revoke_split_postconditions$;

$sdd0118_replay_gate_5$
]
where version = '20260730160939'
  and name = '0285_repair_revoke_anon_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'db953b1adc8f6dcad4bd040b59c461d7'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = 'e7ef637390bc02fcbda73db1117581bb'
    )
  )$sdd0118_finalizer_0287_split_6$,
    $sdd0118_finalizer_0287_split_7$update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_6$-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5251a9ca8ccbf579c5b81688e63acb01', 'd67b2e81a67028e56bd994f47ce16f6d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
        )
      )
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_split_patched_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_patched_0279$ || chr(13) || chr(10)
]
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5251a9ca8ccbf579c5b81688e63acb01'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
    )
  );

do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$;

$sdd0118_replay_gate_6$
]
where version = '20260730161446'
  and name = '0286_repair_tenant_acl_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5d42c84f8fb245ea9514ee80cab24a39'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '8cc6e74326c8780d2002233d3e4cc989'
    )
  )$sdd0118_finalizer_0287_split_7$,
    $sdd0118_finalizer_0287_split_8$do $sdd0118_replay_gates_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '42542bfd279507a4a89c87c54a6c619b'
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '19eb51d4802a0af27a12bf634fa2543d'
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '6185c626816290531c5e287a25db1a95'
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '8dd851b83f33abc1417d82d0d61c208c'
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd2f3bc6fac74a836c96be81c40c2bcce'
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0d656e4a3a856160d1323c49b60baa70'
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'fbf9cbd3180f161a4a0462fee2c3fea8'
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history no quedó en el estado objetivo';
  end if;
end
$sdd0118_replay_gates_postconditions$$sdd0118_finalizer_0287_split_8$
]
where version = '20260730162532'
  and name = '0287_repair_replay_gate_split_history';

\ir ../migrations/0288_finalize_replay_gate_split_history.sql

do $finalizer_contract$
declare
  v_payload text;
begin
  select statements[1]
  into strict v_payload
  from supabase_migrations.schema_migrations
  where version = '20260730162532'
    and name = '0287_repair_replay_gate_split_history'
    and cardinality(statements) = 1
    and md5(statements[1]) = '4f6d3417b9ec82bfcfbf9aaa38fc0d40';

  if v_payload <> $sdd0118_finalizer_expected_0287$-- SDD-0118/SDD-0172 · hacer replay-safe los gates 0280–0286.
-- Sólo sustituye payloads del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_replay_gates_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0cd59e31c466de0286c5b82091d3db32', '42542bfd279507a4a89c87c54a6c619b')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '9028fffb80d2c9893aabf1e6ee7afb6e'
        )
      )
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('08ffa846d67496336012a46029848d1a', '19eb51d4802a0af27a12bf634fa2543d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '2497d8f67f2cda02d8cb5cab9b113844'
        )
      )
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5525c9ef4374d967e99d8886d4ec9532', '6185c626816290531c5e287a25db1a95')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '4ee8cb102e54fd9623f858df6e032910'
        )
      )
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6614a85c247cf6ead23573f7a8cb2514', '8dd851b83f33abc1417d82d0d61c208c')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '96ba90f48a4f9c1742d7d52aabdf8d8d'
        )
      )
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('ca7f9d149eeb6eff924cb6d813094fef', 'd2f3bc6fac74a836c96be81c40c2bcce')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '6b62b8b4eb08cce4a7cdf7f848f3857a'
        )
      )
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('db953b1adc8f6dcad4bd040b59c461d7', '0d656e4a3a856160d1323c49b60baa70')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = 'e7ef637390bc02fcbda73db1117581bb'
        )
      )
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history ausente, ambiguo o con drift';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5d42c84f8fb245ea9514ee80cab24a39', 'fbf9cbd3180f161a4a0462fee2c3fea8')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '8cc6e74326c8780d2002233d3e4cc989'
        )
      )
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history ausente, ambiguo o con drift';
  end if;
end
$sdd0118_replay_gates_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_0$-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('0839e50eeb47a158382fc2f6c27d5fe9', 'c7b1f468087e249e2ca44359aa3f686f')
        )
        or (
          cardinality(statements) = 13
          and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
        )
      )
  ) then
    raise exception '0280 abortada: ledger 0271 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_split_patched_0271$-- SDD-0118 · reparar el replay de branches sin ejecutar DDL de negocio.
-- La migración sólo modifica statements del ledger con precondiciones exactas.
-- Los SQL históricos quedan almacenados como texto para futuros replays.
-- 0280 acepta además la fragmentación exacta observada en un branch fresco.
-- 20260526213130 <- 0018_mailing.sql · md5 e2e1b4c3846c7fba431455c9130f0d34
-- 20260527073053 <- 0024_dispatch_core.sql · md5 fc9872ff14733d3d9cac5f0cbb330962
-- 20260527073053 <- 0025_operario_roles_extend.sql · md5 bc9153c31f543e4a74aaa2c570a7aff4
-- 20260528060005 <- 0026_welcome_email_template_seed.sql · md5 b0a7c682cc6031be6034940cb27a5702
-- 20260528060006 <- 0027_qr_print_orders.sql · md5 b760d6196dc02d67036148d33b4ce1f1
-- 20260528060007 <- 0031_fix_studio_invite_gen_random_bytes.sql · md5 8296dce3805f143e549a239995bd954a
-- 20260528060008 <- 0032_fix_studio_invite_ambiguous_token.sql · md5 bb5879cd44f1b5911511e223a0618e51
-- 20260528060009 <- 0033_grant_service_role_policies.sql · md5 a09e03f9f62c47b32ee0a5b4902fa834
-- 20260528060010 <- 0035_fix_verify_operario_pin_extensions.sql · md5 732f8ed961708b91b94cf4965ca8d797
-- 20260528060011 <- 0036_fk_user_tenants_profile.sql · md5 ba63f9c578e32019aaafc8e6d6247056
-- 20260528060012 <- 0037_harden_operario_pin_validator.sql · md5 6e3f5a4763cd32e66a33f189af2da876
-- 20260528060013 <- 0039_fix_bug_advance_state_actor_type_cast.sql · md5 f2872b0ac20dd9e070b14085a60a3fb6

do $sdd0118_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa'
        )
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 preflight: drift en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_0_0$-- ─────────────────────────────────────────────────────────────
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
$sdd0118_0_0$
  ] || statements
where version = '20260526213130'
  and name = 'seed_team_invitation_template'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'e087ed48b2838aca3d1ba061ed7a6ab6';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_1_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0029 Fase 1: Módulo Despacho · core (admin web)
--
-- Pipeline 3-actor (Admin/Bodeguero/Camionero) sobre Órdenes de
-- Despacho (ODs). Esta migración cubre SOLO el lado Admin (Fase 1).
-- Las apps móviles de bodeguero+camionero llegan en SDD-0030.
--
-- Cubre:
--   - 6 enums (status OD · hub · payment policy · route type · split reason · incident severity)
--   - Catálogo VE público (ve_locality_catalog): 24 estados · ~98 ciudades · IPOSTEL
--   - 5 tablas per-tenant: dispatch_orders · dispatch_order_packages
--                          dispatch_routes · dispatch_city_catalog
--                          dispatch_rules
--   - Extensión aditiva: warehouse_receipts_cn.description NULLABLE
--     (Wang Hua YIW-A1 y el wizard /m/cn/nueva siguen idénticos)
--   - 4 RPCs: next_dispatch_order_code · next_route_code
--             upsert_dispatch_rules · seed_tenant_cities_from_ve_catalog
--   - Trigger guard de transición de status
--   - RLS por tenant_id en las 5 tablas privadas
--
-- 100% aditivo y no destructivo. Catálogo VE es global (sin RLS, solo lectura).
-- ─────────────────────────────────────────────────────────────

-- ── ENUMS ────────────────────────────────────────────────────

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- ─────────────────────────────────────────────────────────────
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
-- ─────────────────────────────────────────────────────────────

create table public.ve_locality_catalog (
  state_code      text not null,             -- 'CAR'
  state_name      text not null,             -- 'Carabobo'
  state_region    text not null,             -- 'Centro'
  state_capital   text not null,
  municipio       text not null,             -- 'Valencia'
  city            text not null,             -- 'Valencia'
  postal_code     text not null,             -- '2001' (IPOSTEL)
  parroquias      text[] not null default '{}',
  barrios         text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant.';

create index ve_locality_catalog_postal_idx
  on public.ve_locality_catalog (postal_code);

create index ve_locality_catalog_region_idx
  on public.ve_locality_catalog (state_region);

grant select on public.ve_locality_catalog to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed catálogo VE (24 estados · ~98 ciudades · IPOSTEL)
-- ─────────────────────────────────────────────────────────────

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code, parroquias, barrios)
values
  -- Distrito Capital
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Centro)', '1010', ARRAY['Catedral','San José','La Pastora','El Recreo'], ARRAY['El Silencio','San Bernardino','Cotiza','La Candelaria']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Oeste)',  '1020', ARRAY['Antímano','Caricuao','La Vega','Macarao'], ARRAY['Caricuao','Antímano','La Yaguara']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Sur)',    '1080', ARRAY['El Valle','Coche','Santa Rosalía'], ARRAY['El Valle','Coche','Las Acacias']),

  -- Caracas Metropolitana (virtual · 4 alcaldías)
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Chacao',     'Chacao (Caracas)',  '1060', ARRAY['Chacao'], ARRAY['Chacao','La Castellana','Country Club','Altamira']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Baruta',     'Baruta (Caracas)',  '1080', ARRAY['Baruta','El Cafetal','Las Minas'], ARRAY['Las Mercedes','Santa Mónica','Sorocaima']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Sucre',      'Petare',            '1070', ARRAY['Petare','Caucagüita','Filas de Mariche','La Dolorita','Leoncio Martínez'], ARRAY['Petare','Mariperez','Cumbres de Curumo']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'El Hatillo', 'El Hatillo',        '1083', ARRAY['El Hatillo'], ARRAY['El Hatillo','La Lagunita','Oripoto']),

  -- Amazonas
  ('AMA', 'Amazonas', 'Guayana', 'Puerto Ayacucho', 'Atures', 'Puerto Ayacucho', '7101', ARRAY['Atures'], ARRAY['Centro']),

  -- Anzoátegui
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Simón Bolívar',              'Barcelona',         '6001', ARRAY['Bergantín','El Carmen','San Cristóbal'], ARRAY['Centro','Boyacá']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Sotillo',                    'Puerto La Cruz',    '6023', ARRAY['Pozuelos'], ARRAY['Centro','Lechería']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Diego Bautista Urbaneja',    'Lechería',          '6016', ARRAY['Lechería'], ARRAY['Lechería','El Morro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Anaco',                      'Anaco',             '6003', ARRAY['Anaco'], ARRAY['Centro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Pedro María Freites',        'Cantaura',          '6004', ARRAY['Cantaura'], ARRAY[]::text[]),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Independencia',              'Soledad',           '6010', ARRAY['Mamo'], ARRAY[]::text[]),

  -- Apure
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'San Fernando', 'San Fernando de Apure', '7001', ARRAY['San Fernando'], ARRAY['Centro']),
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'Páez',         'Guasdualito',           '7011', ARRAY['Guasdualito'], ARRAY[]::text[]),

  -- Aragua
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Girardot',                  'Maracay',     '2101', ARRAY['Las Delicias','José Casanova Godoy','Joaquín Crespo'], ARRAY['San Jacinto','Las Delicias','El Castaño','Caña de Azúcar','La Soledad']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Mario Briceño Iragorry',    'El Limón',    '2105', ARRAY['Caña de Azúcar'], ARRAY['El Limón']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Santiago Mariño',           'Turmero',     '2115', ARRAY['Turmero'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Sucre',                     'Cagua',       '2122', ARRAY['Cagua'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'José Ángel Lamas',          'Santa Cruz',  '2128', ARRAY['Santa Cruz'], ARRAY[]::text[]),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Linares Alcántara',         'Santa Rita',  '2123', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Barinas
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Barinas',                    'Barinas', '5201', ARRAY['Barinas','Alto Barinas'], ARRAY['Centro','Alto Barinas']),
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Antonio José de Sucre',      'Socopó',  '5212', ARRAY['Socopó'], ARRAY[]::text[]),

  -- Bolívar
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Heres',  'Ciudad Bolívar',                 '8001', ARRAY['Catedral','Vista Hermosa'], ARRAY['Centro','Vista Hermosa','Sabana del Hueso']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Caroní', 'Ciudad Guayana / Puerto Ordaz',  '8050', ARRAY['Cachamay','Universidad','Unare','Vista al Sol','Once de Abril'], ARRAY['Alta Vista','Castillito','Los Olivos','Villa Bolívar']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Piar',   'Upata',                          '8021', ARRAY['Upata'], ARRAY['Centro']),

  -- Carabobo
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia',       'Valencia',       '2001', ARRAY['San José','San Blas','Catedral','Candelaria'], ARRAY['El Viñedo','Trigal Norte','San José','Prebo','El Recreo','La Granja']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Naguanagua',     'Naguanagua',     '2005', ARRAY['Naguanagua'], ARRAY['Mañongo','La Granja','Bárbula']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'San Diego',      'San Diego',      '2006', ARRAY['San Diego'], ARRAY['Yuma','Castillito']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Los Guayos',     'Los Guayos',     '2014', ARRAY['Los Guayos'], ARRAY[]::text[]),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Guacara',        'Guacara',        '2015', ARRAY['Guacara'], ARRAY['Centro']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Puerto Cabello', 'Puerto Cabello', '2050', ARRAY['Fraternidad','Bartolomé Salom','Goaigoaza'], ARRAY['Centro','Cumboto']),

  -- Cojedes
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Ezequiel Zamora', 'San Carlos',  '2201', ARRAY['San Carlos'], ARRAY['Centro']),
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Tinaquillo',      'Tinaquillo',  '2204', ARRAY['Tinaquillo'], ARRAY['Centro']),

  -- Delta Amacuro
  ('DEL', 'Delta Amacuro', 'Guayana', 'Tucupita', 'Tucupita', 'Tucupita', '9001', ARRAY['Tucupita'], ARRAY['Centro']),

  -- Falcón
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Miranda',     'Coro',                       '4101', ARRAY['Santa Ana','San Antonio'], ARRAY['Centro','Cruz Verde','Curazaito']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Carirubana',  'Punto Fijo',                 '4102', ARRAY['Carirubana','Norte','Punta Cardón'], ARRAY['Centro','Las Pioneras','Cardón']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Los Taques',  'Santa Cruz de Los Taques',   '4106', ARRAY['Los Taques'], ARRAY[]::text[]),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Federación',  'Churuguara',                 '4115', ARRAY['Churuguara'], ARRAY[]::text[]),

  -- Guárico
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Juan Germán Roscio',     'San Juan de los Morros',  '2301', ARRAY['San Juan'], ARRAY['Casco Central','Pariata','La Toscana']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Francisco de Miranda',   'Calabozo',                '2312', ARRAY['Calabozo'], ARRAY['Centro']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Camaguán',               'Camaguán',                '2317', ARRAY['Camaguán'], ARRAY[]::text[]),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'José Tadeo Monagas',     'Altagracia de Orituco',   '2304', ARRAY['Altagracia'], ARRAY[]::text[]),

  -- La Guaira
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'La Guaira',     '1163', ARRAY['Catia La Mar','Maiquetía','La Guaira'], ARRAY['Maiquetía','Macuto']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Catia La Mar',  '1162', ARRAY['Catia La Mar'], ARRAY['Centro','Puerto Viejo']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Maiquetía',     '1161', ARRAY['Maiquetía'], ARRAY['Centro']),

  -- Lara
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Iribarren',  'Barquisimeto', '3001', ARRAY['Catedral','Concepción','Tamaca','El Cuji'], ARRAY['Centro','El Tostado','Las Trinitarias','Patarata']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Palavecino', 'Cabudare',     '3023', ARRAY['Cabudare'], ARRAY['Centro']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Crespo',     'Duaca',        '3050', ARRAY['Duaca'], ARRAY[]::text[]),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Torres',     'Carora',       '3040', ARRAY['Carora'], ARRAY['Centro']),

  -- Mérida
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Libertador',       'Mérida',     '5101', ARRAY['El Llano','Milla','Domingo Peña','Mariano Picón Salas'], ARRAY['La Hechicera','Belensate','Glorias Patrias','Mérida Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Campo Elías',      'Ejido',      '5113', ARRAY['Ejido'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Tovar',            'Tovar',      '5131', ARRAY['Tovar'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Alberto Adriani',  'El Vigía',   '5145', ARRAY['El Vigía'], ARRAY['Centro']),

  -- Miranda
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Guaicaipuro',     'Los Teques',        '1201', ARRAY['Los Teques','San Pedro'], ARRAY['Centro','San Pedro','Lomas de Urquía']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Plaza',           'Guarenas',          '1220', ARRAY['Guarenas'], ARRAY['Centro','Camatagua']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Zamora',          'Guatire',           '1221', ARRAY['Guatire'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Cristóbal Rojas', 'Charallave',        '1210', ARRAY['Charallave'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Urdaneta',        'Cúa',               '1213', ARRAY['Cúa'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Brión',           'Higuerote',         '1240', ARRAY['Higuerote'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Lander',          'Ocumare del Tuy',   '1211', ARRAY['Ocumare'], ARRAY['Centro']),

  -- Monagas
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Maturín',   'Maturín',     '6201', ARRAY['San Simón','San Vicente','Las Cocuizas'], ARRAY['La Floresta','Tipuro','Las Avenidas','Los Pinos']),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Caripe',    'Caripe',      '6225', ARRAY['Caripe'], ARRAY[]::text[]),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Punceres',  'Quiriquire',  '6213', ARRAY['Quiriquire'], ARRAY[]::text[]),

  -- Nueva Esparta
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Arismendi', 'La Asunción', '6301', ARRAY['La Asunción'], ARRAY['Centro']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Mariño',    'Porlamar',    '6313', ARRAY['Porlamar'], ARRAY['Centro','4 de Mayo','Genovés']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Maneiro',   'Pampatar',    '6315', ARRAY['Pampatar'], ARRAY['Centro','La Caranta']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Gómez',     'Santa Ana',   '6311', ARRAY['Santa Ana'], ARRAY[]::text[]),

  -- Portuguesa
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Guanare', 'Guanare',  '3322', ARRAY['Guanare','San Juan de Guanaguanare'], ARRAY['Centro','Mesa de Cavacas']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Páez',    'Acarigua', '3301', ARRAY['Acarigua'], ARRAY['Centro','Bolívar']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Araure',  'Araure',   '3303', ARRAY['Araure'], ARRAY['Centro']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Sucre',   'Biscucuy', '3330', ARRAY['Biscucuy'], ARRAY[]::text[]),

  -- Sucre
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Sucre',    'Cumaná',       '6101', ARRAY['Altagracia','Santa Inés','Valentín Valiente','Ayacucho'], ARRAY['Centro','Boca de Sabana','Los Tarales']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Bermúdez', 'Carúpano',     '6150', ARRAY['Santa Rosa','Santa Catalina'], ARRAY['Centro']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Cajigal',  'Yaguaraparo',  '6173', ARRAY['Yaguaraparo'], ARRAY[]::text[]),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Valdez',   'Güiria',       '6164', ARRAY['Güiria'], ARRAY[]::text[]),

  -- Táchira
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'San Cristóbal',         'San Cristóbal',              '5001', ARRAY['La Concordia','Pedro María Morantes','San Juan Bautista'], ARRAY['Centro','Pirineos','Las Lomas']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Cárdenas',              'Táriba',                     '5009', ARRAY['Táriba'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Bolívar',               'San Antonio del Táchira',    '5004', ARRAY['San Antonio'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Pedro María Ureña',     'Ureña',                      '5005', ARRAY['Ureña'], ARRAY[]::text[]),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Junín',                 'Rubio',                      '5030', ARRAY['Rubio'], ARRAY['Centro']),

  -- Trujillo
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Trujillo', 'Trujillo', '3101', ARRAY['Trujillo'], ARRAY['Centro']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Valera',   'Valera',   '3102', ARRAY['Valera','Mendoza'], ARRAY['Centro','La Plata','Plata III']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Boconó',   'Boconó',   '3104', ARRAY['Boconó'], ARRAY['Centro']),

  -- Yaracuy
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'San Felipe',    'San Felipe',    '3201', ARRAY['San Felipe','Albarico'], ARRAY['Centro','La Trinidad']),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Independencia', 'Independencia', '3206', ARRAY['Independencia'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Veroes',        'Farriar',       '3214', ARRAY['Farriar'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Bolívar',       'Aroa',          '3211', ARRAY['Aroa'], ARRAY[]::text[]),

  -- Zulia
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Maracaibo',              'Maracaibo',                '4001', ARRAY['Chiquinquirá','Coquivacoa','Cristo de Aranza','Bolívar','Santa Lucía'], ARRAY['Bella Vista','Tierra Negra','El Milagro','Indio Mara','Sabaneta']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'San Francisco',          'San Francisco',            '4002', ARRAY['San Francisco','Marcial Hernández'], ARRAY['Sierra Maestra','San Francisco Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Cabimas',                'Cabimas',                  '4013', ARRAY['Cabimas','Punta Gorda','Ambrosio'], ARRAY['Centro','Las Cabillas','La Rosa']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Lagunillas',             'Ciudad Ojeda',             '4019', ARRAY['Ciudad Ojeda'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Mara',                   'San Rafael del Moján',     '4012', ARRAY['Mara'], ARRAY[]::text[]),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Machiques de Perijá',    'Machiques',                '4045', ARRAY['Machiques'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Santa Rita',             'Santa Rita',               '4030', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Dependencias Federales
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'Los Roques',  'Gran Roque',  '1990', ARRAY[]::text[], ARRAY[]::text[]),
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'La Tortuga',  'Tortuga',     '1990', ARRAY[]::text[], ARRAY[]::text[]);

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_routes (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);

comment on table public.dispatch_routes is
  'Catálogo de rutas operativas per-tenant. Directa (origen→destino) o intermedias (con ciudades intermedias en jsonb). RLS por tenant. Soft-delete.';

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub)
  where deleted_at is null and active = true;

create index dispatch_routes_tenant_active_idx
  on public.dispatch_routes (tenant_id, active)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. dispatch_city_catalog (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

comment on table public.dispatch_city_catalog is
  'Catálogo de ciudades per-tenant. Se popula la primera vez con seed_tenant_cities_from_ve_catalog(). Tenant puede agregar ciudades custom o marcar is_hq.';

create index dispatch_city_catalog_tenant_active_idx
  on public.dispatch_city_catalog (tenant_id)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. dispatch_rules (1 row por tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring por tenant. 1 row por tenant. Editable desde /studio/despacho/reglas. Defaults aplicados si no existe row.';

-- ─────────────────────────────────────────────────────────────
-- 5. dispatch_orders (entidad central)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);

comment on table public.dispatch_orders is
  'Órdenes de Despacho (ODs). Entidad central del pipeline 3-actor. State machine cerrada (creada→cargando→lista→en_ruta→entregada→cerrada, terminal cancelada). Code OD-YYYY-NNNN.';

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status)
  where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_active_idx
  on public.dispatch_orders (tenant_id, driver_id)
  where status = 'lista';

create index dispatch_orders_parent_idx
  on public.dispatch_orders (parent_od_id)
  where parent_od_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 6. dispatch_order_packages (junction OD ↔ paquetes)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);

comment on table public.dispatch_order_packages is
  'Junction OD ↔ paquetes. Soporta carga fraccionada (boxes_shipped < boxes_total) con motivo obligatorio. FK polimórfico via package_kind + package_id (FK explícito en Fase 2 SDD-0030).';

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);

create index dispatch_order_packages_package_idx
  on public.dispatch_order_packages (package_kind, package_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Extensión aditiva: warehouse_receipts_cn.description NULLABLE
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE) + chofer entrega. NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá NOT NULL con 5to step opcional.';

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs
-- ─────────────────────────────────────────────────────────────

-- 8.1 · next_dispatch_order_code: secuencial OD-YYYY-NNNN por tenant
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_dispatch_order_code(uuid) is
  'Genera el próximo código OD-YYYY-NNNN para el tenant. Verifica que auth.uid() esté en user_tenants.';

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;

-- 8.2 · next_route_code: secuencial R-NNN por tenant (sin año)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(route_code from 'R-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-%';

  v_next := 'R-' || lpad((v_max + 1)::text, 3, '0');
  return v_next;
end;
$$;

comment on function public.next_route_code(uuid) is
  'Genera el próximo código R-NNN para el tenant. Verifica autorización.';

grant execute on function public.next_route_code(uuid) to authenticated;

-- 8.3 · upsert_dispatch_rules: idempotente, last-write-wins
create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes, updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules. Last-write-wins, sin lock optimista en Fase 1.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;

-- 8.4 · seed_tenant_cities_from_ve_catalog: copia inicial del catálogo público
create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ~98 ciudades del catálogo VE público a dispatch_city_catalog del tenant. Devuelve cuántas filas se insertaron (0 si ya estaban).';

grant execute on function public.seed_tenant_cities_from_ve_catalog(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger guard de transición de status
-- ─────────────────────────────────────────────────────────────

create or replace function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido modificar status desde terminales
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- entregada solo puede ir a cerrada
    if old.status = 'entregada' and new.status not in ('cerrada') then
      raise exception 'Desde entregada solo se puede ir a cerrada (intentado: %)', new.status;
    end if;

    -- lista no puede retroceder a cargando
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;

    -- en_ruta no puede retroceder a lista
    if old.status = 'en_ruta' and new.status = 'lista' then
      raise exception 'No se puede retroceder de en_ruta a lista';
    end if;

    -- Auto-stamp timestamps
    if new.status = 'en_ruta' and new.departed_at is null then
      new.departed_at := now();
    elsif new.status = 'entregada' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cerrada' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();

-- ─────────────────────────────────────────────────────────────
-- 10. RLS · tenant isolation
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- dispatch_orders: select + insert + update + delete via tenant_id
create policy dispatch_orders_select on public.dispatch_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_insert on public.dispatch_orders
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_update on public.dispatch_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_delete on public.dispatch_orders
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_order_packages: tenant via JOIN al OD
create policy dispatch_order_packages_select on public.dispatch_order_packages
  for select using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_insert on public.dispatch_order_packages
  for insert with check (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_update on public.dispatch_order_packages
  for update using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_delete on public.dispatch_order_packages
  for delete using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

-- dispatch_routes
create policy dispatch_routes_select on public.dispatch_routes
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_insert on public.dispatch_routes
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_update on public.dispatch_routes
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_delete on public.dispatch_routes
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_city_catalog
create policy dispatch_city_catalog_select on public.dispatch_city_catalog
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_insert on public.dispatch_city_catalog
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_update on public.dispatch_city_catalog
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_delete on public.dispatch_city_catalog
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_rules
create policy dispatch_rules_select on public.dispatch_rules
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_insert on public.dispatch_rules
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_update on public.dispatch_rules
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_packages to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_city_catalog to authenticated;
grant select, insert, update on public.dispatch_rules to authenticated;
$sdd0118_1_0$,
    $sdd0118_1_1$-- ─────────────────────────────────────────────────────────────
-- SDD-0030 Fase 2: Apps móviles bodeguero VE + camionero VE
--
-- Extiende operario_pins.role para soportar los 2 roles nuevos del
-- pipeline de Despacho (bodeguero arma camiones, camionero entrega).
-- + Tabla dispatch_pods (proofs of delivery).
-- + 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
--   camionero_advance_od · camionero_pod
-- + Update verify_operario_pin para devolver region.
--
-- 100% aditivo. NO toca operarios CN existentes (Wang Hua YIW-A1 sigue
-- idéntica · role='operario', region='cn').
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Extender CHECK constraint del role
-- ─────────────────────────────────────────────────────────────

alter table public.operario_pins drop constraint operario_pins_role_check;

alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );

comment on column public.operario_pins.role is
  'Rol del operario · operario|supervisor (CN almacén) o bodeguero|camionero (VE despacho). Bodeguero arma camiones; camionero entrega. SDD-0030.';

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla dispatch_pods (proofs of delivery)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

comment on table public.dispatch_pods is
  'Proofs of Delivery (POD) de Órdenes de Despacho. 1 fila por entrega confirmada por el camionero PWA. Photo + signature paths apuntan al bucket receipt-photos con prefijos pod/ y firma/.';

create index dispatch_pods_od_idx
  on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx
  on public.dispatch_pods (tenant_id, created_at desc);

alter table public.dispatch_pods enable row level security;

-- Admins del tenant pueden leer todos los PODs (consulta auditable)
create policy dispatch_pods_select on public.dispatch_pods
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- Inserts vienen via RPC (security definer · service_role bypass)
-- No exponemos insert a authenticated.

grant select on public.dispatch_pods to authenticated;
grant select, insert, update, delete on public.dispatch_pods to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Update RPC verify_operario_pin · agregar region en el return
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,             -- nullable desde SDD-0023 (chofer/bodeguero VE no necesariamente)
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region   -- NUEVO en SDD-0030
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030 extiende SDD-0027.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC bodeguero_advance_od
--
-- Transiciones permitidas para el bodeguero:
--   creada → cargando        (al abrir la OD)
--   cargando → lista         ("Cerrar carga")
--
-- Validaciones:
--   - operario activo + role='bodeguero' (o supervisor VE legacy)
--   - OD existe + tenant match
--   - Transición permitida por trigger guard (deja que el trigger valide)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE pueden actuar sobre Despacho' using errcode = 'P0003';
  end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede avanzar carga' using errcode = 'P0004';
  end if;

  -- 2. Validar OD tenant
  select tenant_id into v_od_tenant
    from public.dispatch_orders
   where id = p_od_id;

  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 3. Validar transición esperada (whitelist bodeguero)
  if p_status not in ('cargando', 'lista') then
    raise exception 'Transición % no permitida para bodeguero', p_status using errcode = 'P0007';
  end if;

  -- 4. Update (trigger guard valida la transición real desde el current)
  update public.dispatch_orders
     set status = p_status,
         updated_by = null,                    -- operario no tiene auth.uid
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status) is
  'Advance OD desde la PWA del bodeguero. Solo permite creada→cargando→lista. Resto bloqueado por el trigger guard.';

revoke all on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  from public, anon, authenticated;
grant execute on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC bodeguero_split_p2
--
-- Fracciona un paquete: actualiza la fila junction existente con
-- boxes_shipped < boxes_total y motivo, y crea una OD nueva (P2)
-- con parent_od_id apuntando a la P1.
--
-- La P2 queda con status='creada' sin camión/chofer (admin la asigna).
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_split_p2(
  p_operario_id        uuid,
  p_od_id              uuid,
  p_package_id         uuid,
  p_boxes_shipped      int,
  p_split_reason       dispatch_split_reason,
  p_split_reason_text  text
)
returns uuid           -- id de la OD P2 creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_role           text;
  v_region         operario_region;
  v_active         boolean;
  v_pkg            public.dispatch_order_packages%rowtype;
  v_od             public.dispatch_orders%rowtype;
  v_remaining      int;
  v_new_od_id      uuid;
  v_new_code       text;
begin
  -- 1. Validar operario (igual pattern que bodeguero_advance_od)
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede fraccionar' using errcode = 'P0004';
  end if;

  -- 2. Lock + leer el paquete
  select * into v_pkg
    from public.dispatch_order_packages
   where od_id = p_od_id and package_id = p_package_id
   for update;
  if v_pkg.od_id is null then
    raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
  end if;

  -- 3. Validar boxes_shipped
  if p_boxes_shipped <= 0 or p_boxes_shipped >= v_pkg.boxes_total then
    raise exception 'boxes_shipped debe estar entre 1 y boxes_total-1' using errcode = 'P0009';
  end if;

  v_remaining := v_pkg.boxes_total - p_boxes_shipped;

  -- 4. Validar OD tenant
  select * into v_od from public.dispatch_orders where id = p_od_id;
  if v_od.tenant_id <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 5. Update el junction P1: boxes_shipped + motivo
  update public.dispatch_order_packages
     set boxes_shipped = p_boxes_shipped,
         split_reason = p_split_reason,
         split_reason_text = p_split_reason_text
   where od_id = p_od_id and package_id = p_package_id;

  -- 6. Generar code P2 via RPC (no llamamos next_dispatch_order_code porque
  --    chequea auth.uid; usamos la lógica inline acá)
  declare
    v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
    v_max  int;
  begin
    select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
      into v_max
      from public.dispatch_orders
     where tenant_id = v_tenant_id
       and order_code like 'OD-' || v_year || '-%';
    v_new_code := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  end;

  -- 7. Crear OD P2 (sin camión/chofer · status='creada')
  insert into public.dispatch_orders (
    tenant_id, order_code, status, hub,
    route_id, truck_id, driver_id,
    total_kg, total_cbm, package_count,
    cities_ordered,
    parent_od_id
  ) values (
    v_tenant_id,
    v_new_code,
    'creada',
    v_od.hub,
    v_od.route_id,
    null,                                              -- admin reasigna
    null,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    1,
    array[v_pkg.city]::text[],
    p_od_id
  )
  returning id into v_new_od_id;

  -- 8. Insertar junction de la P2
  insert into public.dispatch_order_packages (
    od_id, package_kind, package_id, markbox, client_name, city, pay,
    description, boxes_total, boxes_shipped, weight_kg, cbm,
    hs_code, aes_code
  ) values (
    v_new_od_id, v_pkg.package_kind, v_pkg.package_id, v_pkg.markbox,
    v_pkg.client_name, v_pkg.city, v_pkg.pay,
    v_pkg.description, v_remaining, v_remaining,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    v_pkg.hs_code, v_pkg.aes_code
  );

  return v_new_od_id;
end;
$$;

comment on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text) is
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC camionero_advance_od
--
-- Transiciones permitidas para el camionero:
--   lista → en_ruta         ("Iniciar ruta")
--   en_ruta → entregada     (cuando hizo la última POD)
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status,
  p_progress       int,
  p_current_city   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
     set status = p_status,
         progress_pct = coalesce(p_progress, progress_pct),
         current_city = coalesce(p_current_city, current_city),
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.camionero_advance_od is
  'Advance OD desde la PWA del camionero. Solo permite lista→en_ruta y en_ruta→entregada.';

revoke all on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC camionero_pod
--
-- Crea fila dispatch_pods con foto/firma/receptor. No cambia status
-- automáticamente — eso lo hace camionero_advance_od cuando es la
-- última entrega.
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text
)
returns uuid          -- id del POD creado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod is
  'Confirma POD (Proof of Delivery) de una entrega: foto + firma + receptor. Llamada desde la PWA del camionero.';

revoke all on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
$sdd0118_1_1$
  ] || statements
where version = '20260527073053'
  and name = 'realtime_dispatch'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '528cbe1e1d4e39ba597403efbac747d2';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_2_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0032: Seed del template "Bienvenida MARKBOX" (welcome_markbox)
--
-- Upsert idempotente del template para todos los tenants existentes.
-- Si más tenants se crean después, agregar trigger o seed en alta de tenant.
--
-- Usado por:
--   - sendWelcomeEmailAction (lib/studio/welcome-email.ts)
--   - createClientAction (app/studio/(app)/clientes/actions.ts)
--
-- Schema base: mail_templates (SDD-0026, migración 0018_mailing.sql).
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    insert into public.mail_templates (
      tenant_id, slug, name, category, channel,
      subject, body_html, variables, lang, active
    ) values (
      v_tenant.id,
      'welcome_markbox',
      'Bienvenida MARKBOX',
      'cliente',
      'email',
      'Bienvenido a DTD Cargo · tu código es {{markbox}}',
      $html$<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px">¡Bienvenido <b>{{client_name}}</b>!</p>
<p style="margin:0 0 16px">Tu cuenta en DTD Cargo está activa.</p>
<p style="margin:0 0 8px"><b>Tu código MARKBOX:</b></p>
<p style="margin:0 0 20px">
  <code style="background:#FFFFFF;padding:8px 16px;border-radius:4px;color:#7F0F1A;font-weight:900;font-family:'JetBrains Mono',monospace;font-size:22px;border:1px solid #E8E6E2">{{markbox}}</code>
</p>
<p style="margin:0 0 12px">Usalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja antes del despacho a nuestro almacén CN.</p>
<p style="margin:0 0 12px"><b>Acceso al portal:</b><br><a href="{{portal_link}}" style="color:#7F0F1A;text-decoration:underline">{{portal_link}}</a></p>
<p style="margin:0 0 12px">Dudas o ayuda → respondé este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Servicio puerta a puerta China-Venezuela</p>
</div>$html$,
      array['client_name', 'markbox', 'portal_link']::text[],
      'es',
      true
    )
    on conflict (tenant_id, slug) do nothing;
  end loop;
end $$;

comment on table public.mail_templates is
  'Templates de email del Studio. Slug welcome_markbox seedado por SDD-0032 para email de bienvenida automático al crear cliente con email.';
$sdd0118_2_0$
  ]
where version = '20260528060005'
  and name = '0026_welcome_email_template_seed'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '0cfa106867486d74f9ad5ec39fc266d1';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_3_0$-- ─────────────────────────────────────────────────────────────
-- SDD-0033: Cola de impresión QR · vista oficina
--
-- Tabla qr_print_orders que recibe órdenes del operario CN PWA
-- (push via RPC con cookie HTTP-only) y consume admin web en
-- /studio/cola-qr para imprimir + marcar entregado.
--
-- 2 enums + 1 tabla + 2 RPCs (next code + push as operario) +
-- trigger guard de transición + RLS por tenant + Realtime ready.
-- ─────────────────────────────────────────────────────────────

-- ENUMS

create type qr_order_status as enum (
  'pendiente',
  'imprimiendo',
  'impreso',
  'entregado',
  'cancelado'
);

create type qr_order_priority as enum ('urgent', 'normal');

-- ─────────────────────────────────────────────────────────────
-- Tabla qr_print_orders
-- ─────────────────────────────────────────────────────────────

create table public.qr_print_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  order_code               text not null,                                     -- 'QR-2026-0142'
  warehouse_id             uuid references public.warehouses_cn(id),
  markbox                  text not null,
  client_name              text not null,                                     -- denorm
  supplier_name            text,
  bultos                   int not null check (bultos > 0),

  -- Quién la mandó
  sent_by_operario_id      uuid references public.operario_pins(id) on delete set null,
  sent_by_name             text not null,                                     -- denorm snapshot
  sent_by_phone            text,
  sent_at                  timestamptz not null default now(),

  -- Estado
  priority                 qr_order_priority not null default 'normal',
  status                   qr_order_status not null default 'pendiente',
  assigned_printer         text,                                              -- label libre · sin tabla printers V1

  -- Lifecycle
  printed_at               timestamptz,
  printed_by               uuid references auth.users(id) on delete set null,
  delivered_at             timestamptz,
  delivered_by             uuid references auth.users(id) on delete set null,
  cancelled_at             timestamptz,
  cancelled_by             uuid references auth.users(id) on delete set null,
  cancel_reason            text,

  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (tenant_id, order_code)
);

comment on table public.qr_print_orders is
  'Cola de impresión de QR. Operario CN pushea via RPC (cookie HTTP-only · sin auth.uid). Admin web consume en /studio/cola-qr y marca como impreso/entregado.';

create index qr_print_orders_tenant_status_idx
  on public.qr_print_orders (tenant_id, status, sent_at desc)
  where status not in ('entregado', 'cancelado');

create index qr_print_orders_tenant_all_idx
  on public.qr_print_orders (tenant_id, sent_at desc);

create index qr_print_orders_markbox_idx
  on public.qr_print_orders (tenant_id, markbox, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC next_qr_order_code · secuencial QR-YYYY-NNNN por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_qr_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max  int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    -- También permitir service_role (operario · sin auth.uid)
    if auth.uid() is not null then
      raise exception 'No autorizado para tenant %', p_tenant_id;
    end if;
  end if;

  select coalesce(max((substring(order_code from 'QR-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.qr_print_orders
  where tenant_id = p_tenant_id
    and order_code like 'QR-' || v_year || '-%';

  return 'QR-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;

comment on function public.next_qr_order_code(uuid) is
  'Genera próximo QR-YYYY-NNNN para el tenant. Mismo patrón que next_dispatch_order_code. Permite caller con auth.uid o service_role.';

grant execute on function public.next_qr_order_code(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC push_qr_order_as_operario
--
-- Llamado desde server action /m/cn/* con service_role. Recibe
-- operario_id (de cookie HTTP-only) y crea la orden con status
-- 'pendiente'. Denormaliza display_name y phone del operario.
-- ─────────────────────────────────────────────────────────────

create or replace function public.push_qr_order_as_operario(
  p_operario_id     uuid,
  p_warehouse_id    uuid,                              -- nullable · puede sacarse del operario
  p_markbox         text,
  p_client_name     text,
  p_supplier_name   text,
  p_bultos          int,
  p_priority        qr_order_priority,
  p_notes           text
)
returns table (
  id          uuid,
  order_code  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_active     boolean;
  v_op_name    text;
  v_op_phone   text;
  v_wh_id      uuid;
  v_code       text;
  v_new_id     uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, active, display_name, last_login_at
    into v_tenant_id, v_role, v_active, v_op_name, v_op_phone
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Sanity
  if p_markbox is null or length(trim(p_markbox)) = 0 then
    raise exception 'markbox requerido' using errcode = 'P0003';
  end if;
  if p_bultos is null or p_bultos <= 0 then
    raise exception 'bultos debe ser > 0' using errcode = 'P0004';
  end if;

  -- 3. Warehouse: si no vino, lee el del operario
  if p_warehouse_id is null then
    select warehouse_id into v_wh_id
      from public.operario_pins where id = p_operario_id;
  else
    v_wh_id := p_warehouse_id;
  end if;

  -- 4. Generar code
  v_code := public.next_qr_order_code(v_tenant_id);

  -- 5. Insert
  insert into public.qr_print_orders (
    tenant_id, order_code, warehouse_id,
    markbox, client_name, supplier_name, bultos,
    sent_by_operario_id, sent_by_name, sent_by_phone,
    priority, status, notes
  ) values (
    v_tenant_id, v_code, v_wh_id,
    trim(p_markbox), trim(coalesce(p_client_name, '—')),
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_bultos,
    p_operario_id, v_op_name, nullif(trim(coalesce(v_op_phone, '')), ''),
    coalesce(p_priority, 'normal'),
    'pendiente',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning qr_print_orders.id into v_new_id;

  return query select v_new_id, v_code;
end;
$$;

comment on function public.push_qr_order_as_operario is
  'Operario CN pushea una orden de impresión desde el PWA /m/cn. security definer · invocado con service_role desde server action.';

revoke all on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) from public, anon, authenticated;
grant execute on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Trigger guard de transición
-- ─────────────────────────────────────────────────────────────

create or replace function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido desde terminal
    if old.status in ('entregado', 'cancelado') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- impreso solo puede ir a entregado o cancelado
    if old.status = 'impreso' and new.status not in ('entregado', 'cancelado') then
      raise exception 'Desde impreso solo se puede ir a entregado o cancelado';
    end if;

    -- imprimiendo no puede retroceder a pendiente
    if old.status = 'imprimiendo' and new.status = 'pendiente' then
      raise exception 'No se puede retroceder de imprimiendo a pendiente';
    end if;

    -- Auto-stamp
    if new.status = 'impreso' and new.printed_at is null then
      new.printed_at := now();
      new.printed_by := coalesce(new.printed_by, auth.uid());
    elsif new.status = 'entregado' and new.delivered_at is null then
      new.delivered_at := now();
      new.delivered_by := coalesce(new.delivered_by, auth.uid());
    elsif new.status = 'cancelado' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger qr_print_orders_status_guard
  before update on public.qr_print_orders
  for each row execute function public.qr_print_orders_status_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders enable row level security;

create policy qr_print_orders_select on public.qr_print_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy qr_print_orders_update on public.qr_print_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- INSERT NO desde authenticated · solo service_role (vía push_qr_order_as_operario)
create policy qr_print_orders_no_insert_auth on public.qr_print_orders
  for insert to authenticated with check (false);

-- DELETE NO desde authenticated · admin cancela cambiando status
create policy qr_print_orders_no_delete_auth on public.qr_print_orders
  for delete to authenticated using (false);

grant select, update on public.qr_print_orders to authenticated;
grant select, insert, update, delete on public.qr_print_orders to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (V2: cliente se suscribe al channel)
-- ─────────────────────────────────────────────────────────────

-- Agregar tabla a la publicación si la pub existe (Supabase la crea por default)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.qr_print_orders';
  end if;
exception when others then
  raise notice 'No se pudo agregar qr_print_orders a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
$sdd0118_3_0$
  ]
where version = '20260528060006'
  and name = '0027_qr_print_orders'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '73f96e878683199f797992231e976560';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_4_0$-- 0031_fix_studio_invite_gen_random_bytes.sql
--
-- Fix bug: studio_invite_user falla con "function gen_random_bytes(integer)
-- does not exist" porque set search_path=public restringe la búsqueda y
-- gen_random_bytes vive en schema extensions (no public).
--
-- Detectado 2026-05-26 al testear el flow de invitación post-setup Resend.
-- Fix: hardcode extensions.gen_random_bytes(24).
--
-- No cambia signature ni comportamiento, solo arregla el qualifier.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  -- Validar role
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  -- Validar caller es admin del tenant
  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  -- Email válido (simple check)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  -- ¿Ya es miembro activo?
  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  -- ¿Hay invitation pendiente? → devolver la existente
  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- Generar token 32 chars url-safe (base64 sin padding sobre 24 bytes random).
  -- FIX 0031: extensions.gen_random_bytes (no public, search_path=public lo excluye).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- Insert invitation
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning id, token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_4_0$
  ]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '9e4dc98716f8335c93e9961ccdf18fbe';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_5_0$-- 0032_fix_studio_invite_ambiguous_token.sql
--
-- Fix bug: studio_invite_user falla con "column reference 'token' is ambiguous"
-- porque el RETURNS TABLE (invitation_id uuid, token text) declara una OUTPUT
-- column llamada `token` que clashea con la columna real
-- public.user_invitations.token en el RETURNING.
--
-- Detectado 2026-05-26 inmediatamente después de aplicar 0031 (gen_random_bytes
-- qualifier fix). Cuando se hizo el primer test real de invitación.
--
-- Fix: qualificar user_invitations.token en el RETURNING.

create or replace function public.studio_invite_user(
  p_email text,
  p_role text
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_email text := lower(trim(p_email));
  v_token text;
  v_existing record;
begin
  if p_role not in ('admin', 'commercial', 'operations', 'accounting', 'warehouse', 'support') then
    raise exception 'Rol inválido: %', p_role using errcode = '22023';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role <> 'admin' then
    raise exception 'Solo admins pueden invitar usuarios' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido: %', v_email using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_tenants ut
    join auth.users u on u.id = ut.user_id
    where ut.tenant_id = v_tenant_id and lower(u.email) = v_email and ut.disabled_at is null
  ) then
    raise exception 'Ese email ya es miembro activo del tenant' using errcode = '23505';
  end if;

  select * into v_existing
  from public.user_invitations
  where tenant_id = v_tenant_id and email = v_email
    and accepted_at is null and revoked_at is null;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.token;
    return;
  end if;

  -- gen_random_bytes vive en schema extensions (fix 0031)
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  -- FIX 0032: qualificar user_invitations.token en RETURNING porque
  -- el RETURNS TABLE declara una output column 'token' que clashea.
  return query
  insert into public.user_invitations (
    tenant_id, email, role, token, invited_by
  ) values (
    v_tenant_id, v_email, p_role, v_token, v_actor
  )
  returning user_invitations.id, user_invitations.token;
end;
$$;

comment on function public.studio_invite_user is
  'Solo admins. Crea invitation o devuelve la existente si ya hay pending. Token 32 chars url-safe, expira en 7 días.';
$sdd0118_5_0$
  ]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = 'accd69afa043efc46960c8de5faa7c34';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_6_0$-- 0033_grant_service_role_policies.sql
--
-- Fix raíz: tablas mail_* y user_* del Studio fueron creadas SIN
-- GRANT base a service_role. Las policies para authenticated existían
-- pero PostgREST rechazaba al admin client antes incluso de evaluar RLS
-- porque service_role no tenía siquiera SELECT/INSERT permission.
--
-- Hint literal de PostgreSQL al hacer SELECT con service_role:
--   "permission denied for table mail_config
--    HINT: Grant the required privileges to the current role with:
--    GRANT SELECT ON public.mail_config TO service_role;"
--
-- Sin GRANT base, la policy nunca se evalúa.
--
-- Esto rompía:
--   - sendEmail() helper (no podía leer mail_config, escribir mail_logs)
--   - pnpm seed con seedAgents (skills sin grant) y seedMailTemplates
--     (tenants sin grant)
--   - Bug Reporter F5 cuando llegue (necesita admin email send)
--   - Webhook handler /api/webhooks/resend (admin update mail_logs)
--
-- Detectado 2026-05-26 al testear flow de invitación post-setup Resend.
-- Aplicado in-place en prod ese mismo día via MCP execute_sql.

-- 1. GRANTs base · service_role necesita acceso CRUD completo
grant all on public.mail_config to service_role;
grant all on public.mail_logs to service_role;
grant all on public.mail_blacklist to service_role;
grant all on public.mail_templates to service_role;
grant all on public.mail_rules to service_role;

grant all on public.tenants to service_role;
grant all on public.user_tenants to service_role;
grant all on public.user_invitations to service_role;
grant all on public.user_profiles to service_role;
grant all on public.skills to service_role;

-- 2. Defensive: futuras tablas en public auto-granteadas a service_role
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 3. Policies "service_role bypass" · defense in depth
-- (los grants ya alcanzan, pero las policies explícitas hacen el intent
-- evidente para future auditing)
create policy "service_role_all_mail_config"
  on public.mail_config for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_logs"
  on public.mail_logs for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_blacklist"
  on public.mail_blacklist for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_templates"
  on public.mail_templates for all to service_role
  using (true) with check (true);

create policy "service_role_all_mail_rules"
  on public.mail_rules for all to service_role
  using (true) with check (true);

create policy "service_role_all_tenants"
  on public.tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_tenants"
  on public.user_tenants for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_invitations"
  on public.user_invitations for all to service_role
  using (true) with check (true);

create policy "service_role_all_user_profiles"
  on public.user_profiles for all to service_role
  using (true) with check (true);
$sdd0118_6_0$
  ]
where version = '20260528060009'
  and name = '0033_grant_service_role_policies'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '7c389fe42d9ea494f340316bd78917cc';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_7_0$-- 0035_fix_verify_operario_pin_extensions.sql
--
-- Fix regresión: la migración 0025 (SDD-0030) recreó verify_operario_pin
-- para agregar el campo `region` al return type, pero lo hizo con
-- `set search_path = public` (sin extensions). Eso rompió el lookup de
-- crypt() de pgcrypto que vive en schema extensions.
--
-- Impact: las PWAs operario (/m/cn login + /m/ve login + /m/admin login)
-- estaban TOTALMENTE rotas — el login con PIN devolvía "function
-- crypt(text, text) does not exist".
--
-- La migración 0020b había aplicado el fix originalmente, pero 0025 lo
-- pisó con DROP + CREATE sin preservar el search_path correcto.
--
-- Detectado 2026-05-26 noche durante audit preventivo post setup Resend.
-- Fix: re-aplicar con search_path = public, extensions.
--
-- Lección: cualquier RPC que use crypt/gen_salt/gen_random_bytes/digest/
-- uuid_generate_v4/hmac de pgcrypto DEBE tener `extensions` en search_path
-- o usar qualifier `extensions.X()` explícito.

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region
)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_matches int;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$func$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030. search_path incluye extensions para resolver crypt() de pgcrypto.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;
$sdd0118_7_0$
  ]
where version = '20260528060010'
  and name = '0035_fix_verify_operario_pin_extensions'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '2bde657a6160e36a7c44d7b4d0a31066';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_8_0$-- 0036_fk_user_tenants_profile.sql
--
-- Fix bug: /studio/usuarios devolvía HTTP 400 al consumir
-- `user_tenants?select=...,profile:user_profiles(*)`.
--
-- Causa: PostgREST requiere FK declarada para resolver embed
-- `profile:user_profiles(*)`. La tabla user_tenants NO tenía
-- FK a user_profiles (solo a tenants), aunque user_tenants.user_id
-- y user_profiles.user_id son siempre el mismo uuid de auth.users.
--
-- Fix: agregar FK explícita. user_profiles.user_id ya es PK,
-- así que el target es válido. ON DELETE CASCADE matchea el
-- comportamiento de user_profiles → auth.users.
--
-- Detectado 2026-05-26 al revisar logs API durante audit post-Resend.

alter table public.user_tenants
  add constraint user_tenants_user_id_profile_fkey
  foreign key (user_id) references public.user_profiles(user_id)
  on delete cascade;

-- Refresh PostgREST schema cache para que reconozca la FK nueva inmediato
notify pgrst, 'reload schema';
$sdd0118_8_0$
  ]
where version = '20260528060011'
  and name = '0036_fk_user_tenants_profile'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '360306612b953b7e385c4e9d3847f5fa';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_9_0$-- 0037_harden_operario_pin_validator.sql
--
-- Mejora seguridad: el validator validate_operario_pin_format solo
-- chequeaba que el PIN tuviera 4 dígitos numéricos. NO bloqueaba PINs
-- comunes (1234, 0000, etc) que son trivialmente vulnerable a brute force
-- en login PIN (sin lockout actual).
--
-- Detectado 2026-05-26: durante audit post-Resend, operario Yusneidy Pérez
-- tenía PIN '1234'. Top 10 PINs más comunes representan ~15% de todos los
-- PINs en estudios reales.
--
-- Fix: agregar blacklist explícita de 24 PINs débiles comunes al validator.
-- Aplica a admin_create_operario y admin_reset_operario_pin que llaman
-- a esta función.
--
-- Operarios existentes con PINs débiles NO se resetean automáticamente
-- (impactaría operación). El founder decide cuándo y con qué PIN nuevo.
--
-- Referencia: https://datagenetics.com/blog/september32012/

create or replace function public.validate_operario_pin_format(p_pin text)
returns void
language plpgsql
immutable
as $func$
begin
  -- Format: exactamente 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';
  end if;

  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios + patrones)
  if p_pin in (
    -- Repetidos: 10
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    -- Secuenciales: 4
    '1234', '4321', '0123', '0987',
    -- Patrones tipo MM-DD-AA o piano keys: 10
    '1212', '2121', '0101', '1010', '1313',
    '6969', '2580', '1357', '2468', '1379'
  ) then
    raise exception 'PIN demasiado común. Elegí uno menos predecible.'
      using errcode = 'P0010';
  end if;
end;
$func$;

comment on function public.validate_operario_pin_format is
  'Valida format PIN (4 dígitos) + blacklist de PINs comunes. Llamada desde admin_create_operario y admin_reset_operario_pin.';
$sdd0118_9_0$
  ]
where version = '20260528060012'
  and name = '0037_harden_operario_pin_validator'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '4119b8a81a6934fad97621cd6570dc21';

update supabase_migrations.schema_migrations
set statements = array[
    $sdd0118_10_0$-- 0039_fix_bug_advance_state_actor_type_cast.sql
--
-- Fix bug en bug_advance_state RPC: falla con
--   "column actor_type is of type bug_author_type but expression is of type text"
-- al intentar cambiar el estado de un bug desde el drawer admin.
--
-- Causa: el INSERT a bug_timeline pasa un `case when ... then 'admin' else 'user' end`
-- expression que PostgreSQL infiere como `text`. La columna actor_type es enum
-- bug_author_type y PostgreSQL no auto-castea text → enum en INSERT context.
--
-- Detectado 2026-05-26 al testear F5 mínimo viable (creé BUG-00003 crítico y
-- Sam intentó clickear "Tomar bug" desde el drawer).
--
-- Fix: cast explícito al final del case expression:
--   (case when ... else ... end)::bug_author_type

create or replace function public.bug_advance_state(
  p_bug_id uuid,
  p_new_state bug_state,
  p_note text default null
)
returns bug_reports
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_old_state    bug_state;
  v_row          public.bug_reports;
begin
  if v_actor is null then
    raise exception 'Necesitás estar autenticado' using errcode = '42501';
  end if;

  select * into v_row from public.bug_reports where id = p_bug_id for update;

  if v_row.id is null then
    raise exception 'Bug no encontrado' using errcode = 'P0001';
  end if;

  select role into v_actor_role
    from public.user_tenants
   where user_id = v_actor and tenant_id = v_row.tenant_id and disabled_at is null;

  if v_actor_role is null then
    raise exception 'No pertenecés al tenant del bug' using errcode = '42501';
  end if;

  if v_actor_role <> 'admin' then
    if not (v_row.reporter_id = v_actor and v_row.state = 'espera' and p_new_state = 'triaje') then
      raise exception 'Solo admins pueden cambiar el estado del bug' using errcode = '42501';
    end if;
  end if;

  v_old_state := v_row.state;

  if v_old_state in ('resuelto', 'descartado') then
    raise exception 'No se puede modificar bug en estado terminal %', v_old_state using errcode = 'P0002';
  end if;

  if not (
    (v_old_state = 'nuevo'     and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'triaje'    and p_new_state in ('espera', 'progreso', 'descartado')) or
    (v_old_state = 'espera'    and p_new_state in ('triaje', 'descartado')) or
    (v_old_state = 'progreso'  and p_new_state in ('resuelto', 'espera', 'descartado'))
  ) then
    raise exception 'Transición % → % no permitida', v_old_state, p_new_state using errcode = 'P0003';
  end if;

  update public.bug_reports
     set state         = p_new_state,
         taken_by      = case when p_new_state = 'triaje' and taken_by is null then v_actor else taken_by end,
         taken_at      = case when p_new_state = 'triaje' and taken_at is null then now() else taken_at end,
         resolved_at   = case when p_new_state = 'resuelto'  then now() else resolved_at end,
         discarded_at  = case when p_new_state = 'descartado' then now() else discarded_at end,
         updated_at    = now()
   where id = p_bug_id
   returning * into v_row;

  -- FIX 0039: cast explícito a bug_author_type
  insert into public.bug_timeline (bug_id, event_type, actor_id, actor_type, payload)
  values (
    p_bug_id, 'state_change', v_actor,
    (case when v_actor_role = 'admin' then 'admin' else 'user' end)::bug_author_type,
    jsonb_build_object('from_state', v_old_state, 'to_state', p_new_state, 'note', p_note)
  );

  return v_row;
end;
$func$;
$sdd0118_10_0$
  ]
where version = '20260528060013'
  and name = '0039_fix_bug_advance_state_actor_type_cast'
  and cardinality(statements) = 1
  and md5(array_to_string(statements, E'\n')) = '22bc70e8f7d216fc1d68e8e8bc3b71fa';

do $sdd0118_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260526213130'
      and name = 'seed_team_invitation_template'
      and (
        (
          cardinality(statements) = 2
          and md5(statements[1]) = 'e2e1b4c3846c7fba431455c9130f0d34'
          and md5(statements[2]) = 'e087ed48b2838aca3d1ba061ed7a6ab6'
        )
        or (
          cardinality(statements) = 63
          and md5(array_to_string(statements, E'\n')) = 'b9da059306c4a80875e54947b9338252'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260526213130 seed_team_invitation_template';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260527073053'
      and name = 'realtime_dispatch'
      and (
        (
          cardinality(statements) = 3
          and md5(statements[1]) = 'fc9872ff14733d3d9cac5f0cbb330962'
          and md5(statements[2]) = 'bc9153c31f543e4a74aaa2c570a7aff4'
          and md5(statements[3]) = '528cbe1e1d4e39ba597403efbac747d2'
        )
        or (
          cardinality(statements) = 110
          and md5(array_to_string(statements, E'\n')) = 'ffa4e66b1ca875226edc55a86b37d780'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260527073053 realtime_dispatch';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060005'
      and name = '0026_welcome_email_template_seed'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b0a7c682cc6031be6034940cb27a5702'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'c399ccef97c43bcb53a512ae7f89fb1c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060005 0026_welcome_email_template_seed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060006'
      and name = '0027_qr_print_orders'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'b760d6196dc02d67036148d33b4ce1f1'
        )
        or (
          cardinality(statements) = 24
          and md5(array_to_string(statements, E'\n')) = 'fb618384a1a3f605c1fe8694a03ec937'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060006 0027_qr_print_orders';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '8296dce3805f143e549a239995bd954a'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = 'e7f1e2878e508b2338f4f014f8e9578f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'bb5879cd44f1b5911511e223a0618e51'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '45a1d8ecf3de592e7c2106bb704e709f'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060009'
      and name = '0033_grant_service_role_policies'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'a09e03f9f62c47b32ee0a5b4902fa834'
        )
        or (
          cardinality(statements) = 22
          and md5(array_to_string(statements, E'\n')) = '1ee346e5e133b78975092b3e35e85ee4'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060009 0033_grant_service_role_policies';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060010'
      and name = '0035_fix_verify_operario_pin_extensions'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '732f8ed961708b91b94cf4965ca8d797'
        )
        or (
          cardinality(statements) = 5
          and md5(array_to_string(statements, E'\n')) = '5f11aede669230b8ac8f9e192d71bdd1'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060010 0035_fix_verify_operario_pin_extensions';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060011'
      and name = '0036_fk_user_tenants_profile'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'ba63f9c578e32019aaafc8e6d6247056'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = '3793eabacad9b8462e6d79b80c3df1ee'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060011 0036_fk_user_tenants_profile';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060012'
      and name = '0037_harden_operario_pin_validator'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '6e3f5a4763cd32e66a33f189af2da876'
        )
        or (
          cardinality(statements) = 2
          and md5(array_to_string(statements, E'\n')) = 'b518fb6c89d4e61d28fdde7b7d7cd23c'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060012 0037_harden_operario_pin_validator';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060013'
      and name = '0039_fix_bug_advance_state_actor_type_cast'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'f2872b0ac20dd9e070b14085a60a3fb6'
        )
        or (
          cardinality(statements) = 1
          and md5(array_to_string(statements, E'\n')) = '8d9f6730f9b5d420d2cf807eedaa66d9'
        )
      )
  ) then
    raise exception 'SDD-0118 postflight: reparación incompleta en 20260528060013 0039_fix_bug_advance_state_actor_type_cast';
  end if;
end
$sdd0118_postflight$;
$sdd0118_split_patched_0271$
]
where version = '20260729135053'
  and name = '0271_repair_branch_replay_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0839e50eeb47a158382fc2f6c27d5fe9'
    )
    or (
      cardinality(statements) = 13
      and md5(array_to_string(statements, E'\n')) = '47c33a4bde5fde9963bd3a26adeb77bf'
    )
  );

do $sdd0118_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c7b1f468087e249e2ca44359aa3f686f'
  ) then
    raise exception '0280 abortada: 0271 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_split_postconditions$;

$sdd0118_replay_gate_0$
]
where version = '20260730002206'
  and name = '0280_repair_sdd0118_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '0cd59e31c466de0286c5b82091d3db32'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '9028fffb80d2c9893aabf1e6ee7afb6e'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_1$-- SDD-0118 · hacer replay-safe el skip histórico de invitaciones.
-- Sólo sustituye el payload de 0272 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_invite_skip_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('887cc625c50ba8f6a2292bad25989fc5', '4242bf102d649559d13793b53e46f43c')
        )
        or (
          cardinality(statements) = 4
          and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
        )
      )
  ) then
    raise exception '0281 abortada: ledger 0272 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_invite_skip_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_invite_skip_split_patched_0272$-- SDD-0118 · omitir dos fixes de invitaciones supersedidos.
-- Sólo restaura comments no-op en el ledger; no ejecuta DDL de negocio.
-- 0281 acepta además los payloads fragmentados que 0280 preserva en replay.

do $sdd0118_followup_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f', '9e4dc98716f8335c93e9961ccdf18fbe')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f', 'accd69afa043efc46960c8de5faa7c34')
  ) then
    raise exception 'SDD-0118 follow-up: drift en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_0$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0031_fix_studio_invite_gen_random_bytes.sql.$sdd0118_followup_0$
]
where version = '20260528060007'
  and name = '0031_fix_studio_invite_gen_random_bytes'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('8296dce3805f143e549a239995bd954a', 'e7f1e2878e508b2338f4f014f8e9578f');

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_followup_1$-- Registered post-hoc 2026-05-28 (audit). Source: supabase/migrations/0032_fix_studio_invite_ambiguous_token.sql.$sdd0118_followup_1$
]
where version = '20260528060008'
  and name = '0032_fix_studio_invite_ambiguous_token'
  and cardinality(statements) = 1
  and md5(statements[1]) in ('bb5879cd44f1b5911511e223a0618e51', '45a1d8ecf3de592e7c2106bb704e709f');

do $sdd0118_followup_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060007'
      and name = '0031_fix_studio_invite_gen_random_bytes'
      and cardinality(statements) = 1
      and md5(statements[1]) = '9e4dc98716f8335c93e9961ccdf18fbe'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060007 0031_fix_studio_invite_gen_random_bytes';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260528060008'
      and name = '0032_fix_studio_invite_ambiguous_token'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'accd69afa043efc46960c8de5faa7c34'
  ) then
    raise exception 'SDD-0118 follow-up: postcondición falló en 20260528060008 0032_fix_studio_invite_ambiguous_token';
  end if;
end
$sdd0118_followup_postflight$;

$sdd0118_invite_skip_split_patched_0272$
]
where version = '20260729140214'
  and name = '0272_skip_superseded_invite_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '887cc625c50ba8f6a2292bad25989fc5'
    )
    or (
      cardinality(statements) = 4
      and md5(array_to_string(statements, E'\n')) = '46339fd905e6b1a9ac3eafd55cdb620b'
    )
  );

do $sdd0118_invite_skip_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729140214'
      and name = '0272_skip_superseded_invite_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '4242bf102d649559d13793b53e46f43c'
  ) then
    raise exception '0281 abortada: 0272 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_invite_skip_split_postconditions$;

$sdd0118_replay_gate_1$
]
where version = '20260730011643'
  and name = '0281_repair_invite_skip_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '08ffa846d67496336012a46029848d1a'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '2497d8f67f2cda02d8cb5cab9b113844'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_2$-- SDD-0118 · hacer replay-safe el skip histórico de platform_admins.
-- Sólo sustituye el payload de 0273 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_platform_admin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('22cac3383ef1d3c9a0a814508cc4c817', '7866d00b211f8158f79117657fd8a8d1')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
        )
      )
  ) then
    raise exception '0282 abortada: ledger 0273 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_platform_admin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_split_patched_0273$-- SDD-0118 · omitir del replay el bootstrap fijo de platform_admins.
-- Conserva el DDL canónico y sólo modifica el statement técnico del ledger.
-- 0282 acepta además el payload de diez statements observado en R13.

do $sdd0118_platform_admin_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in (
            '6c31b8ac8841b24815e3fb2463eabdd2',
            'bb99b54106d671457836daa0dc53b839',
            'cb374d4ad4c3b2bb62915e80a5a13793'
          )
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
        )
      )
  ) then
    raise exception 'SDD-0118 platform_admins: drift en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_platform_admin_target$-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Replay-safe: el bootstrap de datos se omite intencionalmente.
-- La membresía platform_admin se provisiona fuera del replay del schema.
$sdd0118_platform_admin_target$
]
where version = '20260529071707'
  and name = 'platform_admins'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) in ('6c31b8ac8841b24815e3fb2463eabdd2', 'bb99b54106d671457836daa0dc53b839')
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = '4912baa3058c9f1a4f2281b843499fcd'
    )
  );

do $sdd0118_platform_admin_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260529071707'
      and name = 'platform_admins'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cb374d4ad4c3b2bb62915e80a5a13793'
  ) then
    raise exception 'SDD-0118 platform_admins: postcondición falló en 20260529071707 platform_admins';
  end if;
end
$sdd0118_platform_admin_postflight$;
$sdd0118_platform_admin_split_patched_0273$ || chr(13) || chr(10)
]
where version = '20260729141805'
  and name = '0273_skip_platform_admin_bootstrap_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '22cac3383ef1d3c9a0a814508cc4c817'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '92a91df672663aadb5d5b5fc5e72e654'
    )
  );

do $sdd0118_platform_admin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729141805'
      and name = '0273_skip_platform_admin_bootstrap_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7866d00b211f8158f79117657fd8a8d1'
  ) then
    raise exception '0282 abortada: 0273 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_platform_admin_split_postconditions$;

$sdd0118_replay_gate_2$
]
where version = '20260730130403'
  and name = '0282_repair_platform_admin_skip_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5525c9ef4374d967e99d8886d4ec9532'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '4ee8cb102e54fd9623f858df6e032910'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_3$-- SDD-0118 · hacer replay-safe el restaurador histórico de calculator_settings.
-- Sólo sustituye el payload de 0274 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_calculator_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('6ddc823788cbdd6b280810d7ae61a86c', '7dec3bd4977326580000cbdb0d528305')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
        )
      )
  ) then
    raise exception '0283 abortada: ledger 0274 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_calculator_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_split_patched_0274$-- SDD-0118 · restaurar el payload reproducible de calculator_settings.
-- Sólo reemplaza el estado NULL o el split exacto de R14; no ejecuta el DDL almacenado.
-- 0283 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_calculator_settings_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
        )
        or (
          cardinality(statements) = 12
          and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
        )
      )
  ) then
    raise exception 'SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_calculator_settings_target$-- ─────────────────────────────────────────────────────────────
-- 0103 · Calculadora pública Fase 3 (Slice A) · calculator_settings
--        + RPC public_calculator_config() (anon, security definer endurecida)
--
-- Justificación negocio: la calculadora pública (app/calculadora) ya toma la
-- TARIFA BASE y el PISO desde la tarifa real del Studio (Fase 2, rates.is_public).
-- Pero el RESTO de las reglas (peso incluido por CBM, $/kg de excedente,
-- descuento Valencia, multiplicador de baterías, km del casco, $/km, recargo
-- de embalaje especial) sigue HARDCODEADO en lib/calculadora.ts (CONFIG).
-- Slice A las saca al Studio: el admin las edita en /studio/tarifas › Parámetros.
--
-- Alcance de esta tabla: SOLO las reglas escalares del calculador. La tarifa
-- base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
-- (fuente única, Fase 2). Ciudades y embalajes quedan para Slice B.
--
-- Mecanismo: una fila por tenant (singleton, tenant_id como PK). El sitio
-- público la lee vía RPC anon de retorno mínimo. Si no hay fila, el calculador
-- cae a los defaults de CONFIG (cero regresión).
--
-- Decisiones (mismo patrón que 0101):
--  · Singleton por tenant_id PK → no hay ambigüedad de "cuál config".
--  · CHECKs de cordura → previene config que rompa el cálculo (peso_max <
--    peso_incluido, multiplicador < 1, negativos).
--  · RPC scopeada a slug='dtd' explícito (mono-tenant en la práctica).
--  · SECURITY DEFINER endurecida: set search_path, refs schema-qualified,
--    revoke all from public + grant execute a anon.
--
-- Idempotente: create table if not exists + create or replace + drop if exists.
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla singleton por tenant
create table if not exists public.calculator_settings (
  tenant_id                 uuid primary key references public.tenants(id) on delete cascade,
  -- Reglas escalares del calculador LCL DDP (espejo de CONFIG en lib/calculadora.ts)
  peso_incluido_kg          numeric(10,2) not null default 500,   -- kg/CBM incluidos sin recargo
  peso_max_kg               numeric(10,2) not null default 600,   -- kg/CBM tope → alerta FCL
  recargo_excedente_kg      numeric(10,2) not null default 1,     -- $/kg sobre peso_incluido
  descuento_valencia        numeric(10,2) not null default 50,    -- $ off si destino = Valencia
  recargo_embalaje_especial numeric(10,2) not null default 50,    -- $ por embalaje madera/paleta
  recargo_bateria_mult      numeric(10,3) not null default 1.5,   -- ×flete si lleva baterías
  threshold_casco_km        numeric(10,2) not null default 200,   -- km de casco central (flat)
  tarifa_km_fuera_casco     numeric(10,2) not null default 1,     -- $/km fuera del casco
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id),
  -- Cordura: una config inválida rompería el calculador público.
  constraint calculator_settings_peso_incluido_pos check (peso_incluido_kg > 0),
  constraint calculator_settings_peso_max_gte_incluido check (peso_max_kg >= peso_incluido_kg),
  constraint calculator_settings_excedente_nonneg check (recargo_excedente_kg >= 0),
  constraint calculator_settings_descuento_nonneg check (descuento_valencia >= 0),
  constraint calculator_settings_embalaje_nonneg check (recargo_embalaje_especial >= 0),
  constraint calculator_settings_bateria_gte_one check (recargo_bateria_mult >= 1),
  constraint calculator_settings_casco_nonneg check (threshold_casco_km >= 0),
  constraint calculator_settings_km_nonneg check (tarifa_km_fuera_casco >= 0)
);

comment on table public.calculator_settings is
  'Reglas escalares del calculador público LCL DDP (Fase 3 Slice A). Una fila por tenant. La tarifa base y el piso NO viven acá (siguen en rates.is_public, Fase 2). La lee public_calculator_config() vía anon. Sin fila → el sitio cae a los defaults de CONFIG.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase)
grant select, insert, update on public.calculator_settings to authenticated;

-- 2) RLS por tenant (mismo nivel de permiso que editar rates: cualquier
--    usuario autenticado del tenant. No admin-gated, consistente con tarifas).
alter table public.calculator_settings enable row level security;

create policy "calculator_settings by tenant"
  on public.calculator_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- 3) Trigger updated_at (reusa function existente de 0002_shipments.sql)
create trigger calculator_settings_touch
  before update on public.calculator_settings
  for each row execute function public.touch_updated_at();

-- 4) Seed: fila default para el tenant dtd (matchea CONFIG de lib/calculadora.ts).
--    Sin esto el calculador igual anda (cae a CONFIG), pero el form del Studio
--    arranca poblado en vez de vacío.
insert into public.calculator_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) RPC public_calculator_config() · anon · retorno mínimo
-- ─────────────────────────────────────────────────────────────

drop function if exists public.public_calculator_config();

create or replace function public.public_calculator_config()
returns table (
  peso_incluido_kg          numeric,
  peso_max_kg               numeric,
  recargo_excedente_kg      numeric,
  descuento_valencia        numeric,
  recargo_embalaje_especial numeric,
  recargo_bateria_mult      numeric,
  threshold_casco_km        numeric,
  tarifa_km_fuera_casco     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.peso_incluido_kg, cs.peso_max_kg, cs.recargo_excedente_kg,
         cs.descuento_valencia, cs.recargo_embalaje_especial, cs.recargo_bateria_mult,
         cs.threshold_casco_km, cs.tarifa_km_fuera_casco
  from public.calculator_settings cs
  join public.tenants t on t.id = cs.tenant_id
  where t.slug = 'dtd'
  limit 1;
$$;

comment on function public.public_calculator_config() is
  'Endpoint público (anon) para la calculadora del sitio (calculadora Fase 3 Slice A). Devuelve las reglas escalares del calculador del tenant dtd. Retorno MÍNIMO, sin tenant_id ni data sensible. Par con public_cbm_rate() (que sirve base + piso). Scoped a slug=dtd.';

-- Grants: solo execute, anon + authenticated. Nadie más.
revoke all on function public.public_calculator_config() from public;
grant execute on function public.public_calculator_config() to anon, authenticated;
$sdd0118_calculator_settings_target$
]
where version = '20260604131310'
  and name = '0103_calculator_settings'
  and (
    statements is null
    or (
      cardinality(statements) = 12
      and md5(array_to_string(statements, E'\n')) = 'f7102aeb22551a4628923dfba5d11793'
    )
  );

do $sdd0118_calculator_settings_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260604131310'
      and name = '0103_calculator_settings'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0f7deee22e3a978c52159b6fc211ee2c'
  ) then
    raise exception 'SDD-0118 calculator_settings: postcondición falló en 20260604131310 0103_calculator_settings';
  end if;
end
$sdd0118_calculator_settings_postflight$;
$sdd0118_calculator_split_patched_0274$ || chr(13) || chr(10)
]
where version = '20260729143620'
  and name = '0274_restore_calculator_settings_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6ddc823788cbdd6b280810d7ae61a86c'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '672e8f2ed1df04f9f8b4de50f2295c50'
    )
  );

do $sdd0118_calculator_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729143620'
      and name = '0274_restore_calculator_settings_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '7dec3bd4977326580000cbdb0d528305'
  ) then
    raise exception '0283 abortada: 0274 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_calculator_split_postconditions$;

$sdd0118_replay_gate_3$
]
where version = '20260730132651'
  and name = '0283_repair_calculator_settings_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '6614a85c247cf6ead23573f7a8cb2514'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '96ba90f48a4f9c1742d7d52aabdf8d8d'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_4$-- SDD-0118 · hacer replay-safe el restaurador histórico de pin_search_path.
-- Sólo sustituye el payload de 0275 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_pin_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('a217fa825ff964f2c2a4cb26d31c3dbc', 'cad36533b4225b674f1d8fd7b8c165ea')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
        )
      )
  ) then
    raise exception '0284 abortada: ledger 0275 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_pin_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_split_patched_0275$-- SDD-0118 · restaurar el payload reproducible del pin de search_path.
-- Sólo reemplaza el estado NULL o el split exacto de R15; no ejecuta los ALTER almacenados.
-- 0284 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_pin_search_path_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
        )
        or (
          cardinality(statements) = 33
          and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
        )
      )
  ) then
    raise exception 'SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_pin_search_path_target$-- 0210 — Hardening: pin de search_path en las 33 funciones que lo tenían mutable
--
-- Advisor `function_search_path_mutable` (2026-07-03): 33 funciones de public
-- sin `set search_path` fijo — 32 trigger functions + validate_operario_pin_format.
-- Un search_path mutable permite que un rol con schema propio antepuesto
-- resuelva objetos ajenos dentro de la función (shadowing).
--
-- Pin elegido: `public` (precedente del repo: 190 usos en migraciones).
-- Verificado contra prod antes de escribir esto:
--   - ninguna de las 33 referencia funciones de extensiones sin calificar
--     (gen_random_bytes/crypt/digest/hmac/uuid_generate/http_*) — la lección
--     de la memoria "search_path excluye extensions" no aplica acá;
--   - las 3 que usan auth.* lo llaman calificado (auth.uid());
--   - pg_catalog se busca siempre implícito, no necesita estar en el pin.
-- ALTER FUNCTION ... SET no toca el cuerpo ni los grants: cero cambio de
-- comportamiento salvo la resolución de nombres, que hoy ya es public.

alter function public.academy_enrollments_validate_person() set search_path = public;
alter function public.bank_statement_lines_validate_match() set search_path = public;
alter function public.bug_reports_set_updated_at() set search_path = public;
alter function public.comment_mentions_freeze_immutable() set search_path = public;
alter function public.comments_freeze_immutable() set search_path = public;
alter function public.comments_validate_entity() set search_path = public;
alter function public.dispatch_orders_status_transition_guard() set search_path = public;
alter function public.documents_validate_entity() set search_path = public;
alter function public.fiscal_book_entries_immutable() set search_path = public;
alter function public.fiscal_books_guard() set search_path = public;
alter function public.fixed_asset_depreciation_validate_entry() set search_path = public;
alter function public.journal_entries_validate_closing() set search_path = public;
alter function public.journal_lines_validate_closing() set search_path = public;
alter function public.kommo_discard_stale_update() set search_path = public;
alter function public.legal_acceptances_immutable() set search_path = public;
alter function public.legal_acceptances_validate_client() set search_path = public;
alter function public.news_posts_touch_updated_at() set search_path = public;
alter function public.partner_finance_validate_refs() set search_path = public;
alter function public.partner_statement_line_validate_refs() set search_path = public;
alter function public.partner_statement_validate_refs() set search_path = public;
alter function public.prealerta_service_request_guard() set search_path = public;
alter function public.prealertas_validate_sales_order() set search_path = public;
alter function public.prealertas_validate_supplier() set search_path = public;
alter function public.qr_print_orders_status_guard() set search_path = public;
alter function public.referrals_validate_clients() set search_path = public;
alter function public.rendition_receipts_validate() set search_path = public;
alter function public.renditions_immutable() set search_path = public;
alter function public.renditions_sync_voided() set search_path = public;
alter function public.seo_drafts_touch_updated_at() set search_path = public;
alter function public.shipment_costs_validate_shipment() set search_path = public;
alter function public.supplier_credit_note_validate_refs() set search_path = public;
alter function public.tg_back_set_updated_at() set search_path = public;
alter function public.validate_operario_pin_format(p_pin text) set search_path = public;
$sdd0118_pin_search_path_target$
]
where version = '20260703235255'
  and name = '0210_pin_search_path_triggers'
  and (
    statements is null
    or (
      cardinality(statements) = 33
      and md5(array_to_string(statements, E'\n')) = '442a34163980f1fc26bf6f930347b8a1'
    )
  );

do $sdd0118_pin_search_path_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703235255'
      and name = '0210_pin_search_path_triggers'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c3131d8ea3756049d6455bc98b4d0ecc'
  ) then
    raise exception 'SDD-0118 pin_search_path: postcondición falló en 20260703235255 0210_pin_search_path_triggers';
  end if;
end
$sdd0118_pin_search_path_postflight$;
$sdd0118_pin_split_patched_0275$
]
where version = '20260729152036'
  and name = '0275_restore_pin_search_path_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'a217fa825ff964f2c2a4cb26d31c3dbc'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '274402248472f4f666801aa8130b0c47'
    )
  );

do $sdd0118_pin_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729152036'
      and name = '0275_restore_pin_search_path_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'cad36533b4225b674f1d8fd7b8c165ea'
  ) then
    raise exception '0284 abortada: 0275 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_pin_split_postconditions$;

$sdd0118_replay_gate_4$
]
where version = '20260730160209'
  and name = '0284_repair_pin_search_path_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'ca7f9d149eeb6eff924cb6d813094fef'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '6b62b8b4eb08cce4a7cdf7f848f3857a'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_5$-- SDD-0118 · hacer replay-safe el restaurador histórico de revoke_anon.
-- Sólo sustituye el payload de 0276 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_revoke_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('784f95726bd9c6f21963722f1ce7e61d', '66df90af092b02ae8c0a87f5e2bc08e0')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
        )
      )
  ) then
    raise exception '0285 abortada: ledger 0276 ausente, ambiguo o con drift';
  end if;
end
$sdd0118_revoke_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_split_patched_0276$-- SDD-0118 · restaurar el payload reproducible del sweep ACL de RPCs.
-- Sólo reemplaza el estado NULL o el split exacto de R16; no ejecuta los REVOKE/GRANT almacenados.
-- 0285 conserva fail-closed cualquier representación no reconocida.

do $sdd0118_revoke_anon_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        statements is null
        or (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 101
          and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
        )
      )
  ) then
    raise exception 'SDD-0118 revoke_anon: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_revoke_anon_target$-- 0209 — Sweep de seguridad: revoke EXECUTE de anon/PUBLIC en RPCs SECURITY DEFINER
--
-- Contexto: `create function` en Postgres otorga EXECUTE a PUBLIC por default.
-- Varias migraciones que recrearon funciones (`drop` + `create or replace`)
-- re-abrieron ese grant, dejando 57 funciones SECURITY DEFINER ejecutables por
-- `anon` vía /rest/v1/rpc/* (flag `anon_security_definer_function_executable`
-- del advisor de Supabase, 2026-07-03).
--
-- Este sweep cubre las 48 que NO son públicas intencionales:
--   - revoke execute from public, anon  → anon pierde la superficie
--   - grant execute to authenticated, service_role → cero regresión para los
--     callers legítimos (Studio/portal con cliente de usuario + server actions
--     y API routes con cliente admin).
--
-- Allowlist EXCLUIDA del sweep (diseñadas para anon, consumidas por
-- lib/public/* con getAnonClient() — calculadora, track, servicios — y
-- /verificar):
--   public_calculator_cities · public_calculator_config · public_cbm_rate
--   public_fcl_rates · public_ocean_rate · public_service_faqs
--   public_servicios · public_track_shipment · academy_verify_diploma
--
-- Verificación previa de riesgo (2026-07-03): las 4 más sensibles tienen guard
-- interno (get_user_tenant_id() / membresía user_tenants / operario_pins), y
-- ninguna superficie pre-auth del código llama RPCs de esta lista con cliente
-- anon. Regla permanente: toda migración nueva que cree funciones debe hacer
-- `revoke ... from public, anon` + grant explícito (memoria del repo).

revoke execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) from public, anon;
grant execute on function public.add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text, p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text, p_version_note text) to authenticated, service_role;
revoke execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) from public, anon;
grant execute on function public.charge_in_tenant(p_charge uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.comment_entity_in_tenant(p_entity_type text, p_entity_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.comment_mentions_validate() from public, anon;
grant execute on function public.comment_mentions_validate() to authenticated, service_role;
revoke execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) from public, anon;
grant execute on function public.container_in_tenant(p_container uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) from public, anon;
grant execute on function public.create_receipt_as_operario(p_operario_id uuid, p_warehouse_id uuid, p_is_orphan boolean, p_client_markbox text, p_client_name text, p_orphan_marks text, p_orphan_brought_by text, p_supplier_name text, p_supplier_translated text, p_boxes integer, p_total_cbm numeric, p_total_weight_kg numeric, p_received_at date, p_notes text, p_items jsonb, p_incident boolean, p_incident_note text, p_destination_city text) to authenticated, service_role;
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.get_portal_client_tenant() from public, anon;
grant execute on function public.get_portal_client_tenant() to authenticated, service_role;
revoke execute on function public.has_any_back_role() from public, anon;
grant execute on function public.has_any_back_role() to authenticated, service_role;
revoke execute on function public.has_back_role(check_role back_role) from public, anon;
grant execute on function public.has_back_role(check_role back_role) to authenticated, service_role;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
revoke execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) from public, anon;
grant execute on function public.ledger_entry_in_tenant(p_entry uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.legal_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) from public, anon;
grant execute on function public.mail_check_blacklist(p_tenant_id uuid, p_email text) to authenticated, service_role;
revoke execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) from public, anon;
grant execute on function public.mail_increment_template_metrics(p_template_id uuid, p_field text, p_amount integer) to authenticated, service_role;
revoke execute on function public.next_acceptance_code(p_tenant uuid) from public, anon;
grant execute on function public.next_acceptance_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_bill_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bill_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_booking_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_booking_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_bug_folio(p_tenant_id uuid) from public, anon;
grant execute on function public.next_bug_folio(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_consolidation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_consolidation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_conversation_ref(p_tenant_id uuid) from public, anon;
grant execute on function public.next_conversation_ref(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_dispatch_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_dispatch_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_entry_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_entry_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_estimate_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_estimate_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_expense_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_expense_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_invoice_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_invoice_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) from public, anon;
grant execute on function public.next_order_seq(p_client_markbox text, p_supplier_id uuid) to authenticated, service_role;
revoke execute on function public.next_partner_ledger_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_partner_ledger_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_payment_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_payment_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_qr_order_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_qr_order_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_receipt_ve_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_receipt_ve_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_referral_code(p_tenant uuid) from public, anon;
grant execute on function public.next_referral_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_rendition_code(p_tenant uuid) from public, anon;
grant execute on function public.next_rendition_code(p_tenant uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_code(p_tenant_id uuid) from public, anon;
grant execute on function public.next_supplier_code(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.next_supplier_seq(p_client_markbox text) from public, anon;
grant execute on function public.next_supplier_seq(p_client_markbox text) to authenticated, service_role;
revoke execute on function public.portal_approve_client(p_client_id uuid) from public, anon;
grant execute on function public.portal_approve_client(p_client_id uuid) to authenticated, service_role;
revoke execute on function public.portal_post_message(p_body text) from public, anon;
grant execute on function public.portal_post_message(p_body text) to authenticated, service_role;
revoke execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) from public, anon;
grant execute on function public.prealerta_supplier_in_tenant(p_supplier_id uuid, p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) from public, anon;
grant execute on function public.referral_client_in_tenant(p_client uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) from public, anon;
grant execute on function public.rendition_receipt_in_tenant(p_receipt uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
revoke execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) from public, anon;
grant execute on function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid) to authenticated, service_role;
revoke execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) from public, anon;
grant execute on function public.shipment_in_tenant(p_shipment uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) from public, anon;
grant execute on function public.statement_in_tenant(p_statement uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) from public, anon;
grant execute on function public.supplier_in_tenant(p_supplier uuid, p_tenant uuid) to authenticated, service_role;
revoke execute on function public.update_user_tenants_last_login() from public, anon;
grant execute on function public.update_user_tenants_last_login() to authenticated, service_role;
revoke execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) from public, anon;
grant execute on function public.upsert_dispatch_rules(p_tenant_id uuid, p_payload jsonb) to authenticated, service_role;
$sdd0118_revoke_anon_target$
]
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and (
    statements is null
    or (
      cardinality(statements) = 101
      and md5(array_to_string(statements, E'\n')) = 'fb8e6a5e43f4abff8e1b69582e36eadb'
    )
  );

do $sdd0118_revoke_anon_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 revoke_anon: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_revoke_anon_postflight$;
$sdd0118_revoke_split_patched_0276$
]
where version = '20260729163005'
  and name = '0276_restore_revoke_anon_rpc_sweep_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '784f95726bd9c6f21963722f1ce7e61d'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '08a15b51481cff3f5c62ebdd3df96fca'
    )
  );

do $sdd0118_revoke_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729163005'
      and name = '0276_restore_revoke_anon_rpc_sweep_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '66df90af092b02ae8c0a87f5e2bc08e0'
  ) then
    raise exception '0285 abortada: 0276 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0118_revoke_split_postconditions$;

$sdd0118_replay_gate_5$
]
where version = '20260730160939'
  and name = '0285_repair_revoke_anon_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = 'db953b1adc8f6dcad4bd040b59c461d7'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = 'e7ef637390bc02fcbda73db1117581bb'
    )
  );

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_replay_gate_6$-- SDD-0172 · hacer replay-safe el restaurador histórico del ACL tenant.
-- Sólo sustituye el payload de 0279 en el ledger; no ejecuta DDL ni DML de negocio.

do $sdd0172_tenant_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) in ('5251a9ca8ccbf579c5b81688e63acb01', 'd67b2e81a67028e56bd994f47ce16f6d')
        )
        or (
          cardinality(statements) = 3
          and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
        )
      )
  ) then
    raise exception '0286 abortada: ledger 0279 ausente, ambiguo o con drift';
  end if;
end
$sdd0172_tenant_split_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_split_patched_0279$-- SDD-0172 · hacer reproducible el preflight histórico de 0268.
-- Sólo repara el estado canónico o el split exacto de R17; no ejecuta DDL.
-- 0286 conserva fail-closed cualquier representación no reconocida.

do $sdd0172_tenant_acl_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
          and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
        )
        or (
          cardinality(statements) = 10
          and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
        )
      )
  ) then
    raise exception
      '0279 abortada: ledger 0268 ausente, ambiguo o con payload inesperado';
  end if;
end
$sdd0172_tenant_acl_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0172_tenant_acl_revoke$revoke delete on table public.tenants from public, anon, authenticated;$sdd0172_tenant_acl_revoke$,
  $sdd0172_tenant_acl_canonical_0268$-- ─────────────────────────────────────────────────────────────
-- 0268 · SDD-0172 · Guardrails de lifecycle tenant/fixtures
--
-- Alcance:
--   1. impedir que borrar un tenant elimine transitivamente auditoría;
--   2. retirar DELETE ordinario de service_role sobre public.tenants.
--
-- Deliberadamente NO:
--   · crea una función de purga;
--   · cambia las otras FK hacia tenants;
--   · implementa suspensión/archivo;
--   · abre los Cortes C, D o E de SDD-0166.
--
-- REVISIÓN LOCAL SOLAMENTE. NO AUTORIZADA PARA CLOUD.
-- ─────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0268 requiere tenants y entity_audit_log';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
      and convalidated
  ) then
    raise exception '0268 requiere la FK audit de tenant validada y CASCADE';
  end if;

  if to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
  ) is null then
    raise exception '0268 requiere el writer de 0267';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE')
     or not has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: ACL service_role de tenants no coincide';
  end if;

  if has_table_privilege('anon', 'public.tenants', 'DELETE')
     or has_table_privilege('authenticated', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: un rol cliente puede borrar tenants';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: existe una policy DELETE sobre tenants';
  end if;

  if exists (
    select 1
    from public.tenants
    where id = '01680000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception '0268 abortado: el tenant fixture SDD-0168 sigue presente';
  end if;
end
$preflight$;

alter table public.entity_audit_log
  drop constraint entity_audit_log_tenant_id_fkey,
  add constraint entity_audit_log_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete restrict
    not valid;

alter table public.entity_audit_log
  validate constraint entity_audit_log_tenant_id_fkey;

revoke delete on table public.tenants from service_role;

do $postconditions$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entity_audit_log'::regclass
      and confrelid = 'public.tenants'::regclass
      and conname = 'entity_audit_log_tenant_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
      and convalidated
  ) then
    raise exception '0268 abortado: FK audit no quedó RESTRICT y validada';
  end if;

  if has_table_privilege('service_role', 'public.tenants', 'DELETE') then
    raise exception '0268 abortado: service_role conserva DELETE en tenants';
  end if;

  if not has_table_privilege('service_role', 'public.tenants', 'SELECT')
     or not has_table_privilege('service_role', 'public.tenants', 'INSERT')
     or not has_table_privilege('service_role', 'public.tenants', 'UPDATE') then
    raise exception '0268 abortado: se retiró un privilegio fuera de alcance';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and cmd = 'DELETE'
  ) then
    raise exception '0268 abortado: apareció una policy DELETE';
  end if;
end
$postconditions$;

reset statement_timeout;
reset lock_timeout;
$sdd0172_tenant_acl_canonical_0268$
]
where version = '20260729053713'
  and name = '0268_tenant_lifecycle_guardrails'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '127a11d4eac9106d621a537b1886c6c3'
    )
    or (
      cardinality(statements) = 10
      and md5(array_to_string(statements, E'\n')) = 'f21fd3848c7a52b0c12c0c215da86c31'
    )
  );

do $sdd0172_tenant_acl_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729053713'
      and name = '0268_tenant_lifecycle_guardrails'
      and cardinality(statements) = 2
      and md5(statements[1]) = '6f6ddc2074c8f8c527fa6150ff8616c5'
      and md5(statements[2]) = '127a11d4eac9106d621a537b1886c6c3'
  ) then
    raise exception '0279 abortada: 0268 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_acl_postconditions$;
$sdd0172_tenant_split_patched_0279$ || chr(13) || chr(10)
]
where version = '20260729224850'
  and name = '0279_restore_tenant_lifecycle_acl_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5251a9ca8ccbf579c5b81688e63acb01'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '11c2a3aabeb58020c4c3f5847f556594'
    )
  );

do $sdd0172_tenant_split_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729224850'
      and name = '0279_restore_tenant_lifecycle_acl_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd67b2e81a67028e56bd994f47ce16f6d'
  ) then
    raise exception '0286 abortada: 0279 no quedó en el estado objetivo exacto';
  end if;
end
$sdd0172_tenant_split_postconditions$;

$sdd0118_replay_gate_6$
]
where version = '20260730161446'
  and name = '0286_repair_tenant_acl_split_history'
  and (
    (
      cardinality(statements) = 1
      and md5(statements[1]) = '5d42c84f8fb245ea9514ee80cab24a39'
    )
    or (
      cardinality(statements) = 3
      and md5(array_to_string(statements, E'\n')) = '8cc6e74326c8780d2002233d3e4cc989'
    )
  );

do $sdd0118_replay_gates_postconditions$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730002206'
      and name = '0280_repair_sdd0118_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '42542bfd279507a4a89c87c54a6c619b'
  ) then
    raise exception '0287 abortada: 0280_repair_sdd0118_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730011643'
      and name = '0281_repair_invite_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '19eb51d4802a0af27a12bf634fa2543d'
  ) then
    raise exception '0287 abortada: 0281_repair_invite_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730130403'
      and name = '0282_repair_platform_admin_skip_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '6185c626816290531c5e287a25db1a95'
  ) then
    raise exception '0287 abortada: 0282_repair_platform_admin_skip_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730132651'
      and name = '0283_repair_calculator_settings_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '8dd851b83f33abc1417d82d0d61c208c'
  ) then
    raise exception '0287 abortada: 0283_repair_calculator_settings_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160209'
      and name = '0284_repair_pin_search_path_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'd2f3bc6fac74a836c96be81c40c2bcce'
  ) then
    raise exception '0287 abortada: 0284_repair_pin_search_path_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730160939'
      and name = '0285_repair_revoke_anon_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = '0d656e4a3a856160d1323c49b60baa70'
  ) then
    raise exception '0287 abortada: 0285_repair_revoke_anon_split_history no quedó en el estado objetivo';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260730161446'
      and name = '0286_repair_tenant_acl_split_history'
      and cardinality(statements) = 1
      and md5(statements[1]) = 'fbf9cbd3180f161a4a0462fee2c3fea8'
  ) then
    raise exception '0287 abortada: 0286_repair_tenant_acl_split_history no quedó en el estado objetivo';
  end if;
end
$sdd0118_replay_gates_postconditions$;

$sdd0118_finalizer_expected_0287$ then
    raise exception 'TEST 0288: payload 0287 no es byte-idéntico al esperado';
  end if;
end
$finalizer_contract$;

rollback;

select to_regnamespace('supabase_migrations') is null
  as sdd_0118_replay_finalizer_fixture_rolled_back;
