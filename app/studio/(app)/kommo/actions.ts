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
import { createAdminClient } from "@/lib/db/admin";
import {
  convertLead,
  searchKommoContacts,
  type ContactPrefill,
  type ConvertLeadResult,
  type KommoContactPick,
} from "@/lib/studio/kommo-convert";
import { normalizeStageMap } from "@/lib/studio/kommo-writeback";
import {
  ESTIMATE_STAGE_KEYS,
  ESTIMATE_STAGE_LABELS,
  type KommoStageMap,
} from "@/lib/studio/kommo-types";

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
  if (res.ok) revalidatePath("/studio/kommo");
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
  const { data: updated, error } = await admin
    .from("kommo_connections")
    .update({ stage_map: clean })
    .eq("tenant_id", link.tenant_id)
    .select("id");
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!updated || updated.length === 0) {
    return { error: "No hay una conexión de Kommo configurada para tu cuenta." };
  }

  revalidatePath("/studio/kommo");
  return { ok: true };
}
