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
import { fetchAllPaged } from "@/lib/db/paginate";
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
  | "patch_tags"
  | "add_note"
  | "add_task";

/**
 * Las ops que CREAN algo en Kommo (POST). Repetirlas no es inocuo: cada intento
 * deja otra nota, otra tarea. Por eso van con `dedupeToken` y por eso el
 * drenaje las manda a `error` al primer fallo en vez de reintentarlas
 * (migración 0374).
 */
export const OPS_QUE_CREAN: readonly WritebackOp[] = ["add_note", "add_task"] as const;

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

// ── Fase 5 · lo que se CREA en Kommo (POST) ─────────────────────────────────
//
// Los payloads se arman acá, del lado que encola. La Edge Function sólo los
// transporta y decide ruta y método (`_shared/kommo-writeback-plan.ts`). Tener
// la forma de Kommo escrita en los dos lados sería dos definiciones de lo mismo,
// y la que no se usa driftea sin que nada lo note.

/**
 * Nota común sobre el lead (`POST /api/v4/leads/{id}/notes`). PURO.
 *
 * Kommo envuelve el texto en `params`, no lo pone suelto. `null` si no hay nada
 * que escribir: mejor no encolar que dejar una nota en blanco en el CRM.
 */
export function buildNotePayload(texto: string): Record<string, unknown> | null {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  return { note_type: "common", params: { text: t } };
}

/**
 * Tarea sobre el lead (`POST /api/v4/tasks`). PURO.
 *
 * Es la que pone la **tarjeta roja** en Kommo cuando vence — el semáforo real
 * del equipo, y por eso es la op de más valor operativo de la Fase 5.
 *
 * ⚠️ `complete_till` va en epoch de **SEGUNDOS** (gemelo de `epochToIso`, que
 * hace el camino inverso en el espejo). Mandarlo en milisegundos pone el
 * vencimiento en el año 57.000: Kommo lo acepta sin chistar y la tarjeta no se
 * pone roja nunca. Falla en la dirección que no se ve — de ahí el test que
 * cuenta los dígitos.
 */
export function buildTaskPayload(input: {
  leadId: number;
  texto: string;
  completeTillIso: string;
  responsibleUserId?: number | null;
}): Record<string, unknown> | null {
  const leadId = Math.trunc(Number(input.leadId));
  if (!Number.isFinite(leadId) || leadId <= 0) return null;

  const texto = String(input.texto ?? "").trim();
  if (!texto) return null;

  const ms = Date.parse(String(input.completeTillIso ?? ""));
  if (!Number.isFinite(ms)) return null;
  const completeTill = Math.floor(ms / 1000);

  const payload: Record<string, unknown> = {
    text: texto,
    complete_till: completeTill,
    entity_id: leadId,
    entity_type: "leads",
  };

  const responsable = Math.trunc(Number(input.responsibleUserId));
  if (Number.isFinite(responsable) && responsable > 0) {
    payload.responsible_user_id = responsable;
  }
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
    // Paginado: esto CUENTA la cola por estado (pendientes, enviadas, con
    // error). Truncar no muestra menos filas — da un panel de write-back con
    // números equivocados, y es justo el panel al que se mira para saber si la
    // cola está sana.
    fetchAllPaged<{ status: string }>((d, h) =>
      supabase
        .from("kommo_writeback_outbox")
        .select("id, status")
        .order("id", { ascending: true })
        .range(d, h),
    ),
    supabase
      .from("sync_logs")
      .select("started_at, entity")
      .in("entity", ["writeback", "writeback_dryrun"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ started_at: string | null; entity: string | null }>(),
  ]);

  const counts = { pending: 0, sent: 0, skipped: 0, error: 0 };
  for (const r of rows.rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }

  return {
    gate: writebackGate(conn.data?.writeback_enabled, conn.data?.writeback_dry_run),
    counts,
    lastDrainAt: log.data?.started_at ?? null,
    lastDrainEntity: log.data?.entity ?? null,
  };
}

/**
 * Encola una op de LEAD genérica (Fase 4 · SDD-0256).
 *
 * El ERP nunca le pega a la API de Kommo: sólo deja la orden en la outbox y la
 * Edge Function `kommo-writeback` la drena con el token de Vault. Esta función
 * es el único camino que usan los verbos de la pantalla.
 *
 * `kommo_updated_at` se sella al encolar para el chequeo optimista: si el lead
 * se movió en Kommo entre el encolado y el envío, se puede detectar en vez de
 * pisar el trabajo del asesor.
 *
 * Best-effort en el mismo sentido que sus hermanas: devuelve el id de la fila o
 * `null`; NUNCA tira.
 */
export async function enqueueKommoLeadOp(
  admin: SupabaseClient,
  tenantId: string,
  args: {
    leadId: number;
    op: WritebackOp;
    payload: Record<string, unknown>;
    /**
     * Sólo para las ops que CREAN (`add_note`, `add_task`). Lo genera el drawer
     * al abrirse: dos notas distintas = dos tokens = dos filas; doble submit =
     * un token = una fila (migración 0374). Un PATCH va sin token — ahí la
     * semántica correcta es "gana el último" y la fusión de la 0364/0366.
     */
    dedupeToken?: string | null;
  },
): Promise<string | null> {
  try {
    const { data: lead } = await admin
      .from("kommo_leads")
      .select("kommo_updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", args.leadId)
      .maybeSingle<{ kommo_updated_at: string | null }>();

    const { data, error } = await admin.rpc("enqueue_kommo_writeback", {
      p_tenant_id: tenantId,
      p_kommo_lead_id: args.leadId,
      p_op: args.op,
      p_payload: args.payload,
      p_kommo_updated_at: lead?.kommo_updated_at ?? null,
      p_dedupe_token: args.dedupeToken ?? null,
    });
    if (error) {
      console.warn("[enqueueKommoLeadOp]", args.op, error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.warn("[enqueueKommoLeadOp] lanzó (best-effort):", e);
    return null;
  }
}

/**
 * Encola una op contra un CONTACTO de Kommo (SDD-0244 · migr 0344).
 *
 * Hermana de `enqueueKommoLeadOp`, con dos diferencias que importan: va por la
 * RPC de contacto (clave de idempotencia `c:<id>:<op>`, para no chocar con la
 * del lead) y no lleva snapshot de `kommo_updated_at` — el chequeo optimista es
 * del lead, y un contacto no tiene etapa que alguien pueda estar moviendo a la
 * vez.
 *
 * Best-effort como sus hermanas: devuelve el id de la fila o `null`; NUNCA tira.
 */
export async function enqueueKommoContactOp(
  admin: SupabaseClient,
  tenantId: string,
  args: { contactId: number; payload: Record<string, unknown> },
): Promise<string | null> {
  try {
    const contactId = Math.trunc(Number(args.contactId));
    if (!Number.isFinite(contactId) || contactId <= 0) return null;

    const { data, error } = await admin.rpc("enqueue_kommo_contact_writeback", {
      p_tenant_id: tenantId,
      p_kommo_contact_id: contactId,
      p_op: "patch_contact",
      p_payload: args.payload,
    });
    if (error) {
      console.warn("[enqueueKommoContactOp]", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.warn("[enqueueKommoContactOp] lanzó (best-effort):", e);
    return null;
  }
}

/**
 * Órdenes de este lead que todavía no llegaron a Kommo — lo que la UI pinta como
 * "en camino". Incluye `processing` (ya reservadas por un drenaje) además de
 * `pending`: entre el clic y el webhook de vuelta, el espejo sigue mostrando lo
 * viejo, y si la pantalla no lo dice el asesor cree que no pasó nada y vuelve a
 * clickear. RLS deja leer la outbox del propio tenant (0136).
 */
export async function getPendingOpsByLead(
  supabase: SupabaseClient,
  leadIds: number[],
): Promise<Record<number, string[]>> {
  if (leadIds.length === 0) return {};
  const { data, error } = await supabase
    .from("kommo_writeback_outbox")
    .select("kommo_lead_id, op")
    .in("kommo_lead_id", leadIds)
    .in("status", ["pending", "processing"]);
  if (error) return {};
  return groupOpsByLead(data);
}

/** Tope de órdenes en vuelo que trae el Tablero. Ver `getPendingOpsForBoard`. */
export const PENDING_OPS_CAP = 500;

/**
 * Lo mismo, pero sin pasarle la lista de leads — es lo que usa el Tablero.
 *
 * El kanban pinta hasta 2.000 tarjetas, y un `.in()` de 2.000 ids es una URL
 * enorme por una respuesta que en régimen tiene unidades de filas: el nudge
 * drena en segundos, así que la outbox vive casi vacía. Se trae la cola entera
 * del tenant (RLS la scopea) con tope, y se agrupa acá.
 *
 * Si la cola llegara al tope —un drenaje caído— lo que se pierde es el rótulo
 * "En camino" de las tarjetas más viejas, no el dato: la orden sigue encolada.
 */
export async function getPendingOpsForBoard(
  supabase: SupabaseClient,
): Promise<Record<number, string[]>> {
  const { data, error } = await supabase
    .from("kommo_writeback_outbox")
    .select("kommo_lead_id, op")
    .in("status", ["pending", "processing"])
    .not("kommo_lead_id", "is", null)
    .limit(PENDING_OPS_CAP);
  if (error) return {};
  return groupOpsByLead(data);
}

function groupOpsByLead(data: unknown): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const r of (data as { kommo_lead_id: number | null; op: string }[] | null) ?? []) {
    if (r.kommo_lead_id == null) continue;
    (out[Number(r.kommo_lead_id)] ??= []).push(r.op);
  }
  return out;
}

// ── A1 · las órdenes que el chequeo optimista FRENÓ ─────────────────────────
//
// Una orden `skipped` con `skip_code = 'stale'` es la que no se mandó porque el
// lead cambió en Kommo entre el clic y el envío. Si la pantalla no lo dice, el
// asesor ve desaparecer el "En camino" y asume que salió — que es exactamente
// el silencio que el chequeo vino a romper. Se muestra, se explica y se ofrece
// reintentar.
//
// Sólo las recientes: una orden frenada hace días ya no es accionable y llenaría
// la tabla de ruido histórico.

export type StaleOp = {
  /** id de la fila de outbox — es lo que necesita el botón de reintentar. */
  id: string;
  op: string;
  motivo: string | null;
  at: string | null;
};

/** Cuánto tiempo se sigue mostrando una orden frenada. */
export const STALE_VENTANA_HORAS = 48;

/** Tope de órdenes frenadas que se traen de una. */
export const STALE_CAP = 200;

export async function getStaleOpsByLead(
  supabase: SupabaseClient,
  leadIds: number[],
): Promise<Record<number, StaleOp[]>> {
  if (leadIds.length === 0) return {};
  const desde = new Date(Date.now() - STALE_VENTANA_HORAS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("kommo_writeback_outbox")
    .select("id, kommo_lead_id, op, last_error, sent_at")
    .in("kommo_lead_id", leadIds)
    .eq("status", "skipped")
    .eq("skip_code", "stale")
    .gte("sent_at", desde)
    .order("sent_at", { ascending: false })
    .limit(STALE_CAP);
  if (error) return {};
  return groupStale(data);
}

/** Lo mismo sin lista de ids — el Tablero, igual que `getPendingOpsForBoard`. */
export async function getStaleOpsForBoard(
  supabase: SupabaseClient,
): Promise<Record<number, StaleOp[]>> {
  const desde = new Date(Date.now() - STALE_VENTANA_HORAS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("kommo_writeback_outbox")
    .select("id, kommo_lead_id, op, last_error, sent_at")
    .eq("status", "skipped")
    .eq("skip_code", "stale")
    .not("kommo_lead_id", "is", null)
    .gte("sent_at", desde)
    .order("sent_at", { ascending: false })
    .limit(STALE_CAP);
  if (error) return {};
  return groupStale(data);
}

function groupStale(data: unknown): Record<number, StaleOp[]> {
  const out: Record<number, StaleOp[]> = {};
  const rows =
    (data as
      | {
          id: string;
          kommo_lead_id: number | null;
          op: string;
          last_error: string | null;
          sent_at: string | null;
        }[]
      | null) ?? [];
  for (const r of rows) {
    if (r.kommo_lead_id == null) continue;
    const lista = (out[Number(r.kommo_lead_id)] ??= []);
    // Una sola por (lead, op): lo accionable es la más reciente, y el `order`
    // ya la puso primera. Mostrar tres "no se pisó la etapa" seguidos no agrega
    // información, agrega ruido.
    if (lista.some((x) => x.op === r.op)) continue;
    lista.push({ id: r.id, op: r.op, motivo: r.last_error, at: r.sent_at });
  }
  return out;
}
