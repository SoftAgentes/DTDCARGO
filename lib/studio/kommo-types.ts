/**
 * Tipos read-only del espejo Kommo (pantalla del Studio · SDD-0043).
 *
 * Las tablas kommo_* se llenan vía la Edge Function kommo-sync (Alcance A) y
 * el pull diario de pg_cron (Fase B). Esta pantalla SOLO lee — nunca muta
 * Kommo ni el mirror.
 */

export type KommoPipelineRow = {
  id: number;
  name: string | null;
  sort: number | null;
  is_main: boolean;
};

export type KommoStatusRow = {
  id: number;
  pipeline_id: number;
  name: string | null;
  color: string | null;
  sort: number | null;
};

export type KommoLeadRow = {
  id: number;
  name: string | null;
  status_id: number | null;
  pipeline_id: number | null;
  price: number | null;
  responsible_user_id: number | null;
  kommo_created_at: string | null;
  kommo_updated_at: string | null;
  closed_at: string | null;
};

export type KommoOverview = {
  leads: number;
  contacts: number;
  lastSyncAt: string | null;
  connStatus: string | null;
  subdomain: string | null;
};

// ── Mapa de etapas (SDD-0084 · write-back de etapa) ──────────────
/**
 * Estados del estimado que disparan un `patch_stage`. Coinciden 1:1 con las
 * transiciones de `transitionStatus` (cotizador/actions.ts).
 */
export type EstimateStageKey = "sent" | "accepted" | "rejected";

export const ESTIMATE_STAGE_KEYS: readonly EstimateStageKey[] = [
  "sent",
  "accepted",
  "rejected",
] as const;

/** Etiqueta visible de cada estado-disparador (UI del mapa de etapas). */
export const ESTIMATE_STAGE_LABELS: Record<EstimateStageKey, string> = {
  sent: "Estimado enviado",
  accepted: "Estimado aceptado",
  rejected: "Estimado rechazado",
};

/** Destino en Kommo: embudo (pipeline) + etapa (status). */
export type KommoStageTarget = { pipeline_id: number; status_id: number };

/** Mapa parcial estado→destino (solo los estados que el founder configuró). */
export type KommoStageMap = Partial<Record<EstimateStageKey, KommoStageTarget>>;
