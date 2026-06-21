import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { listMyClaims } from "@/lib/portal/portal-claims";
import { listMyShipments } from "@/lib/portal/portal-queries";
import { PortalClaims } from "./_components/PortalClaims";

export const metadata: Metadata = { title: "Mis reclamos" };

/**
 * "Mis reclamos" (SDD-0101 · Slice B). El cliente reporta un problema con su
 * carga (daño/faltante/retraso) y sigue el estado de sus reclamos, read-only.
 * El equipo gestiona el ciclo de vida desde el Studio (Slice A).
 */
export default async function PortalClaimsPage() {
  const supabase = await createClient();
  const [claims, shipments] = await Promise.all([
    listMyClaims(supabase),
    listMyShipments(supabase),
  ]);

  return (
    <PortalClaims
      claims={claims}
      shipments={shipments.map((s) => ({ id: s.id, code: s.code }))}
    />
  );
}
