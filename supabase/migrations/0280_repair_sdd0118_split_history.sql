-- SDD-0118 · hacer replay-safe el preflight histórico de 0271.
-- Sólo sustituye el payload del ledger; no ejecuta DDL ni DML de negocio.

do $sdd0118_split_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729135053'
      and name = '0271_repair_branch_replay_history'
      and cardinality(statements) = 1
      and md5(statements[1]) in ('0839e50eeb47a158382fc2f6c27d5fe9', 'c7b1f468087e249e2ca44359aa3f686f')
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
  and cardinality(statements) = 1
  and md5(statements[1]) = '0839e50eeb47a158382fc2f6c27d5fe9';

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
