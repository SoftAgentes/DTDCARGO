/**
 * Reclamos y siniestros del cliente (SDD-0101 · Slice A).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch de reclamos, clientes
 * y embarques (para el drawer). Delega la UI a ReclamosClient (KPIs + filtros +
 * tabla + detalle con stepper + drawer crear/editar + avance de estado).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listClaims,
  listClaimClients,
  listClaimShipments,
} from "@/lib/studio/reclamos/claims-queries";
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

  return (
    <ReclamosClient
      claims={claims}
      clients={clients}
      shipments={shipments}
      canEdit={canEdit}
    />
  );
}
