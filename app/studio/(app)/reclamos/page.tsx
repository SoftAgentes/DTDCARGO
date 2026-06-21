/**
 * Reclamos y siniestros del cliente (SDD-0101 · Slice A + B2 + C).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch de reclamos, clientes,
 * embarques, evidencia firmada y —solo para accounting/admin— los cruces de
 * proveedor y la resolución financiera (tabla separada solo-equipo). `canFinance`
 * gatea la carga Y el render de la sección financiera.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listClaims,
  listClaimClients,
  listClaimShipments,
  listSupplierClaimOffsets,
  listClaimFinancials,
} from "@/lib/studio/reclamos/claims-queries";
import {
  listClaimEvidence,
  type ClaimEvidenceItem,
} from "@/lib/studio/reclamos/claim-evidence";
import type { ClaimFinancials } from "@/lib/studio/reclamos/claims-types";
import { ReclamosClient } from "./_components/ReclamosClient";

export const metadata = { title: "Reclamos y siniestros · DTD Studio" };

export default async function ReclamosPage() {
  const role = await requireModuleView("reclamos");
  const canEdit = role !== "support";
  const canFinance = role === "accounting" || role === "admin";

  const supabase = await createClient();
  const [claims, clients, shipments, offsets] = await Promise.all([
    listClaims(supabase),
    listClaimClients(supabase),
    listClaimShipments(supabase),
    canFinance ? listSupplierClaimOffsets(supabase) : Promise.resolve([]),
  ]);

  // Evidencia firmada: el equipo lee y firma con el mismo user client (matchea
  // la storage RLS por tenant).
  const evidenceMap = await listClaimEvidence(
    supabase,
    supabase,
    claims.map((c) => c.id),
  );
  const evidence: Record<string, ClaimEvidenceItem[]> = {};
  for (const [k, v] of evidenceMap) evidence[k] = v;

  // Resolución financiera: SOLO si el rol puede verla (tabla separada solo-equipo).
  const financials: Record<string, ClaimFinancials> = {};
  if (canFinance) {
    const finMap = await listClaimFinancials(
      supabase,
      claims.map((c) => c.id),
    );
    for (const [k, v] of finMap) financials[k] = v;
  }

  return (
    <ReclamosClient
      claims={claims}
      clients={clients}
      shipments={shipments}
      evidence={evidence}
      offsets={offsets}
      financials={financials}
      canEdit={canEdit}
      canFinance={canFinance}
    />
  );
}
