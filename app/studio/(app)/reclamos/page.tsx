/**
 * Reclamos y siniestros del cliente (SDD-0101 · Slice A + B2).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch de reclamos, clientes,
 * embarques y la evidencia firmada de cada reclamo. Delega la UI a ReclamosClient.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listClaims,
  listClaimClients,
  listClaimShipments,
} from "@/lib/studio/reclamos/claims-queries";
import {
  listClaimEvidence,
  type ClaimEvidenceItem,
} from "@/lib/studio/reclamos/claim-evidence";
import { ReclamosClient } from "./_components/ReclamosClient";

export const metadata = { title: "Reclamos y siniestros · DTD Studio" };

export default async function ReclamosPage() {
  const role = await requireModuleView("reclamos");
  const canEdit = role !== "support";

  const supabase = await createClient();
  const [claims, clients, shipments] = await Promise.all([
    listClaims(supabase),
    listClaimClients(supabase),
    listClaimShipments(supabase),
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

  return (
    <ReclamosClient
      claims={claims}
      clients={clients}
      shipments={shipments}
      evidence={evidence}
      canEdit={canEdit}
    />
  );
}
