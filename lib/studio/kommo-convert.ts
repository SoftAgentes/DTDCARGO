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
import { normalizePhone, phonesMatch } from "./estimado-linking";

export type ConvertLeadResult = {
  ok?: true;
  markbox?: string;
  created?: boolean;
  error?: string;
};

/** Datos de contacto para prefillear el cliente (Slice B; vienen del contacto elegido). */
export type ContactPrefill = { name?: string; email?: string; phone?: string };

/** Un contacto del espejo Kommo con email/teléfono ya parseados, para el picker. */
export type KommoContactPick = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Extrae email + teléfono (primer valor de cada uno) de los `custom_fields` crudos
 * de un contacto Kommo. Forma real (verificada en prod): un array de
 * `{ field_code, values: [{ value }] }` con códigos EMAIL / PHONE (multitext).
 * Tolera formas inesperadas (devuelve null). PURO.
 */
export function parseContactFields(customFields: unknown): {
  email: string | null;
  phone: string | null;
} {
  let email: string | null = null;
  let phone: string | null = null;
  if (Array.isArray(customFields)) {
    for (const f of customFields) {
      if (!f || typeof f !== "object") continue;
      const code = String((f as { field_code?: unknown }).field_code ?? "").toUpperCase();
      const values = (f as { values?: unknown }).values;
      const raw = Array.isArray(values)
        ? (values[0] as { value?: unknown })?.value
        : null;
      if (raw == null || raw === "") continue;
      if (code === "EMAIL" && !email) email = String(raw);
      else if (code === "PHONE" && !phone) phone = String(raw);
    }
  }
  return { email, phone };
}

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
 * Busca contactos del espejo Kommo por nombre (ilike), con email/teléfono ya
 * parseados de sus `custom_fields`. Para el picker de "Convertir a cliente"
 * (Slice B). Sin término → los más recientes. RLS filtra por tenant. PURA.
 */
export async function searchKommoContacts(
  supabase: SupabaseClient,
  q: string,
  limit = 20,
): Promise<KommoContactPick[]> {
  let query = supabase
    .from("kommo_contacts")
    .select("id, name, custom_fields")
    .order("kommo_updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const term = (q ?? "").trim();
  if (term) {
    const safe = term.replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
    query = query.ilike("name", `%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (
    (data as { id: number; name: string | null; custom_fields: unknown }[] | null) ?? []
  ).map((c) => {
    const { email, phone } = parseContactFields(c.custom_fields);
    return { id: c.id, name: c.name ?? `Contacto ${c.id}`, email, phone };
  });
}

/**
 * Slice 4 (SDD-0061) — cruce con el lead/contacto de Kommo POR TELÉFONO. Para un
 * estimado web, busca si el prospecto ya es un contacto de Kommo (mismo número),
 * y así evitar abrir una bandeja duplicada. Read-only sobre el espejo (RLS por
 * tenant). PURA respecto del client de Supabase.
 *
 * El teléfono vive en `kommo_contacts.custom_fields` (jsonb anidado), no en una
 * columna → no se puede filtrar en SQL con un índice. Traemos los `limit` más
 * recientes y filtramos por sufijo de dígitos en JS (advisory, no hot-path). Si
 * el match estuviera fuera de los `limit` recientes, no aparece — es una ayuda,
 * no una garantía (un match exhaustivo pediría des-anidar el teléfono a columna).
 */
export async function findKommoContactsByPhone(
  supabase: SupabaseClient,
  phone: string | null | undefined,
  limit = 500,
): Promise<KommoContactPick[]> {
  if (normalizePhone(phone).length < 7) return [];
  const { data, error } = await supabase
    .from("kommo_contacts")
    .select("id, name, custom_fields")
    .order("kommo_updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;

  const out: KommoContactPick[] = [];
  for (const c of (data as
    | { id: number; name: string | null; custom_fields: unknown }[]
    | null) ?? []) {
    const { email, phone: cphone } = parseContactFields(c.custom_fields);
    if (cphone && phonesMatch(cphone, phone)) {
      out.push({ id: c.id, name: c.name ?? `Contacto ${c.id}`, email, phone: cphone });
    }
  }
  return out;
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
  prefill: ContactPrefill = {},
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
  if (!lead) return { error: "No se encontró el lead en el espejo del CRM." };

  // 3. MARKBOX atómico.
  const { data: markboxData, error: mErr } = await supabase.rpc("next_markbox", {
    p_tenant_id: tenantId,
  });
  if (mErr || !markboxData) return { error: "No se pudo generar el Shipping Mark." };
  const markbox = String(markboxData);

  // 4. Insert del cliente operativo. El nombre del contacto (Slice B) gana sobre
  //    el del lead (que suele ser "Lead #NNNN"); email/teléfono solo si vienen.
  const name =
    (prefill.name ?? "").trim() ||
    (lead.name ?? "").trim() ||
    `Lead ${leadId}`;
  const insertRow: Record<string, unknown> = {
    tenant_id: tenantId,
    markbox,
    name,
    kommo_lead_id: leadId,
    tier: "regular",
    registration_channel: "kommo",
  };
  const email = (prefill.email ?? "").trim();
  const phone = (prefill.phone ?? "").trim();
  if (email) insertRow.email = email;
  if (phone) insertRow.phone = phone;
  const { error: insErr } = await supabase.from("clients").insert(insertRow);
  if (insErr) {
    // Race: dos conversiones del mismo lead a la vez → el índice único parcial
    // (clients_kommo_lead_unique) rebota el segundo. Re-leemos y devolvemos el ya creado.
    const { data: raced } = await findExisting();
    if (raced?.markbox) return { ok: true, markbox: raced.markbox, created: false };
    return { error: `No se pudo crear el cliente: ${insErr.message}` };
  }

  return { ok: true, markbox, created: true };
}
