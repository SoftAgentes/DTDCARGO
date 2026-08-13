"use server";

/**
 * Acciones del módulo Kommo (SDD-0058). Puente lead → cliente:
 *  - convertLeadToClientAction: convierte (idempotente), con prefill opcional del
 *    contacto elegido (Slice B).
 *  - searchKommoContactsAction: busca contactos del espejo para el picker.
 * Resuelven el tenant del usuario logueado y delegan en la lógica pura
 * (lib/studio/kommo-convert); RLS scopea las lecturas por tenant.
 */

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import {
  convertLead,
  searchKommoContacts,
  type ContactPrefill,
  type ConvertLeadResult,
  type KommoContactPick,
} from "@/lib/studio/kommo-convert";
import {
  buildOwnerPatchPayload,
  buildStagePatchPayload,
  buildTagsPatchPayload,
  enqueueKommoLeadOp,
  enqueueKommoMarkboxWriteback,
  normalizeStageMap,
} from "@/lib/studio/kommo-writeback";
import {
  ESTIMATE_STAGE_KEYS,
  ESTIMATE_STAGE_LABELS,
  ROUTER_STAGE_KEYS,
  type KommoStageMap,
} from "@/lib/studio/kommo-types";
import {
  buildRecoverySmsCsv,
  filterRecoveryRows,
  getRecoveryUniverse,
  parseRecoveryFilters,
} from "@/lib/studio/kommo-recovery";

export async function convertLeadToClientAction(
  leadId: number,
  prefill?: ContactPrefill,
): Promise<ConvertLeadResult> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const res = await convertLead(supabase, link.tenant_id, leadId, prefill ?? {});
  if (res.ok) {
    // SDD-0086 — write-back del MARKBOX al lead en Kommo (best-effort, dry-run por
    // default). Inerte hasta que el founder elija el campo; no rompe la conversión.
    if (res.markbox) {
      const admin = createAdminClient();
      await enqueueKommoMarkboxWriteback(admin, link.tenant_id, {
        leadId,
        markbox: res.markbox,
      });
    }
    revalidatePath("/studio/crm");
  }
  return res;
}

export async function searchKommoContactsAction(
  q: string,
): Promise<KommoContactPick[]> {
  const supabase = await createClient();
  // RLS de kommo_contacts filtra por tenant → no hace falta resolverlo acá.
  return searchKommoContacts(supabase, q);
}

/**
 * SDD-0157 — CSV de SMS de la campaña de recuperación, sobre el universo
 * COMPLETO filtrado (no solo la página visible en la UI). Lectura pura del
 * espejo + clients (RLS por tenant), sin mutación → sin gate de edición.
 */
export async function exportRecoverySmsCsvAction(
  rawFilters: Record<string, string | undefined>,
): Promise<{ csv?: string; count?: number; error?: string }> {
  const supabase = await createClient();
  try {
    const universe = await getRecoveryUniverse(supabase);
    const rows = filterRecoveryRows(universe.rows, parseRecoveryFilters(rawFilters));
    return { csv: buildRecoverySmsCsv(rows), count: rows.length };
  } catch (e) {
    console.error("[kommo-recovery] export CSV falló:", e);
    return { error: "No se pudo generar el CSV. Intenta de nuevo." };
  }
}

/**
 * SDD-0084 — Guarda el mapa estado-del-estimado → etapa de Kommo (admin-only).
 * Valida la forma (normalizeStageMap) + que cada (pipeline_id, status_id) exista en
 * el espejo (kommo_statuses, RLS por tenant), y upsertea en
 * `kommo_connections.stage_map` vía admin client. authenticated NO tiene UPDATE
 * sobre kommo_connections → el guardado no es forjable vía PostgREST. El write-back
 * de etapa (enqueueKommoStageWriteback) lee este mapa.
 */
export async function saveKommoStageMapAction(
  raw: KommoStageMap,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "kommo");
  if (denial) return { error: denial };


  // Admin-only (controla escrituras a Kommo) — mismo patrón que resolveAdminTenant.
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión no válida." };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  if (link.role !== "admin") {
    return { error: "Solo un administrador puede configurar el mapa de etapas." };
  }

  // Forma válida + cada destino debe existir en el espejo del tenant.
  const clean = normalizeStageMap(raw);
  const targets = Object.values(clean);
  if (targets.length > 0) {
    const statusIds = [...new Set(targets.map((t) => t.status_id))];
    const { data: rows } = await supabase
      .from("kommo_statuses")
      .select("id, pipeline_id")
      .in("id", statusIds);
    const valid = new Set(
      ((rows as { id: number; pipeline_id: number }[] | null) ?? []).map(
        (r) => `${r.pipeline_id}:${r.id}`,
      ),
    );
    for (const key of ESTIMATE_STAGE_KEYS) {
      const t = clean[key];
      if (t && !valid.has(`${t.pipeline_id}:${t.status_id}`)) {
        return {
          error: `La etapa elegida para "${ESTIMATE_STAGE_LABELS[key]}" no existe en Kommo.`,
        };
      }
    }
  }

  // Upsert vía admin client (service_role) — authenticated no puede UPDATE acá.
  // `.select("id")` confirma que se tocó la fila: si el tenant no tiene conexión de
  // Kommo, el update afectaría 0 filas y guardaría en silencio (reviewer P3).
  const admin = createAdminClient();

  // ⚠️ Esta pantalla SOLO edita las claves del estimado, pero `stage_map` es un
  // jsonb compartido: también guarda los destinos del enrutador (SDD-0244 ·
  // `recontacto`). Escribir `clean` pelado los BORRABA, y el enrutador quedaba
  // inerte sin un solo error — se preservan explícitamente.
  const { data: current } = await admin
    .from("kommo_connections")
    .select("stage_map")
    .eq("tenant_id", link.tenant_id)
    .maybeSingle<{ stage_map: unknown }>();
  const stored = normalizeStageMap(current?.stage_map ?? null);

  const next: KommoStageMap = {};
  for (const key of ROUTER_STAGE_KEYS) {
    const kept = stored[key];
    if (kept) next[key] = kept;
  }
  for (const key of ESTIMATE_STAGE_KEYS) {
    const t = clean[key];
    if (t) next[key] = t;
  }

  const { data: updated, error } = await admin
    .from("kommo_connections")
    .update({ stage_map: next })
    .eq("tenant_id", link.tenant_id)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!updated || updated.length === 0) {
    return { error: "No hay una conexión de Kommo configurada para tu cuenta." };
  }

  revalidatePath("/studio/crm");
  return { ok: true };
}

/**
 * SDD-0086 — Guarda el custom field de Kommo donde va el MARKBOX al convertir un
 * lead (admin-only). Valida que el campo exista como campo de leads en el espejo
 * (RLS por tenant) y upsertea `markbox_field_id` vía admin client. `null` = limpiar
 * (inerte). authenticated NO tiene UPDATE sobre kommo_connections → no forjable.
 */
export async function saveKommoMarkboxFieldAction(
  fieldId: number | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "kommo");
  if (denial) return { error: denial };


  // Admin-only — mismo patrón que resolveAdminTenant.
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión no válida." };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  if (link.role !== "admin") {
    return { error: "Solo un administrador puede configurar el campo de Shipping Mark." };
  }

  // null = limpiar. Si viene un id, debe existir como campo de leads del tenant.
  let clean: number | null = null;
  if (fieldId != null) {
    const fid = Math.trunc(Number(fieldId));
    if (!Number.isFinite(fid) || fid <= 0) return { error: "Campo inválido." };
    const { data: field } = await supabase
      .from("kommo_custom_fields")
      .select("id")
      .eq("entity_type", "leads")
      .eq("id", fid)
      .maybeSingle<{ id: number }>();
    if (!field) return { error: "El campo elegido no existe en Kommo (leads)." };
    clean = fid;
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("kommo_connections")
    .update({ markbox_field_id: clean })
    .eq("tenant_id", link.tenant_id)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!updated || updated.length === 0) {
    return { error: "No hay una conexión de Kommo configurada para tu cuenta." };
  }

  revalidatePath("/studio/crm");
  return { ok: true };
}

/**
 * SDD-0244 rebanada B — Guarda el custom field de CONTACTO donde va el Shipping
 * Mark (admin-only). Hermano del de arriba, con una diferencia que importa: el
 * campo del lead se lo lleva el trato al cerrarse; éste es permanente, y es el
 * que hace que el cliente se reconozca la próxima vez sin cruzar teléfonos.
 *
 * Valida contra los campos de CONTACTOS del espejo (no los de leads: los ids
 * viven en espacios distintos y elegir uno de leads acá escribiría en la nada).
 * `null` = limpiar (inerte). authenticated NO tiene UPDATE sobre
 * kommo_connections → no forjable vía PostgREST.
 */
export async function saveKommoMarkboxContactFieldAction(
  fieldId: number | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "kommo");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión no válida." };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  if (link.role !== "admin") {
    return { error: "Solo un administrador puede configurar el campo de Shipping Mark." };
  }

  let clean: number | null = null;
  if (fieldId != null) {
    const fid = Math.trunc(Number(fieldId));
    if (!Number.isFinite(fid) || fid <= 0) return { error: "Campo inválido." };
    const { data: field } = await supabase
      .from("kommo_custom_fields")
      .select("id")
      .eq("entity_type", "contacts")
      .eq("id", fid)
      .maybeSingle<{ id: number }>();
    if (!field) return { error: "El campo elegido no existe en Kommo (contactos)." };
    clean = fid;
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("kommo_connections")
    .update({ markbox_contact_field_id: clean })
    .eq("tenant_id", link.tenant_id)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!updated || updated.length === 0) {
    return { error: "No hay una conexión de Kommo configurada para tu cuenta." };
  }

  revalidatePath("/studio/crm");
  return { ok: true };
}

// ── Fase 4 · SDD-0256 — los verbos que mueven el embudo desde el ERP ─────────
//
// Todos siguen el mismo contrato: RBAC → tenant → validación propia → ENCOLAR
// (nunca un PATCH directo a Kommo) → revalidar → nudge.
//
// El ERP no escribe el espejo (guardrail 0107): la pantalla sigue mostrando lo
// viejo hasta que Kommo re-espeje por webhook. Por eso la UI pinta "en camino"
// leyendo la outbox — si no, el asesor cree que no pasó nada y clickea de nuevo.

type VerbResult = { ok?: true; error?: string };

/** RBAC + tenant del usuario. Devuelve el error listo para mostrar, o el tenant. */
async function resolveCrmWriter(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ tenantId: string } | { error: string }> {
  const denial = await moduleEditDenial(supabase, "kommo");
  if (denial) return { error: denial };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  return { tenantId: link.tenant_id };
}

/**
 * Despierta el drenaje en vez de esperar al cron.
 *
 * Sin esto la latencia medida es **14 min 38 s** (el cron corre cada 15) y el
 * asesor deja de usar la pantalla. No rompe el modelo de seguridad: el ERP
 * invoca su PROPIA edge function, no la API de Kommo — el token sigue en Vault.
 * El cron queda como red: drena lo que el nudge no alcanzó.
 *
 * Es best-effort dentro de `after()`: corre DESPUÉS de responderle al asesor,
 * así la pantalla no espera el cold start de la función.
 */
function nudgeWriteback(tenantId: string): void {
  try {
    after(async () => {
      try {
        const { error } = await createAdminClient().functions.invoke("kommo-writeback", {
          body: { tenant_id: tenantId },
        });
        if (error) console.warn("[crm] nudge del drenaje falló (best-effort):", error.message);
      } catch (e) {
        console.warn("[crm] nudge del drenaje lanzó (best-effort):", e);
      }
    });
  } catch {
    // `after()` sólo vale dentro de un request scope; fuera (tests) lanza al
    // registrar. Se ignora: el cron drena igual.
  }
}

/**
 * Mueve un lead de etapa.
 *
 * ⚠️ Rechaza las etapas de tipo 1 ("Leads Entrantes"): Kommo **no permite
 * mover un lead HACIA la etapa de entrantes por API** — esa la gobierna la
 * bandeja `unsorted`. Verificado contra prod el 2026-08-12: devuelve
 * `400 NotSupportedChoice`. Se corta acá para que el asesor vea un mensaje que
 * se entiende, no un error de la API 15 minutos después.
 */
export async function moveLeadStageAction(
  leadId: number,
  statusId: number,
): Promise<VerbResult> {
  const supabase = await createClient();
  const who = await resolveCrmWriter(supabase);
  if ("error" in who) return who;

  if (!Number.isInteger(leadId) || leadId <= 0) return { error: "Lead inválido." };
  if (!Number.isInteger(statusId) || statusId <= 0) return { error: "Etapa inválida." };

  // El lead tiene que ser de este tenant (RLS ya scopea, pero además necesitamos
  // su embudo: Kommo exige status_id + pipeline_id juntos).
  const { data: lead } = await supabase
    .from("kommo_leads")
    .select("id, pipeline_id")
    .eq("id", leadId)
    .maybeSingle<{ id: number; pipeline_id: number | null }>();
  if (!lead?.pipeline_id) return { error: "Ese lead no existe o no tiene embudo." };

  const { data: stage } = await supabase
    .from("kommo_statuses")
    .select("id, name, type")
    .eq("pipeline_id", lead.pipeline_id)
    .eq("id", statusId)
    .maybeSingle<{ id: number; name: string | null; type: number | null }>();
  if (!stage) return { error: "Esa etapa no existe en el embudo del lead." };
  if (Number(stage.type) === 1) {
    return {
      error: `"${stage.name ?? "Entrantes"}" es la bandeja de entrada: Kommo no deja mover un lead hacia ahí.`,
    };
  }

  const id = await enqueueKommoLeadOp(createAdminClient(), who.tenantId, {
    leadId,
    op: "patch_stage",
    payload: buildStagePatchPayload({ pipeline_id: lead.pipeline_id, status_id: statusId }),
  });
  if (!id) return { error: "No se pudo encolar el cambio de etapa." };

  revalidatePath("/studio/crm");
  nudgeWriteback(who.tenantId);
  return { ok: true };
}

/** Reasigna el asesor responsable del lead. */
export async function reassignLeadOwnerAction(
  leadId: number,
  responsibleUserId: number,
): Promise<VerbResult> {
  const supabase = await createClient();
  const who = await resolveCrmWriter(supabase);
  if ("error" in who) return who;

  if (!Number.isInteger(leadId) || leadId <= 0) return { error: "Lead inválido." };
  const payload = buildOwnerPatchPayload(responsibleUserId);
  if (!payload) return { error: "Asesor inválido." };

  // El asesor tiene que existir en el espejo: reasignar a un id inventado
  // dejaría el lead sin dueño real y Kommo lo aceptaría igual.
  const { data: user } = await supabase
    .from("kommo_users")
    .select("id")
    .eq("id", responsibleUserId)
    .maybeSingle<{ id: number }>();
  if (!user) return { error: "Ese asesor no existe en el CRM." };

  const id = await enqueueKommoLeadOp(createAdminClient(), who.tenantId, {
    leadId,
    op: "patch_owner",
    payload,
  });
  if (!id) return { error: "No se pudo encolar la reasignación." };

  revalidatePath("/studio/crm");
  nudgeWriteback(who.tenantId);
  return { ok: true };
}

/** Agrega y/o quita etiquetas del lead (incremental: no pisa las del asesor). */
export async function setLeadTagsAction(
  leadId: number,
  add: string[],
  remove: string[],
): Promise<VerbResult> {
  const supabase = await createClient();
  const who = await resolveCrmWriter(supabase);
  if ("error" in who) return who;

  if (!Number.isInteger(leadId) || leadId <= 0) return { error: "Lead inválido." };
  const payload = buildTagsPatchPayload({
    add: Array.isArray(add) ? add : [],
    remove: Array.isArray(remove) ? remove : [],
  });
  if (!payload) return { error: "No indicaste ninguna etiqueta." };

  const id = await enqueueKommoLeadOp(createAdminClient(), who.tenantId, {
    leadId,
    op: "patch_tags",
    payload,
  });
  if (!id) return { error: "No se pudo encolar el cambio de etiquetas." };

  revalidatePath("/studio/crm");
  nudgeWriteback(who.tenantId);
  return { ok: true };
}
