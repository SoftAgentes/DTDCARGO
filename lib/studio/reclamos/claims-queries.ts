/**
 * Queries puras del módulo Reclamos (SDD-0101 · Slice A).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/reclamos/page.tsx`. RLS filtra por tenant. Los montos
 * `numeric` llegan como string → se coercen a number con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  num,
  type ClientClaim,
  type ClaimFinancials,
  type ClaimPaymentMethod,
} from "./claims-types";

const CLAIM_COLUMNS =
  "id, tenant_id, claim_code, client_id, client_markbox, client_name, " +
  "shipment_id, shipment_code, container_code, claim_type, description, " +
  "amount_usd, insured, status, resolution_note, evaluated_at, resolved_at, " +
  "created_by, created_at, updated_at, deleted_at";

/** Coacciona la fila cruda (numeric→number) a ClientClaim tipado. */
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

/** Cruces contables del proveedor (SDD-0059) para el selector del puente (Slice C). */
export type ClaimOffsetOption = {
  id: string;
  amount_usd: number;
  status: string;
  claimed_on: string;
  shipment_id: string | null;
};

export async function listSupplierClaimOffsets(
  supabase: SupabaseClient,
): Promise<ClaimOffsetOption[]> {
  const { data, error } = await supabase
    .from("supplier_claim_offsets")
    .select("id, amount_usd, status, claimed_on, shipment_id")
    .is("deleted_at", null)
    .order("claimed_on", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[listSupplierClaimOffsets]", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    amount_usd: num(r.amount_usd),
    status: r.status as string,
    claimed_on: r.claimed_on as string,
    shipment_id: (r.shipment_id as string | null) ?? null,
  }));
}

/**
 * Resolución financiera por reclamo (Slice C) — tabla SEPARADA solo-equipo. La
 * RLS la filtra por tenant. Devuelve un Map claim_id → ClaimFinancials.
 */
export async function listClaimFinancials(
  supabase: SupabaseClient,
  claimIds: string[],
): Promise<Map<string, ClaimFinancials>> {
  const out = new Map<string, ClaimFinancials>();
  if (claimIds.length === 0) return out;

  const { data, error } = await supabase
    .from("client_claim_financials")
    .select(
      "claim_id, fault_party, supplier_claim_offset_id, insured_amount_usd, policy_deductible_usd, insurer_claim_ref, payment_method",
    )
    .in("claim_id", claimIds);

  if (error || !data) return out;

  for (const r of data) {
    out.set(r.claim_id as string, {
      claim_id: r.claim_id as string,
      fault_party: (r.fault_party as ClaimFinancials["fault_party"]) ?? null,
      supplier_claim_offset_id: (r.supplier_claim_offset_id as string | null) ?? null,
      insured_amount_usd:
        r.insured_amount_usd == null ? null : num(r.insured_amount_usd),
      policy_deductible_usd:
        r.policy_deductible_usd == null ? null : num(r.policy_deductible_usd),
      insurer_claim_ref: (r.insurer_claim_ref as string | null) ?? null,
      payment_method: (r.payment_method as ClaimPaymentMethod) ?? "transfer",
    });
  }
  return out;
}

/**
 * Código del asiento contable de la indemnización por reclamo (Slice C2) — para
 * mostrar el comprobante en el detalle. Map claim_id → entry_code (asentado).
 */
export async function listClaimEntryCodes(
  supabase: SupabaseClient,
  claimIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (claimIds.length === 0) return out;

  const { data, error } = await supabase
    .from("journal_entries")
    .select("claim_id, entry_code")
    .in("claim_id", claimIds)
    .eq("status", "asentado")
    .is("deleted_at", null);

  if (error || !data) return out;

  for (const r of data) {
    if (r.claim_id) out.set(r.claim_id as string, r.entry_code as string);
  }
  return out;
}
