/**
 * Queries puras del módulo Reclamos (SDD-0101 · Slice A).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/reclamos/page.tsx`. RLS filtra por tenant. Los montos
 * `numeric` llegan como string → se coercen a number con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num, type ClientClaim } from "./claims-types";

const CLAIM_COLUMNS =
  "id, tenant_id, claim_code, client_id, client_markbox, client_name, " +
  "shipment_id, shipment_code, container_code, claim_type, description, " +
  "amount_usd, insured, status, resolution_note, evaluated_at, resolved_at, " +
  "created_by, created_at, updated_at, deleted_at";

/** Coacciona la fila cruda (amount_usd string) a ClientClaim tipado. */
function rowToClaim(row: Record<string, unknown>): ClientClaim {
  return {
    ...(row as ClientClaim),
    amount_usd: num(row.amount_usd),
    insured: row.insured === true,
  };
}

/** Lista los reclamos vivos del tenant, más nuevos primero. */
export async function listClaims(
  supabase: SupabaseClient,
): Promise<ClientClaim[]> {
  const { data, error } = await supabase
    .from("client_claims")
    .select(CLAIM_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClaims]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToClaim(r as unknown as Record<string, unknown>),
  );
}

/** Un reclamo por id (o null). */
export async function getClaim(
  supabase: SupabaseClient,
  id: string,
): Promise<ClientClaim | null> {
  const { data, error } = await supabase
    .from("client_claims")
    .select(CLAIM_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getClaim]", error.message);
    return null;
  }
  return data ? rowToClaim(data as unknown as Record<string, unknown>) : null;
}

/** Clientes vivos del tenant para el selector del drawer (markbox + nombre). */
export type ClaimClientOption = {
  id: string;
  markbox: string;
  name: string;
};

export async function listClaimClients(
  supabase: SupabaseClient,
): Promise<ClaimClientOption[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, markbox, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("[listClaimClients]", error.message);
    return [];
  }
  return (data ?? []) as ClaimClientOption[];
}

/** Embarques recientes del tenant para vincular el reclamo (opcional). */
export type ClaimShipmentOption = {
  id: string;
  code: string;
  client_markbox: string | null;
};

export async function listClaimShipments(
  supabase: SupabaseClient,
  limit = 200,
): Promise<ClaimShipmentOption[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, client_markbox")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listClaimShipments]", error.message);
    return [];
  }
  return (data ?? []) as ClaimShipmentOption[];
}
