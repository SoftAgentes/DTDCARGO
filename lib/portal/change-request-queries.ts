/**
 * Queries de solicitudes de cambio de datos del cliente (SDD-0151). Funciones
 * puras que reciben un SupabaseClient (patrón lib/studio/*-queries):
 *  - `getOpenChangeRequest`  → la PENDING del cliente (o null). La usa el portal
 *    (para mostrar "En revisión" y bloquear reenvío) y el Studio (para aprobar).
 *  - `getLastResolvedRequest` → la última approved/rejected (para mostrarle al
 *    cliente la nota del rechazo y que pueda corregir).
 *  - `listResolvedChangeRequests` → historial de resueltas (para el Studio).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapChangeRequestRow,
  type ClientChangeRequest,
} from "./change-request-types";

const COLS =
  "id, tenant_id, client_id, proposed_name, proposed_rif, proposed_phone, prev_name, prev_rif, prev_phone, status, source, submitted_at, reviewed_at, reviewed_by, review_note";

/** La solicitud PENDING del cliente, o null si no tiene ninguna abierta. */
export async function getOpenChangeRequest(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientChangeRequest | null> {
  const { data, error } = await supabase
    .from("client_change_requests")
    .select(COLS)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .maybeSingle();
  if (error || !data) return null;
  return mapChangeRequestRow(data as Parameters<typeof mapChangeRequestRow>[0]);
}

/**
 * Historial de cambios de identidad ya resueltos del cliente, más reciente
 * primero. Lo usa la ficha del Studio para dar traza: incluye TANTO lo que el
 * cliente propuso (source='client', approved/rejected) COMO los edits directos
 * del equipo (source='admin', approved). Las canceladas por el cliente se
 * borran → no aparecen. Read-only.
 */
export async function listResolvedChangeRequests(
  supabase: SupabaseClient,
  clientId: string,
  limit = 20,
): Promise<ClientChangeRequest[]> {
  const { data, error } = await supabase
    .from("client_change_requests")
    .select(COLS)
    .eq("client_id", clientId)
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) =>
    mapChangeRequestRow(r as Parameters<typeof mapChangeRequestRow>[0]),
  );
}

/**
 * Resuelve `reviewed_by` (uuid de auth.users) → nombre visible del revisor
 * (first + last de user_profiles), para mostrar QUIÉN revisó/editó en el
 * historial del Studio. Devuelve un mapa {userId: nombre}; ids sin nombre se
 * omiten. Best-effort: ante error → mapa vacío (el historial degrada sin nombre).
 */
export async function resolveReviewerNames(
  supabase: SupabaseClient,
  userIds: Array<string | null>,
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((v): v is string => !!v))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", ids);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const r of data) {
    const row = r as {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
    };
    const name = [row.first_name, row.last_name]
      .filter((s) => s && s.trim())
      .join(" ")
      .trim();
    if (name) map[row.user_id] = name;
  }
  return map;
}

/** La última solicitud ya resuelta (approved/rejected) del cliente, o null. */
export async function getLastResolvedRequest(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientChangeRequest | null> {
  const { data, error } = await supabase
    .from("client_change_requests")
    .select(COLS)
    .eq("client_id", clientId)
    .eq("source", "client")
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapChangeRequestRow(data as Parameters<typeof mapChangeRequestRow>[0]);
}
