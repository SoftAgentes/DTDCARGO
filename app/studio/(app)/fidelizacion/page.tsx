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
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { canEditModule } from "@/lib/studio/rbac";
import {
  clientsWithTier,
  listReferrals,
  programStats,
  tierCounts,
  topReferrers,
} from "@/lib/studio/fidelizacion/queries";
import { getReferralSettings } from "@/lib/studio/fidelizacion/referral-settings-queries";
import { strandedReferralCredits } from "@/lib/studio/fidelizacion/referral-credit-queries";
import { FidelizacionClient } from "./_components/FidelizacionClient";

export const metadata = { title: "Fidelización & Referidos" };

export default async function FidelizacionPage() {
  const role = await requireModuleView("fidelizacion");

  const supabase = await createClient();

  const [clients, counts, referrals, stats, top, referralSettings, stranded] =
    await Promise.all([
      clientsWithTier(supabase),
      tierCounts(supabase),
      listReferrals(supabase),
      programStats(supabase),
      topReferrers(supabase, 5),
      getReferralSettings(supabase),
      // SDD-0495 · Créditos que quedaron 'aplicado' sobre una factura anulada
      // porque la reversión de `voidInvoice` no pudo hacerse. Gate: el
      // `requireModuleView("fidelizacion")` de arriba (commercial/support +
      // admin). La query NO devuelve código de factura: ese es dato del módulo
      // de dinero, y acá hay roles que no lo tienen.
      strandedReferralCredits(supabase),
    ]);

  // Aplicar un crédito MUEVE PLATA (SDD-0137): solo lo puede hacer quien edita
  // el módulo de dinero "accounting" (accounting/admin). El botón de la UI se
  // esconde para el resto; el gate REAL fail-closed vive en la server action.
  const canApplyCredit = canEditModule(role, "accounting");
  // Configurar los montos (SDD-0159): quien edita el módulo Fidelización. El
  // botón se esconde para el resto; el gate real vive en saveReferralSettingsAction.
  const canConfigure = canEditModule(role, "fidelizacion");

  return (
    <FidelizacionClient
      clients={clients}
      tierCounts={counts}
      referrals={referrals}
      stats={stats}
      topReferrers={top}
      canApplyCredit={canApplyCredit}
      referralSettings={referralSettings}
      canConfigure={canConfigure}
      strandedCredits={stranded.credits}
      strandedComplete={stranded.complete}
    />
  );
}
