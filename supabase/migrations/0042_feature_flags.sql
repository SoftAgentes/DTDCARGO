-- ─────────────────────────────────────────────────────────────
-- 0042 · Feature flags per-tenant (Tier 1.2 Brand v1.7)
--
-- Sistema de feature flags portado de Claude Design v1.7
-- (nuevo/feature-flags.jsx). Permite esconder módulos del Studio
-- por tenant sin tocar código.
--
-- Diseño:
--  - 1 row por (tenant, flag_key) · scope per-tenant
--  - Defaults vienen del seed (DO block que inserta por cada tenant
--    existente con los valores del handoff)
--  - RLS: SELECT a authenticated del tenant · UPDATE solo admin
--  - INSERT/DELETE bloqueado por authenticated (gestión via seed +
--    admin client)
--
-- APLICADA IN-PLACE EN PROD via Supabase MCP el 2026-05-27.
-- Este archivo queda para historial + idempotente.
-- ─────────────────────────────────────────────────────────────

create table public.feature_flags (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  key           text not null,
  enabled       boolean not null,
  description   text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null,
  unique (tenant_id, key)
);

comment on table public.feature_flags is
  'Feature flags per-tenant del Studio. Esconden módulos del sidebar + gating de features. Portado de Claude Design v1.7 nuevo/feature-flags.jsx.';

create index feature_flags_tenant_key_idx on public.feature_flags (tenant_id, key);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.feature_flags enable row level security;

create policy "feature_flags_tenant_select"
  on public.feature_flags for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "feature_flags_admin_update"
  on public.feature_flags for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = feature_flags.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );

create policy "feature_flags_no_insert_authenticated"
  on public.feature_flags for insert to authenticated with check (false);

create policy "feature_flags_no_delete_authenticated"
  on public.feature_flags for delete to authenticated using (false);

create policy "service_role_all_feature_flags"
  on public.feature_flags for all to service_role using (true) with check (true);

-- ─── GRANTs ──────────────────────────────────────────────────
grant select, update on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;

-- ─── Seed defaults ───────────────────────────────────────────
-- Valores tomados de FEATURE_FLAG_DEFAULTS en
-- docs/design/studio/v1.7-claude-design/project/nuevo/feature-flags.jsx
-- Por cada tenant existente, inserta los 20 flags con default.
do $$
declare
  v_tenant uuid;
  v_flag record;
begin
  for v_tenant in select id from public.tenants loop
    for v_flag in
      select * from (values
        ('customs_seniat',       false, 'Aduana SENIAT workflow'),
        ('cargo_insurance',      false, 'Seguro de carga'),
        ('hs_autodetect',        true,  'Auto-detección HS code'),
        ('cn_translation',       true,  'Traductor CN'),
        ('ai_copilot',           false, 'AI Copilot conversacional'),
        ('whatsapp',             true,  'Integración WhatsApp Business'),
        ('email_sequences',      false, 'Email sequences automáticas'),
        ('branding_xcliente',    true,  'Branding personalizado por cliente'),
        ('multi_currency',       true,  'Multi-moneda USD/VES/CNY'),
        ('vault',                true,  'No-Olvidar (caja fuerte)'),
        ('audit_log',            true,  'Audit log con drill-down'),
        ('api_public',           false, 'API pública para terceros'),
        ('webhooks',             true,  'Webhooks salientes'),
        ('comments',             true,  'Comments con @menciones'),
        ('consolidation_partial',true,  'Consolidación parcial'),
        ('portal_cliente',       true,  'Portal del cliente externo'),
        ('mobile_operator',      false, 'App móvil operario CN/VE'),
        ('sustainability',       false, 'Reportes de sustentabilidad'),
        ('backup_auto',          true,  'Backup automático'),
        ('sso',                  false, 'Single Sign-On')
      ) as t(key, enabled, description)
    loop
      insert into public.feature_flags (tenant_id, key, enabled, description)
      values (v_tenant, v_flag.key, v_flag.enabled, v_flag.description)
      on conflict (tenant_id, key) do nothing;
    end loop;
  end loop;
end $$;
