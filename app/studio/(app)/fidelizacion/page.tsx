/**
 * Fidelización & Referidos (SDD-0051, Slice B) — surface operable.
 *
 * Server component: lee en paralelo los queries puros de Slice A
 * (clientes con tier derivado + distribución por nivel + referidos +
 * KPIs del programa + top referidores) y delega la UI a FidelizacionClient
 * (4 tabs: Dashboard / Niveles / Referidos / Clientes).
 *
 * El motor de niveles deriva de `invoices` (sin tabla de tiers); los referidos
 * viven en `referrals` (migración 0098). RLS filtra por tenant.
 */

import { createClient } from "@/lib/db/server";
import {
  clientsWithTier,
  listReferrals,
  programStats,
  tierCounts,
  topReferrers,
} from "@/lib/studio/fidelizacion/queries";
import { FidelizacionClient } from "./_components/FidelizacionClient";

export const metadata = { title: "Fidelización & Referidos" };

export default async function FidelizacionPage() {
  const supabase = await createClient();

  const [clients, counts, referrals, stats, top] = await Promise.all([
    clientsWithTier(supabase),
    tierCounts(supabase),
    listReferrals(supabase),
    programStats(supabase),
    topReferrers(supabase, 5),
  ]);

  return (
    <FidelizacionClient
      clients={clients}
      tierCounts={counts}
      referrals={referrals}
      stats={stats}
      topReferrers={top}
    />
  );
}
