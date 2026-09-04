/**
 * Queries del Portal del Cliente para Reclamos (SDD-0101 · Slice B).
 *
 * Mismo criterio de aislamiento que el resto del portal (portal-queries.ts):
 * además de la RLS portal, derivamos el principal coherente y filtramos
 * EXPLÍCITO por tenant + Shipping Mark.
 *
 * El portal NO está bajo la frontera ESLint público↔ERP (esa solo cubre las
 * rutas públicas + lib/public + app/back), así que reusa los helpers PUROS de
 * `lib/studio/reclamos/claims-types` — una sola fuente de verdad de la máquina
 * de estados y los labels. Cero lógica de servidor importada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimStatus, ClaimType } from "@/lib/studio/reclamos/claims-types";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

/** Subconjunto de `client_claims` que el cliente ve en el portal (read-only). */
export type PortalClaimRow = {
  id: string;
  code: string;
  type: ClaimType;
  description: string;
  status: ClaimStatus;
  amountUsd: number;
  insured: boolean;
  shipmentCode: string | null;
  containerCode: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

/**
 * Reclamos del cliente logueado (tenant + Shipping Mark explícitos), recientes
 * primero. Hasta 100.
 */
export async function listMyClaims(
  supabase: SupabaseClient,
): Promise<PortalClaimRow[]> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return [];

  const { data, error } = await supabase
    .from("client_claims")
    .select(
      "id, claim_code, claim_type, description, status, amount_usd, insured, shipment_code, container_code, resolution_note, created_at",
    )
    .eq("tenant_id", principal.tenantId)
    .eq("client_markbox", principal.client.markbox)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    code: r.claim_code as string,
    type: r.claim_type as ClaimType,
    description: r.description as string,
    status: r.status as ClaimStatus,
    amountUsd: Number(r.amount_usd ?? 0),
    insured: r.insured === true,
    shipmentCode: (r.shipment_code as string | null) ?? null,
    containerCode: (r.container_code as string | null) ?? null,
    resolutionNote: (r.resolution_note as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}
