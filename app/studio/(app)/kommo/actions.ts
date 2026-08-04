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
    revalidatePath("/studio/kommo");
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

  revalidatePath("/studio/kommo");
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

  revalidatePath("/studio/kommo");
  return { ok: true };
}
