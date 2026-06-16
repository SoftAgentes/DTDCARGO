/**
 * Runtime engine del motor de flujo interno (SDD-0091 Slice 1).
 *
 * Punto de entrada `fireWorkflowEvent()` — GEMELO best-effort de `fireMailEvent()`
 * (lib/studio/mail/mail-rule-engine.ts): lo llaman las server actions al lado de sus
 * `fireMailEvent` cuando ocurre un evento (la pista de oferta dispara 'oferta_aceptada').
 *
 * Slice 1 = SOLO TRAZA: por cada paso activo del evento crea idempotentemente una fila
 * en `workflow_step_runs` con el estado inicial que decide `planStepRun()`
 * (pending = lo correrá el drain; awaiting_human = a la bandeja de compuerta). NO ejecuta
 * todavía los efectos (mail/push/doc) — esa es la Slice 2 (drain). Best-effort: cualquier
 * error se loggea pero NO se propaga (el caller nunca se rompe).
 *
 * Idempotencia: el upsert usa el unique (step_id, source_kind, source_id) → reintentar el
 * mismo evento sobre la misma fuente NO duplica corridas ni pisa el estado ya avanzado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { selectStepsForEvent } from "./queries";
import { planStepRun, type ServiceWorkflowStep } from "./types";

export interface FireWorkflowEventInput {
  /** Evento (WORKFLOW_EVENTS). Texto para no acoplar al enum. */
  event: string;
  /** Entidad que origina la corrida (idempotencia + traza). */
  sourceKind: string;
  sourceId: string;
  /** Servicio para filtrar pasos; null = solo el backbone (pasos service_key NULL). */
  serviceKey?: string | null;
}

export type WorkflowRunRow = {
  tenant_id: string;
  step_id: string;
  source_kind: string;
  source_id: string;
  status: ReturnType<typeof planStepRun>;
};

/**
 * Construye las filas de traza (una por paso) con su estado inicial. PURO → testeable.
 * El estado lo decide `planStepRun` (pending vs awaiting_human).
 */
export function buildRunRows(
  steps: ServiceWorkflowStep[],
  tenantId: string,
  input: Pick<FireWorkflowEventInput, "sourceKind" | "sourceId">,
): WorkflowRunRow[] {
  return steps.map((step) => ({
    tenant_id: tenantId,
    step_id: step.id,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    status: planStepRun(step),
  }));
}

export async function fireWorkflowEvent(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: FireWorkflowEventInput,
): Promise<void> {
  try {
    const steps = await selectStepsForEvent(
      supabaseAdmin,
      tenantId,
      input.event,
      input.serviceKey ?? null,
    );
    if (steps.length === 0) return;

    // Una fila de traza por paso. Idempotente por el unique (step_id, source_kind, source_id);
    // ignoreDuplicates = no pisa una corrida ya creada/avanzada por un reintento del evento.
    const rows = buildRunRows(steps, tenantId, input);

    const { error } = await supabaseAdmin
      .from("workflow_step_runs")
      .upsert(rows, {
        onConflict: "step_id, source_kind, source_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(
        `[workflow-rule-engine] upsert runs failed (${input.event}):`,
        error.message,
      );
    }
  } catch (err) {
    console.error(
      `[workflow-rule-engine] fireWorkflowEvent error (${input.event}):`,
      err,
    );
  }
}
