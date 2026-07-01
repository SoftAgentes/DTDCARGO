import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { listMyClaims } from "@/lib/portal/portal-claims";
import { listMyShipments } from "@/lib/portal/portal-queries";
import {
  listClaimEvidence,
  type ClaimEvidenceItem,
} from "@/lib/studio/reclamos/claim-evidence";
import { PortalClaims } from "./_components/PortalClaims";
import { SoporteHubTabs } from "../../_components/PortalHubTabs";

export const metadata: Metadata = { title: "Mis reclamos" };

/**
 * "Mis reclamos" (SDD-0101 · Slice B + B2). El cliente reporta un problema con su
 * carga (daño/faltante/retraso), adjunta fotos opcionales y sigue el estado de
 * sus reclamos, read-only. El equipo gestiona el ciclo de vida desde el Studio.
 */
export default async function PortalClaimsPage() {
  const supabase = await createClient();
  const [claims, shipments] = await Promise.all([
    listMyClaims(supabase),
    listMyShipments(supabase),
  ]);

  // Evidencia firmada: lee con el user client (la RLS portal la filtra por
  // markbox) y firma con admin (el cliente no matchea la storage RLS por tenant).
  const evidenceMap = await listClaimEvidence(
    supabase,
    createAdminClient(),
    claims.map((c) => c.id),
  );
  const evidence: Record<string, ClaimEvidenceItem[]> = {};
  for (const [k, v] of evidenceMap) evidence[k] = v;

  return (
    <div>
      <SoporteHubTabs />
      <PortalClaims
        claims={claims}
        shipments={shipments.map((s) => ({ id: s.id, code: s.code }))}
        evidence={evidence}
      />
    </div>
  );
}
