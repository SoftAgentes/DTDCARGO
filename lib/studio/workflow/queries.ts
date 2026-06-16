/**
 * Queries del motor de flujo interno (SDD-0091 Slice 1).
 * Funciones puras `(supabase) => …`. RLS filtra por tenant — el engine usa el admin
 * client y filtra `tenant_id` explícito (mismo patrón que mail-rule-engine).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ServiceWorkflowStep,
  WorkflowStepRun,
  WorkflowNodeKind,
  AutomationLevel,
  WorkflowStepStatus,
} from "./types";

const STEP_COLS =
  "id, service_key, momento, orden, nombre, node_kind, owner_role, automation_level, trigger_event, ai_skill_slug, template_ref, channel, sla_hours, depends_on, active";

type RawStep = {
  id: string;
  service_key: string | null;
  momento: string | null;
  orden: number;
  nombre: string;
  node_kind: string;
  owner_role: string | null;
  automation_level: string;
  trigger_event: string | null;
  ai_skill_slug: string | null;
  template_ref: string | null;
  channel: string | null;
  sla_hours: number | null;
  depends_on: string[] | null;
  active: boolean;
};

function normalizeStep(r: RawStep): ServiceWorkflowStep {
  return {
    id: r.id,
    service_key: r.service_key,
    momento: r.momento,
    orden: r.orden ?? 0,
    nombre: r.nombre,
    node_kind: r.node_kind as WorkflowNodeKind,
    owner_role: r.owner_role as ServiceWorkflowStep["owner_role"],
    automation_level: r.automation_level as AutomationLevel,
    trigger_event: r.trigger_event,
    ai_skill_slug: r.ai_skill_slug,
    template_ref: r.template_ref,
    channel: r.channel,
    sla_hours: r.sla_hours,
    depends_on: r.depends_on ?? [],
    active: !!r.active,
  };
}

/**
 * Pasos activos que disparan con `event`, para el `serviceKey` dado o el backbone
 * (service_key NULL). Ordenados por `orden`. Es la consulta del engine.
 */
export async function selectStepsForEvent(
  supabase: SupabaseClient,
  tenantId: string,
  event: string,
  serviceKey: string | null,
): Promise<ServiceWorkflowStep[]> {
  let q = supabase
    .from("service_workflow_steps")
    .select(STEP_COLS)
    .eq("tenant_id", tenantId)
    .eq("trigger_event", event)
    .eq("active", true)
    .is("deleted_at", null);

  // service_key = X OR NULL (backbone). PostgREST: usar `.or`.
  q = serviceKey
    ? q.or(`service_key.eq.${serviceKey},service_key.is.null`)
    : q.is("service_key", null);

  const { data, error } = await q.order("orden", { ascending: true });
  if (error || !data) return [];
  return (data as RawStep[]).map(normalizeStep);
}

/** Todos los pasos de un servicio (o el backbone), para el editor del Studio (S3). */
export async function listWorkflowSteps(
  supabase: SupabaseClient,
  serviceKey: string | null,
): Promise<ServiceWorkflowStep[]> {
  let q = supabase
    .from("service_workflow_steps")
    .select(STEP_COLS)
    .is("deleted_at", null);
  q = serviceKey
    ? q.eq("service_key", serviceKey)
    : q.is("service_key", null);
  const { data, error } = await q.order("orden", { ascending: true });
  if (error || !data) return [];
  return (data as RawStep[]).map(normalizeStep);
}

/** Bandeja de compuerta: corridas esperando acción humana (S3). */
export async function listAwaitingRuns(
  supabase: SupabaseClient,
): Promise<WorkflowStepRun[]> {
  const { data, error } = await supabase
    .from("workflow_step_runs")
    .select("id, step_id, source_kind, source_id, status, result_note, created_at, completed_at")
    .eq("status", "awaiting_human")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<WorkflowStepRun & { status: string }>).map((r) => ({
    ...r,
    status: r.status as WorkflowStepStatus,
  }));
}
