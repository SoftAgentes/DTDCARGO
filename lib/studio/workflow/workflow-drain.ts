/**
 * Drain del motor de flujo (SDD-0091 Slice 2) — ejecuta las corridas `pending`.
 *
 * Gemelo de `drainOperarioPushOutbox` (lib/studio/notify/operario-push-outbox.ts): lo
 * corre el cron `/api/cron/workflow-drain` (+ best-effort tras encolar, futuro). Procesa
 * las corridas en `pending` (las que `planStepRun` dejó listas para correr solas).
 *
 * Ejecutor de Slice 2 = SOLO el camino seguro y sin infra nueva: los pasos internos
 * `recordatorio_interno` / `crear_tarea` se materializan como una **nota de timeline**
 * (comentario SDD-0045) en la entidad fuente — exactamente lo que el diseño manda
 * (crear_tarea → comments). El resto de los pasos (avanzar_estado / montar_documento /
 * ejecutar_ia) se DIFIEREN a `awaiting_human` (su ejecutor llega en slices futuros, varios
 * gated en `ANTHROPIC_API_KEY` o en la matriz rol→persona). Nada que escriba a cliente,
 * dinero o tercero corre acá (esos nodos nunca llegan a `pending`: la REGLA DURA los frena).
 *
 * Toda la decisión vive en `planDrainAction()` (PURO, testeable); el drain solo aplica.
 * Best-effort por corrida: un fallo marca esa corrida `failed` y sigue con la siguiente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMMENT_ENTITY_TYPES,
  type CommentEntityType,
} from "@/lib/studio/comments/types";
import type { WorkflowNodeKind } from "./types";

/** Nodos internos que Slice 2 materializa como nota de timeline. */
const NOTE_NODE_KINDS: WorkflowNodeKind[] = [
  "recordatorio_interno",
  "crear_tarea",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isCommentEntity = (k: string): k is CommentEntityType =>
  (COMMENT_ENTITY_TYPES as string[]).includes(k);

/** Cuerpo de la nota interna. Sin emojis decorativos (regla de marca); prefijo claro. */
export function buildNoteBody(run: Pick<DrainRun, "nombre" | "owner_role">): string {
  const owner = run.owner_role ? ` · dueño: ${run.owner_role}` : "";
  return `[Flujo] ${run.nombre}${owner}`;
}

export type DrainRun = {
  id: string;
  tenant_id: string;
  source_kind: string;
  source_id: string;
  node_kind: WorkflowNodeKind;
  nombre: string;
  owner_role: string | null;
};

export type DrainPlan =
  | {
      action: "note";
      comment: {
        tenant_id: string;
        entity_type: CommentEntityType;
        entity_id: string;
        author_id: null;
        body: string;
      };
    }
  | { action: "defer"; note: string };

/**
 * Decide qué hacer con una corrida (PURO). Nota si es un paso interno note-able sobre una
 * entidad comentable con id uuid válido; si no, se DIFIERE a la bandeja humana.
 */
export function planDrainAction(run: DrainRun): DrainPlan {
  const noteable = NOTE_NODE_KINDS.includes(run.node_kind);
  if (noteable && isCommentEntity(run.source_kind) && UUID_RE.test(run.source_id)) {
    return {
      action: "note",
      comment: {
        tenant_id: run.tenant_id,
        entity_type: run.source_kind,
        entity_id: run.source_id,
        author_id: null, // nota de sistema (author_id nullable en 0090)
        body: buildNoteBody(run),
      },
    };
  }
  const motivo = noteable
    ? "sin entidad comentable" // note-able pero la fuente no es comentable
    : "ejecutor pendiente (slice futuro)";
  return { action: "defer", note: `Pendiente de acción humana: ${motivo}.` };
}

export type DrainResult = {
  processed: number;
  noted: number;
  deferred: number;
  failed: number;
};

type RawDrainRow = {
  id: string;
  tenant_id: string;
  source_kind: string;
  source_id: string;
  step:
    | { node_kind: string; nombre: string; owner_role: string | null }
    | { node_kind: string; nombre: string; owner_role: string | null }[]
    | null;
};

/**
 * Drena las corridas `pending` (cross-tenant, admin client). Best-effort por corrida.
 * `limit` acota el lote (el cron lo llama en bucle si hace falta — V2).
 */
export async function drainWorkflowRuns(
  supabaseAdmin: SupabaseClient,
  limit = 100,
): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, noted: 0, deferred: 0, failed: 0 };

  const { data, error } = await supabaseAdmin
    .from("workflow_step_runs")
    .select(
      "id, tenant_id, source_kind, source_id, step:service_workflow_steps!inner(node_kind, nombre, owner_role)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[workflow-drain] read pending failed:", error.message);
    return result;
  }

  for (const row of (data ?? []) as RawDrainRow[]) {
    const stepRaw = Array.isArray(row.step) ? row.step[0] : row.step;
    if (!stepRaw) continue;
    const run: DrainRun = {
      id: row.id,
      tenant_id: row.tenant_id,
      source_kind: row.source_kind,
      source_id: row.source_id,
      node_kind: stepRaw.node_kind as WorkflowNodeKind,
      nombre: stepRaw.nombre,
      owner_role: stepRaw.owner_role,
    };
    result.processed += 1;

    try {
      const plan = planDrainAction(run);
      if (plan.action === "note") {
        const { error: insErr } = await supabaseAdmin
          .from("comments")
          .insert(plan.comment);
        if (insErr) throw new Error(insErr.message);
        await markRun(supabaseAdmin, run.id, "done", "Nota de flujo creada.");
        result.noted += 1;
      } else {
        await markRun(supabaseAdmin, run.id, "awaiting_human", plan.note);
        result.deferred += 1;
      }
    } catch (e) {
      result.failed += 1;
      await markRun(
        supabaseAdmin,
        run.id,
        "failed",
        e instanceof Error ? e.message : String(e),
      ).catch(() => {});
    }
  }

  return result;
}

async function markRun(
  supabaseAdmin: SupabaseClient,
  id: string,
  status: "done" | "awaiting_human" | "failed",
  note: string,
): Promise<void> {
  await supabaseAdmin
    .from("workflow_step_runs")
    .update({
      status,
      result_note: note,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
}
