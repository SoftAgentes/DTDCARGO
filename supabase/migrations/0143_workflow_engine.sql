-- ─────────────────────────────────────────────────────────────
-- 0143 · SDD-0091 · Motor de flujo interno por servicio (Slice 1)
--
-- Implementa la fundación del motor N8N-lite de SDD-0076 FASE-FUTURA. Dos tablas,
-- gemelas del patrón mail_rules / mail_logs ya probado en prod (SDD-0026):
--   · service_workflow_steps — la DEFINICIÓN (lo que el founder configura), gemela de mail_rules.
--   · workflow_step_runs      — la TRAZA/ejecución, gemela de mail_logs. Idempotente por
--                               unique (step_id, source_kind, source_id) = patrón del outbox de push.
--
-- 100% ERP-side: ambas `revoke all … from anon`; la whitelist pública (public_servicios) nunca las ve.
-- Convención del repo: enums lógicos = text + CHECK (como charge_moment en 0130 / charge_mode en 0142),
-- NO pg enums. trigger_event = text validado por all-list en código (WORKFLOW_EVENTS).
--
-- owner_role reusa los 6 StudioUserRole (SDD-0024/0085). node_kind = 10 nodos. automation_level = 4 niveles.
-- REGLA DURA (gated ≠ automatico) vive en validateWorkflowStepInput() (app), NO en el schema (un CHECK
-- cruzado node_kind×automation_level sería frágil; el candado es server-side + tests).
--
-- Idempotente (create if not exists). NO aplicar a prod desde la rama — la aplica coordinación.
-- Skills Supabase (seguridad + postgres-best-practices) invocados antes de tocar schema.
-- ─────────────────────────────────────────────────────────────

-- ── 1) service_workflow_steps (definición) ───────────────────
create table if not exists public.service_workflow_steps (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  service_key       text,                          -- NULL = backbone (aplica a todos los núcleo)
  momento           text,                          -- momentoTimeline (origen/recepcion_bodega/…)
  orden             integer not null default 0,
  nombre            text not null,
  node_kind         text not null,
  owner_role        text,                          -- StudioUserRole (6); NULL = sin dueño asignado
  automation_level  text not null default 'manual',
  trigger_event     text,                          -- evento que dispara el paso (WORKFLOW_EVENTS)
  ai_skill_slug     text,                          -- solo node_kind='ejecutar_ia'
  template_ref      text,                          -- mail/doc template
  channel           text,                          -- email|whatsapp (para enviar_*)
  sla_hours         integer,
  depends_on        text[] not null default '{}',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users(id),
  deleted_at        timestamptz,
  constraint service_workflow_steps_node_kind_chk check (node_kind in (
    'enviar_email','enviar_whatsapp','recordatorio_interno','crear_tarea','avanzar_estado',
    'montar_documento','solicitar_doc_cliente','solicitar_a_tercero','esperar_confirmacion_humana','ejecutar_ia'
  )),
  constraint service_workflow_steps_level_chk check (automation_level in (
    'manual','asistido','auto_con_compuerta','automatico'
  )),
  constraint service_workflow_steps_owner_role_chk check (owner_role is null or owner_role in (
    'admin','commercial','operations','accounting','warehouse','support'
  ))
);

comment on table public.service_workflow_steps is
  'Definición del flujo de trabajo interno por servicio (SDD-0091, gemela de mail_rules). service_key NULL = backbone de todos los núcleo. node_kind/automation_level validados por CHECK; la REGLA DURA (gated ≠ automatico) vive en validateWorkflowStepInput(). 100% ERP-side (revoke anon).';

-- Índice de la query del engine: pasos activos por evento (+ tenant).
create index if not exists idx_workflow_steps_event
  on public.service_workflow_steps (tenant_id, trigger_event)
  where active = true and deleted_at is null;

grant select, insert, update on public.service_workflow_steps to authenticated;
revoke all on public.service_workflow_steps from anon;

alter table public.service_workflow_steps enable row level security;
create policy "service_workflow_steps by tenant" on public.service_workflow_steps for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger service_workflow_steps_touch
  before update on public.service_workflow_steps
  for each row execute function public.touch_updated_at();

-- ── 2) workflow_step_runs (traza) ────────────────────────────
create table if not exists public.workflow_step_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  step_id       uuid not null references public.service_workflow_steps(id) on delete cascade,
  source_kind   text not null,                     -- 'shipment' | 'quote' | 'cliente_anuncio' | …
  source_id     text not null,
  status        text not null default 'pending',
  result_note   text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  completed_by  uuid references auth.users(id),
  constraint workflow_step_runs_status_chk check (status in (
    'pending','awaiting_human','done','skipped','failed'
  )),
  constraint workflow_step_runs_uniq unique (step_id, source_kind, source_id)  -- idempotencia
);

comment on table public.workflow_step_runs is
  'Traza/ejecución de cada paso del motor (SDD-0091, gemela de mail_logs). Idempotente por (step_id, source_kind, source_id). status awaiting_human = compuerta (bandeja). 100% ERP-side (revoke anon).';

create index if not exists idx_workflow_runs_step on public.workflow_step_runs (step_id);
-- Bandeja de compuerta: lo pendiente de humano por tenant.
create index if not exists idx_workflow_runs_inbox
  on public.workflow_step_runs (tenant_id, status)
  where status = 'awaiting_human';

grant select, insert, update on public.workflow_step_runs to authenticated;
revoke all on public.workflow_step_runs from anon;

alter table public.workflow_step_runs enable row level security;
create policy "workflow_step_runs by tenant" on public.workflow_step_runs for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
