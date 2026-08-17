/**
 * Queries del cruce contable reclamo→cliente (SDD-0059 · Slice A).
 * Funciones PURAS que reciben un SupabaseClient; RLS filtra por tenant_id.
 *
 * Máquina de estados lineal (§4.4):
 *   reclamado → reconocido_proveedor → pagado_en_china → aplicado_a_cliente
 *             → cerrado
 * Cada avance pasa por el guard `canTransitionClaimOffset` y sella la
 * fecha-hito que corresponde (CLAIM_OFFSET_STAGE_DATE_FIELD).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  CLAIM_OFFSET_NEXT,
  CLAIM_OFFSET_STAGE_DATE_FIELD,
  canTransitionClaimOffset,
  num,
  type ClaimOffsetInput,
  type ClaimOffsetStatus,
  type SupplierClaimOffset,
} from "./types";

const CLAIM_OFFSET_COLUMNS =
  "id, tenant_id, shipment_id, client_id, supplier_id, amount_usd, claimed_on, recognized_on, received_in_china_on, applied_to_client_on, evidence_document_id, status, client_invoice_id, journal_entry_id, created_at, deleted_at";

function coerceClaimOffset(r: Record<string, unknown>): SupplierClaimOffset {
  return {
    ...(r as unknown as SupplierClaimOffset),
    amount_usd: num(r.amount_usd),
  };
}

/** Lista los cruces (más reciente primero). RLS por tenant. */
export async function listClaimOffsets(
  supabase: SupabaseClient,
  status?: ClaimOffsetStatus,
): Promise<SupplierClaimOffset[]> {
  // Paginado: son los reclamos que compensan deuda con el socio.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) => {
      let q = supabase
        .from("supplier_claim_offsets")
        .select(CLAIM_OFFSET_COLUMNS)
        .order("claimed_on", { ascending: false })
        .order("id", { ascending: true });
    if (status) q = q.eq("status", status);
      return q.range(d, h);
    },
  );
  if (!complete) {
    throw new Error("Los reclamos superan el tope de lectura; filtra por estado.");
  }
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceClaimOffset,
  );
}

/** Crea un cruce en estado `reclamado`. RLS por tenant. */
export async function addClaimOffset(
  supabase: SupabaseClient,
  tenantId: string,
  input: ClaimOffsetInput,
): Promise<SupplierClaimOffset> {
  const { data, error } = await supabase
    .from("supplier_claim_offsets")
    .insert({
      tenant_id: tenantId,
      shipment_id: input.shipment_id,
      client_id: input.client_id,
      supplier_id: input.supplier_id,
      amount_usd: input.amount_usd,
      claimed_on: input.claimed_on ?? undefined,
      evidence_document_id: input.evidence_document_id,
      status: "reclamado",
    })
    .select(CLAIM_OFFSET_COLUMNS)
    .single();
  if (error) throw error;
  return coerceClaimOffset(data as Record<string, unknown>);
}

/**
 * Avanza el cruce al siguiente estado de la máquina con guard. Sella la
 * fecha-hito correspondiente (recognized_on / received_in_china_on /
 * applied_to_client_on) y, al `aplicado_a_cliente`, guarda client_invoice_id.
 * Throwea si la transición no es la siguiente válida. RLS por tenant.
 */
export async function transitionClaimOffset(
  supabase: SupabaseClient,
  claimId: string,
  from: ClaimOffsetStatus,
  to: ClaimOffsetStatus,
  opts?: { stageDate?: string; clientInvoiceId?: string },
): Promise<void> {
  if (!canTransitionClaimOffset(from, to)) {
    throw new Error(`Transición de cruce inválida: ${from} → ${to}`);
  }

  const patch: Record<string, unknown> = { status: to };

  const dateField = CLAIM_OFFSET_STAGE_DATE_FIELD[to];
  if (dateField) {
    patch[dateField] = opts?.stageDate ?? new Date().toISOString().slice(0, 10);
  }
  if (to === "aplicado_a_cliente" && opts?.clientInvoiceId) {
    patch.client_invoice_id = opts.clientInvoiceId;
  }

  const { error } = await supabase
    .from("supplier_claim_offsets")
    .update(patch)
    .eq("id", claimId)
    .eq("status", from) // optimistic: la fila debe seguir en `from`
    .is("deleted_at", null);
  if (error) throw error;
}

/**
 * Ejecuta el hito financiero R3 mediante el RPC gobernado de SDD-0227.
 * La base valida actor, tenant, rol, estado, idempotencia y auditoría.
 */
export async function markClaimOffsetPaidInChina(
  supabase: SupabaseClient,
  input: {
    claimId: string;
    effectiveDate: string;
    reason: string;
    requestRef: string;
  },
): Promise<"transitioned" | "replayed"> {
  const { data, error } = await supabase.rpc(
    "mark_claim_offset_paid_in_china_governed",
    {
      p_claim_id: input.claimId,
      p_effective_date: input.effectiveDate,
      p_reason: input.reason,
      p_request_ref: input.requestRef,
    },
  );
  if (error) throw error;
  if (data !== "transitioned" && data !== "replayed") {
    throw new Error("Respuesta inválida del pago gobernado.");
  }
  return data;
}

/** El siguiente estado válido del cruce (o null si es terminal). PURO. */
export function nextClaimOffsetStatus(
  status: ClaimOffsetStatus,
): ClaimOffsetStatus | null {
  return CLAIM_OFFSET_NEXT[status];
}
