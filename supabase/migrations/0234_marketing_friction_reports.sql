-- ─────────────────────────────────────────────────────────────
-- SDD-0119 Slice 1 · Módulo Marketing — "Reportar fricción"
--
-- Principio rector de la spec (§Contexto): lo que a Fiorella (o a quien tenga
-- acceso al módulo de marketing) le quita tiempo o no le gusta hacer, se
-- reporta acá → cola de automatización que Sam revisa y prioriza con IA en
-- el ERP.
--
-- Alcance CERRADO del Slice 1 (sin deps externas, sin Notion, sin motor de
-- flujo): una tabla simple + RLS por rol/módulo. El ruteo real a tareas de
-- Bitácora / motores de automatización queda para un slice posterior.
--
-- RBAC — espejo de lib/studio/rbac.ts:
--   ROLE_MODULE_ACCESS.marketing = ["marketing", "commercial", "support"]
--   canEditModule() excluye 'support' (read-only V1) salvo admin.
-- Por eso: CREAR → admin/marketing/commercial. LEER (bandeja del tenant) →
-- admin/marketing/commercial/support. Cambiar `status` → SOLO admin.
--
-- Sin DDL destructivo. NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

create table public.marketing_friction_reports (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  reporter_user_id  uuid not null references auth.users(id) on delete cascade,
  title             text not null
                      check (length(trim(title)) > 0 and length(title) <= 140),
  description       text not null
                      check (length(trim(description)) > 0 and length(description) <= 2000),
  status            text not null default 'open'
                      check (status in ('open', 'triaged', 'resolved')),
  resolved_at       timestamptz,
  resolved_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.marketing_friction_reports is
  'SDD-0119 Slice 1: bandeja "Reportar fricción" del módulo Marketing. Cola de automatización — lo que le quita tiempo al área se reporta acá y Sam lo prioriza. Solo admin cambia status.';

create index marketing_friction_reports_tenant_status_idx
  on public.marketing_friction_reports (tenant_id, status, created_at desc);

create index marketing_friction_reports_reporter_idx
  on public.marketing_friction_reports (reporter_user_id, created_at desc);

-- Toca updated_at en cada UPDATE (función compartida del Studio, ver 0002/0012).
drop trigger if exists marketing_friction_reports_touch on public.marketing_friction_reports;
create trigger marketing_friction_reports_touch
  before update on public.marketing_friction_reports
  for each row execute function public.touch_updated_at();

-- GRANT antes que policy (convención del repo).
grant select, insert on public.marketing_friction_reports to authenticated;
grant update         on public.marketing_friction_reports to authenticated; -- RLS acota a admin
grant all             on public.marketing_friction_reports to service_role;

alter table public.marketing_friction_reports enable row level security;

-- SELECT: cualquier rol con acceso de VISTA al módulo marketing, dentro de su
-- propio tenant (espejo de canAccessModule(role, "marketing")).
create policy "marketing_friction_reports_module_select"
  on public.marketing_friction_reports for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = marketing_friction_reports.tenant_id
        and ut.disabled_at is null
        and ut.role in ('admin', 'marketing', 'commercial', 'support')
    )
  );

-- INSERT: el reporter es el caller, mismo tenant, status siempre nace 'open'
-- (nadie se auto-resuelve), y su rol puede EDITAR el módulo (admin/marketing/
-- commercial — 'support' es read-only V1, espejo de canEditModule).
create policy "marketing_friction_reports_module_insert"
  on public.marketing_friction_reports for insert
  to authenticated
  with check (
    reporter_user_id = (select auth.uid())
    and status = 'open'
    and tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = marketing_friction_reports.tenant_id
        and ut.disabled_at is null
        and ut.role in ('admin', 'marketing', 'commercial')
    )
  );

-- UPDATE: solo admin del tenant (cambia status → triaged/resolved). La
-- Server Action además backstop-ea con moduleEditDenial + chequeo de rol.
create policy "marketing_friction_reports_admin_update"
  on public.marketing_friction_reports for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = marketing_friction_reports.tenant_id
        and ut.disabled_at is null
        and ut.role = 'admin'
    )
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );

-- DELETE: bloqueado — es un log de fricción, no se borra (soft via status).
create policy "marketing_friction_reports_no_delete"
  on public.marketing_friction_reports for delete
  using (false);
