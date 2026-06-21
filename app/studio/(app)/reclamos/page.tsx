/**
 * Reclamos y siniestros del cliente (SDD-0101 · Slice A + B2 + C + C2).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch de reclamos, clientes,
 * embarques, evidencia firmada y —solo para accounting/admin— los cruces de
 * proveedor, la resolución financiera (tabla separada solo-equipo) y el código
 * del asiento contable de la indemnización (C2). `canFinance` gatea todo eso.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listClaims,
  listClaimClients,
  listClaimShipments,
  listSupplierClaimOffsets,
  listClaimFinancials,
  listClaimEntryCodes,
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

  // Resolución financiera + asiento contable: SOLO si el rol puede verla.
  const financials: Record<string, ClaimFinancials> = {};
  const entryCodes: Record<string, string> = {};
  if (canFinance) {
    const ids = claims.map((c) => c.id);
    const [finMap, ecMap] = await Promise.all([
      listClaimFinancials(supabase, ids),
      listClaimEntryCodes(supabase, ids),
    ]);
    for (const [k, v] of finMap) financials[k] = v;
    for (const [k, v] of ecMap) entryCodes[k] = v;
  }

  return (
    <ReclamosClient
      claims={claims}
      clients={clients}
      shipments={shipments}
      evidence={evidence}
      offsets={offsets}
      financials={financials}
      entryCodes={entryCodes}
      canEdit={canEdit}
      canFinance={canFinance}
    />
  );
}
