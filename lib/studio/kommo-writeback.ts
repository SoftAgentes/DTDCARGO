/**
 * Write-back ERP→Kommo: lado ENCOLA (SDD-0083 · SDD-0062 Slice A+B).
 *
 * El ERP solo encola en `kommo_writeback_outbox` (vía RPC con admin client). La
 * edge function `kommo-writeback` drena la cola, lee el token de Vault y hace el
 * PATCH a Kommo (dry-run por default). El token NUNCA entra a este runtime
 * (modelo de seguridad SDD-0043). Guardrail 0107: jamás se escribe el espejo.
 *
 * Plano (no carpeta) para matchear los `kommo-*.ts` existentes (queries/types/
 * convert/analytics).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STAGE_MAP_KEYS,
  type EstimateStageKey,
  type KommoStageMap,
  type KommoStageTarget,
} from "./kommo-types";

export type WritebackOp =
  | "patch_price"
  | "patch_stage"
  | "patch_lead"
  | "patch_owner"
  | "patch_tags";

/**
 * Payload del PATCH para reasignar el asesor de un lead. PURO.
 * `null` si el id no es un entero positivo: mejor no encolar que mandarle a
 * Kommo un `responsible_user_id` inválido y que reasigne a nadie.
 */
export function buildOwnerPatchPayload(
  responsibleUserId: number | null | undefined,
): { responsible_user_id: number } | null {
  const n = Number(responsibleUserId);
  if (!Number.isInteger(n) || n <= 0) return null;
  return { responsible_user_id: n };
}

/**
 * Payload del PATCH para etiquetar. PURO.
 *
 * ⭐ Usa `tags_to_add` / `tags_to_delete`, que son INCREMENTALES: agregan y
 * quitan sin tocar el resto. SDD-0244 asumía que había que reemplazar
 * `_embedded.tags` completo, y eso **borraría las etiquetas que puso el asesor
 * a mano** — verificado contra la doc de la API v4.
 *
 * Normaliza: recorta, descarta vacíos, deduplica sin distinguir mayúsculas, y
 * si una etiqueta aparece en las dos listas gana QUITAR (la intención más
 * destructiva es la explícita). `null` si no queda nada que hacer.
 */
export function buildTagsPatchPayload(input: {
  add?: readonly string[];
  remove?: readonly string[];
}): { tags_to_add?: { name: string }[]; tags_to_delete?: { name: string }[] } | null {
  const limpiar = (xs: readonly string[] | undefined): string[] => {
    const vistas = new Set<string>();
    const out: string[] = [];
    for (const raw of xs ?? []) {
      const t = String(raw ?? "").trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (vistas.has(k)) continue;
      vistas.add(k);
      out.push(t);
    }
    return out;
  };

  const quitar = limpiar(input.remove);
  const fuera = new Set(quitar.map((t) => t.toLowerCase()));
  const agregar = limpiar(input.add).filter((t) => !fuera.has(t.toLowerCase()));

  if (agregar.length === 0 && quitar.length === 0) return null;
  const payload: {
    tags_to_add?: { name: string }[];
    tags_to_delete?: { name: string }[];
  } = {};
  if (agregar.length) payload.tags_to_add = agregar.map((name) => ({ name }));
  if (quitar.length) payload.tags_to_delete = quitar.map((name) => ({ name }));
  return payload;
}

/**
 * Payload del PATCH `/api/v4/leads/{id}` para setear el `price` del lead. PURO.
 * Kommo guarda `price` como entero (unidades de la moneda de la cuenta) → se
 * redondea; valores no finitos o ≤0 caen a 0.
 */
export function buildPricePatchPayload(
  totalUsd: number | null | undefined,
): { price: number } {
  const n = Number(totalUsd);
  return { price: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
}

/**
 * Encola un `patch_price` para el lead de Kommo del cliente (resuelto por
 * `client_markbox → clients.kommo_lead_id`). **Best-effort**: devuelve el id de la
 * fila de outbox, o `null` si el cliente no tiene lead vinculado o si algo falla.
 * NUNCA tira — el caller (transición del estimado) no debe romperse por esto.
 */
export async function enqueueKommoWriteback(
  admin: SupabaseClient,
  tenantId: string,
  input: { clientMarkbox: string | null | undefined; totalUsd: number | null },
): Promise<string | null> {
  try {
    const markbox = (input.clientMarkbox ?? "").trim();
    if (!markbox) return null;

    // Resolver el lead de Kommo del cliente (markbox → clients.kommo_lead_id).
    const { data: client } = await admin
      .from("clients")
      .select("kommo_lead_id")
      .eq("tenant_id", tenantId)
      .eq("markbox", markbox)
      .is("deleted_at", null)
      .maybeSingle<{ kommo_lead_id: number | null }>();
    const leadId = client?.kommo_lead_id ?? null;
    if (leadId == null) return null; // cliente sin lead de Kommo → nada que sincronizar

    // Snapshot del updated_at del lead (trazabilidad anti-overwrite). Best-effort.
    const { data: lead } = await admin
      .from("kommo_leads")
      .select("kommo_updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .maybeSingle<{ kommo_updated_at: string | null }>();

    const { data, error } = await admin.rpc("enqueue_kommo_writeback", {
      p_tenant_id: tenantId,
      p_kommo_lead_id: leadId,
      p_op: "patch_price" satisfies WritebackOp,
      p_payload: buildPricePatchPayload(input.totalUsd),
      p_kommo_updated_at: lead?.kommo_updated_at ?? null,
    });
    if (error) {
      console.error("[kommo-writeback] enqueue error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[kommo-writeback] enqueue threw:", err);
    return null;
  }
}

// ── Write-back de ETAPA (SDD-0084 · mapa estado→etapa de Kommo) ──────────────

/**
 * Payload del PATCH `/api/v4/leads/{id}` para mover el lead de ETAPA. Kommo exige
 * `status_id` (etapa) + `pipeline_id` (embudo): al cruzar de embudo hay que mandar
 * ambos; dentro del mismo embudo mandar ambos es inocuo. Enteros. PURO.
 */
export function buildStagePatchPayload(
  target: KommoStageTarget,
): { status_id: number; pipeline_id: number } {
  return {
    status_id: Math.trunc(Number(target.status_id)),
    pipeline_id: Math.trunc(Number(target.pipeline_id)),
  };
}

/**
 * Normaliza/valida la FORMA de un mapa de etapas crudo (de la DB o del form web).
 * Conserva solo las claves válidas (`STAGE_MAP_KEYS`) cuyo destino tenga
 * `pipeline_id` y `status_id` enteros > 0; descarta el resto. PURO. (Que el par
 * exista en el espejo lo valida la action contra `kommo_statuses`.)
 *
 * ⚠️ Itera `STAGE_MAP_KEYS`, no `ESTIMATE_STAGE_KEYS`: si solo mirara las claves
 * del estimado, normalizar el mapa leído de la DB **borraría `recontacto`** y el
 * enrutador de SDD-0244 quedaría inerte sin avisar.
 */
export function normalizeStageMap(raw: unknown): KommoStageMap {
  const out: KommoStageMap = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const key of STAGE_MAP_KEYS) {
    const v = obj[key];
    if (!v || typeof v !== "object") continue;
    const rec = v as Record<string, unknown>;
    const pid = Math.trunc(Number(rec.pipeline_id));
    const sid = Math.trunc(Number(rec.status_id));
    if (Number.isFinite(pid) && pid > 0 && Number.isFinite(sid) && sid > 0) {
      out[key] = { pipeline_id: pid, status_id: sid };
    }
  }
  return out;
}

/**
 * Encola un `patch_stage` para mover el lead de Kommo del cliente a la etapa
 * mapeada para el nuevo estado del estimado. Lee `kommo_connections.stage_map`;
 * si el estado no está mapeado, **no hace nada** (la feature es inerte hasta que
 * el founder configure el mapa). Resuelve el lead por `markbox → kommo_lead_id`.
 * **Best-effort**: devuelve el id de outbox, o `null` (sin mapa / sin lead / error).
 * NUNCA tira — la transición del estimado no debe romperse por esto.
 */
export async function enqueueKommoStageWriteback(
  admin: SupabaseClient,
  tenantId: string,
  input: {
    clientMarkbox: string | null | undefined;
    estimateStatus: EstimateStageKey;
  },
): Promise<string | null> {
  try {
    const markbox = (input.clientMarkbox ?? "").trim();
    if (!markbox) return null;

    // 1) Mapa de etapas del tenant. Sin destino para este estado → no-op.
    const { data: conn } = await admin
      .from("kommo_connections")
      .select("stage_map")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ stage_map: KommoStageMap | null }>();
    const map = normalizeStageMap(conn?.stage_map ?? null);
    const target = map[input.estimateStatus] ?? null;
    if (!target) return null;

    // 2) Lead del cliente (markbox → clients.kommo_lead_id).
    const { data: client } = await admin
      .from("clients")
      .select("kommo_lead_id")
      .eq("tenant_id", tenantId)
      .eq("markbox", markbox)
      .is("deleted_at", null)
      .maybeSingle<{ kommo_lead_id: number | null }>();
    const leadId = client?.kommo_lead_id ?? null;
    if (leadId == null) return null; // cliente sin lead → nada que sincronizar

    // 3) Snapshot del updated_at del lead (trazabilidad anti-overwrite). Best-effort.
    const { data: lead } = await admin
      .from("kommo_leads")
      .select("kommo_updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .maybeSingle<{ kommo_updated_at: string | null }>();

    const { data, error } = await admin.rpc("enqueue_kommo_writeback", {
      p_tenant_id: tenantId,
      p_kommo_lead_id: leadId,
      p_op: "patch_stage" satisfies WritebackOp,
      p_payload: buildStagePatchPayload(target),
      p_kommo_updated_at: lead?.kommo_updated_at ?? null,
    });
    if (error) {
      console.error("[kommo-writeback] stage enqueue error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[kommo-writeback] stage enqueue threw:", err);
    return null;
  }
}

/**
 * Lee el mapa de etapas configurado (RLS por tenant). Para la UI de config.
 * Normaliza la forma antes de devolverlo.
 */
export async function getKommoStageMap(
  supabase: SupabaseClient,
): Promise<KommoStageMap> {
  const { data } = await supabase
    .from("kommo_connections")
    .select("stage_map")
    .maybeSingle<{ stage_map: KommoStageMap | null }>();
  return normalizeStageMap(data?.stage_map ?? null);
}

// ── Write-back de MARKBOX (SDD-0086 · patch_lead al convertir) ───────────────

/**
 * Payload del PATCH `/api/v4/leads/{id}` para escribir el MARKBOX en un custom
 * field del lead. Forma de Kommo: `custom_fields_values:[{field_id, values:[{value}]}]`.
 * Asume un campo de texto. PURO.
 */
export function buildMarkboxPatchPayload(
  fieldId: number,
  markbox: string,
): { custom_fields_values: { field_id: number; values: { value: string }[] }[] } {
  return {
    custom_fields_values: [
      { field_id: Math.trunc(Number(fieldId)), values: [{ value: String(markbox) }] },
    ],
  };
}

/**
 * Encola un `patch_lead` que escribe el MARKBOX del cliente en el custom field
 * configurado del lead de Kommo. Lee `kommo_connections.markbox_field_id`; sin
 * campo configurado → **no hace nada** (inerte). **Best-effort**: devuelve el id de
 * outbox, o `null` (sin campo / lead o markbox inválido / error). NUNCA tira — la
 * conversión del lead no debe romperse por esto.
 */
export async function enqueueKommoMarkboxWriteback(
  admin: SupabaseClient,
  tenantId: string,
  input: { leadId: number; markbox: string | null | undefined },
): Promise<string | null> {
  try {
    const leadId = Number(input.leadId);
    const markbox = (input.markbox ?? "").trim();
    if (!Number.isFinite(leadId) || leadId <= 0 || !markbox) return null;

    // 1) Campo MARKBOX configurado? Sin él → no-op (inerte).
    const { data: conn } = await admin
      .from("kommo_connections")
      .select("markbox_field_id")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ markbox_field_id: number | null }>();
    const fieldId = conn?.markbox_field_id ?? null;
    if (fieldId == null) return null;

    // 2) Snapshot del updated_at del lead (trazabilidad anti-overwrite). Best-effort.
    const { data: lead } = await admin
      .from("kommo_leads")
      .select("kommo_updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .maybeSingle<{ kommo_updated_at: string | null }>();

    const { data, error } = await admin.rpc("enqueue_kommo_writeback", {
      p_tenant_id: tenantId,
      p_kommo_lead_id: leadId,
      p_op: "patch_lead" satisfies WritebackOp,
      p_payload: buildMarkboxPatchPayload(fieldId, markbox),
      p_kommo_updated_at: lead?.kommo_updated_at ?? null,
    });
    if (error) {
      console.error("[kommo-writeback] markbox enqueue error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[kommo-writeback] markbox enqueue threw:", err);
    return null;
  }
}

/** Lee el campo MARKBOX configurado (RLS por tenant). Para la UI de config. */
export async function getKommoMarkboxFieldId(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data } = await supabase
    .from("kommo_connections")
    .select("markbox_field_id")
    .maybeSingle<{ markbox_field_id: number | null }>();
  return data?.markbox_field_id ?? null;
}

/**
 * Lee el campo de CONTACTO donde va el Shipping Mark (SDD-0244 rebanada B).
 * Hermano del de arriba: aquél muere con el trato, éste es permanente.
 */
export async function getKommoMarkboxContactFieldId(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data } = await supabase
    .from("kommo_connections")
    .select("markbox_contact_field_id")
    .maybeSingle<{ markbox_contact_field_id: number | null }>();
  return data?.markbox_contact_field_id ?? null;
}

// ── Lectura para el panel de visibilidad (SDD-0078 · pestaña Dirección) ──────

export type WritebackGate = "off" | "dry_run" | "live";

export type WritebackStatus = {
  /** Estado del gate de escritura derivado de kommo_connections. */
  gate: WritebackGate;
  counts: { pending: number; sent: number; skipped: number; error: number };
  lastDrainAt: string | null;
  /** 'writeback' (real) | 'writeback_dryrun' (ensayo) | null si nunca corrió. */
  lastDrainEntity: string | null;
};

/** Deriva el gate de los dos flags de la conexión. PURO. */
export function writebackGate(
  enabled: boolean | null | undefined,
  dryRun: boolean | null | undefined,
): WritebackGate {
  if (!enabled) return "off";
  return dryRun ? "dry_run" : "live";
}

/**
 * Estado del write-back para el tablero (RLS filtra por tenant). Read-only:
 * gate (kommo_connections) + conteos de la outbox + último drain (sync_logs).
 */
export async function getWritebackStatus(
  supabase: SupabaseClient,
): Promise<WritebackStatus> {
  const [conn, rows, log] = await Promise.all([
    supabase
      .from("kommo_connections")
      .select("writeback_enabled, writeback_dry_run")
      .maybeSingle<{ writeback_enabled: boolean | null; writeback_dry_run: boolean | null }>(),
    supabase.from("kommo_writeback_outbox").select("status").limit(5000),
    supabase
      .from("sync_logs")
      .select("started_at, entity")
      .in("entity", ["writeback", "writeback_dryrun"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ started_at: string | null; entity: string | null }>(),
  ]);

  const counts = { pending: 0, sent: 0, skipped: 0, error: 0 };
  for (const r of (rows.data as { status: string }[] | null) ?? []) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }

  return {
    gate: writebackGate(conn.data?.writeback_enabled, conn.data?.writeback_dry_run),
    counts,
    lastDrainAt: log.data?.started_at ?? null,
    lastDrainEntity: log.data?.entity ?? null,
  };
}
