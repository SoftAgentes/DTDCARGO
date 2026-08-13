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
  /** 1 = bandeja de entrada. Kommo NO deja mover un lead hacia ahi por API. */
  type: number | null;
};

/** Definición de un custom field del espejo (para el dropdown de config). */
export type KommoCustomFieldRow = {
  id: number;
  name: string | null;
  type: string | null;
  code: string | null;
};

/** Usuario (asesor) del espejo Kommo — id → nombre para el tablero (SDD-0087). */
export type KommoUserRow = {
  id: number;
  name: string | null;
  email: string | null;
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

// ── Destinos del ENRUTADOR (SDD-0244 · cliente que vuelve) ──────
/**
 * Destinos que NO nacen de una transición del estimado: los usa el enrutador del
 * webhook `leads[add]` para mandar a Recontacto al cliente que vuelve a escribir.
 *
 * Viven en el MISMO `kommo_connections.stage_map`, pero la pantalla del mapa de
 * etapas no los edita. Por eso `saveKommoStageMapAction` los preserva
 * explícitamente: sin eso, guardar el mapa desde el Studio los borraba en
 * silencio y el enrutador quedaba inerte sin un solo error.
 */
export type RouterStageKey = "recontacto";

export const ROUTER_STAGE_KEYS: readonly RouterStageKey[] = ["recontacto"] as const;

/** Todas las claves que pueden vivir en `stage_map`. */
export type StageMapKey = EstimateStageKey | RouterStageKey;

export const STAGE_MAP_KEYS: readonly StageMapKey[] = [
  ...ESTIMATE_STAGE_KEYS,
  ...ROUTER_STAGE_KEYS,
] as const;

/** Destino en Kommo: embudo (pipeline) + etapa (status). */
export type KommoStageTarget = { pipeline_id: number; status_id: number };

/** Mapa parcial clave→destino (solo las claves que el founder configuró). */
export type KommoStageMap = Partial<Record<StageMapKey, KommoStageTarget>>;
