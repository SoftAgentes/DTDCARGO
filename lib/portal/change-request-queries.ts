/**
 * Queries de solicitudes de cambio de datos del cliente (SDD-0151). Funciones
 * puras que reciben un SupabaseClient (patrón lib/studio/*-queries):
 *  - `getOpenChangeRequest`  → la PENDING del cliente (o null). La usa el portal
 *    (para mostrar "En revisión" y bloquear reenvío) y el Studio (para aprobar).
 *  - `getLastResolvedRequest` → la última approved/rejected (para mostrarle al
 *    cliente la nota del rechazo y que pueda corregir).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapChangeRequestRow,
  type ClientChangeRequest,
} from "./change-request-types";

const COLS =
  "id, tenant_id, client_id, proposed_name, proposed_rif, proposed_phone, prev_name, prev_rif, prev_phone, status, submitted_at, reviewed_at, reviewed_by, review_note";

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

/** La última solicitud ya resuelta (approved/rejected) del cliente, o null. */
export async function getLastResolvedRequest(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientChangeRequest | null> {
  const { data, error } = await supabase
    .from("client_change_requests")
    .select(COLS)
    .eq("client_id", clientId)
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapChangeRequestRow(data as Parameters<typeof mapChangeRequestRow>[0]);
}
