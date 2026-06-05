/**
 * Puente Kommo lead → cliente (SDD-0058). Lógica PURA respecto del client de
 * Supabase (recibe el cliente ya autenticado); la server action resuelve el
 * tenant + revalida. Convierte un lead del espejo Kommo en un cliente DTD
 * operativo (MARKBOX), idempotente por lead, sin crear cuenta de portal.
 *
 * V1 = solo nombre + MARKBOX + link `kommo_lead_id` (el email/teléfono viven en
 * el CONTACTO de Kommo, no en el lead, y el espejo no guarda el link
 * lead↔contacto → prefill = Slice B).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConvertLeadResult = {
  ok?: true;
  markbox?: string;
  created?: boolean;
  error?: string;
};

/**
 * Map `kommo_lead_id → markbox` de los leads (entre los `leadIds` dados) que ya
 * tienen un cliente vivo. Para que la UI marque cada row como "Convertir" vs
 * "ya es cliente". RLS filtra clients por tenant. PURA.
 */
export async function listConvertedLeadIds(
  supabase: SupabaseClient,
  leadIds: number[],
): Promise<Record<number, string>> {
  const ids = leadIds.filter((n) => Number.isFinite(n));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("clients")
    .select("kommo_lead_id, markbox")
    .in("kommo_lead_id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  const map: Record<number, string> = {};
  for (const r of (data as { kommo_lead_id: number | null; markbox: string }[] | null) ??
    []) {
    if (r.kommo_lead_id != null) map[r.kommo_lead_id] = r.markbox;
  }
  return map;
}

/**
 * Convierte un lead del espejo Kommo en cliente DTD. Idempotente por lead: si el
 * lead ya tiene cliente vivo, devuelve ese MARKBOX sin insertar. El cliente nace
 * operativo (`tier='regular'`, `registration_channel='kommo'`), SIN portal
 * (`portal_approved_at` queda null → acceso al portal sigue el flujo de SDD-0042).
 * PURA respecto del client de Supabase.
 */
export async function convertLead(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: number,
): Promise<ConvertLeadResult> {
  if (!Number.isFinite(leadId) || leadId <= 0) return { error: "Lead inválido." };

  const findExisting = () =>
    supabase
      .from("clients")
      .select("markbox")
      .eq("tenant_id", tenantId)
      .eq("kommo_lead_id", leadId)
      .is("deleted_at", null)
      .maybeSingle<{ markbox: string }>();

  // 1. Guard idempotente: ¿este lead ya es cliente?
  const { data: existing } = await findExisting();
  if (existing?.markbox) return { ok: true, markbox: existing.markbox, created: false };

  // 2. Cargar el lead del espejo (RLS por tenant).
  const { data: lead } = await supabase
    .from("kommo_leads")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle<{ name: string | null }>();
  if (!lead) return { error: "No se encontró el lead en el espejo de Kommo." };

  // 3. MARKBOX atómico.
  const { data: markboxData, error: mErr } = await supabase.rpc("next_markbox", {
    p_tenant_id: tenantId,
  });
  if (mErr || !markboxData) return { error: "No se pudo generar el MARKBOX." };
  const markbox = String(markboxData);

  // 4. Insert del cliente operativo.
  const name = (lead.name ?? "").trim() || `Lead Kommo ${leadId}`;
  const { error: insErr } = await supabase.from("clients").insert({
    tenant_id: tenantId,
    markbox,
    name,
    kommo_lead_id: leadId,
    tier: "regular",
    registration_channel: "kommo",
  });
  if (insErr) {
    // Race: dos conversiones del mismo lead a la vez → el índice único parcial
    // (clients_kommo_lead_unique) rebota el segundo. Re-leemos y devolvemos el ya creado.
    const { data: raced } = await findExisting();
    if (raced?.markbox) return { ok: true, markbox: raced.markbox, created: false };
    return { error: `No se pudo crear el cliente: ${insErr.message}` };
  }

  return { ok: true, markbox, created: true };
}
