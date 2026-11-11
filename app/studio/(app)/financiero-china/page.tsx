/**
 * Financiero con el Socio China (SDD-0059 · Slice B2) — page server component.
 *
 * Admin-only (módulo financiero sensible, mismo gate que Dirección/Legal):
 * resuelve el rol vía user_tenants.role; no-admin → redirect /studio/dashboard.
 *
 * Compone los datos de Slice A + B1 (lib/studio/partner-finance/) y delega la
 * UI a FinancieroChinaClient (3 vistas en tabs: reconciliación · cuenta
 * corriente · cargos). Sin recálculo: el saldo neto / net_amount los derivan
 * las queries puras.
 *
 * Diseño de referencia (Norte v2.4):
 *  - erp/modules/conciliacion.jsx   → cola de reconciliación.
 *  - pantallas/estado-cuenta.jsx    → cuenta corriente con runBalance.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listSuppliers } from "@/lib/studio/treasury/supplier-queries";
import { listStatements } from "@/lib/studio/partner-finance/statements-queries";
import { listCharges } from "@/lib/studio/partner-finance/charges-queries";
import { listConversions, getForexRevenue } from "@/lib/studio/partner-finance/conversions-queries";
import { listClaimOffsets } from "@/lib/studio/partner-finance/claim-offsets-queries";
import { listOverduePartnerBills } from "@/lib/studio/partner-finance/alerts-queries";
import {
  getPartnerBalance,
  listLedgerEntries,
} from "@/lib/studio/partner-finance/ledger-queries";
import { getPartnerFinanceHealth } from "@/lib/studio/partner-finance/posting-health-queries";
import { FinancieroChinaClient } from "./_components/FinancieroChinaClient";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Financiero China · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function FinancieroChinaPage() {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("financiero-china");

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pediles a un admin que te agregue al equipo."
      />
    );
  }

  // Admin-only (decisión §3: roles CEO·Gerente·Contabilidad·Administración →
  // gate binario admin en el modelo de roles actual, igual que Dirección).
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  // Socios candidatos = proveedores con country CN (el Socio China es uno de
  // ellos). Listamos todos los proveedores; el operador elige el socio.
  const suppliers = await listSuppliers(supabase);
  const partnerSuppliers = suppliers
    .filter((s) => s.country === "CN" || s.type === "proveedor_cn")
    .map((s) => ({
      id: s.id,
      code: s.supplier_code,
      name: s.name,
      name_cn: s.name_cn,
    }));

  // Fallback: si ninguno matchea country/type, ofrecer todos (no bloquear).
  const supplierOptions =
    partnerSuppliers.length > 0
      ? partnerSuppliers
      : suppliers.map((s) => ({
          id: s.id,
          code: s.supplier_code,
          name: s.name,
          name_cn: s.name_cn,
        }));

  // Socio por defecto (primero de la lista) para cuenta corriente + cargos.
  const defaultSupplierId = supplierOptions[0]?.id ?? null;

  const [
    statements,
    charges,
    ledgerEntries,
    balance,
    health,
    conversions,
    forexRevenue,
    claimOffsets,
    overdueBillAlerts,
  ] = await Promise.all([
    listStatements(supabase),
    defaultSupplierId ? listCharges(supabase, defaultSupplierId) : Promise.resolve([]),
    defaultSupplierId
      ? listLedgerEntries(supabase, defaultSupplierId)
      : Promise.resolve([]),
    defaultSupplierId
      ? getPartnerBalance(supabase, defaultSupplierId)
      : Promise.resolve({ net_usd: 0, net_rmb: 0, entry_count: 0 }),
    getPartnerFinanceHealth(supabase),
    listConversions(supabase),
    getForexRevenue(supabase),
    listClaimOffsets(supabase),
    listOverduePartnerBills(supabase),
  ]);

  return (
    <FinancieroChinaClient
      suppliers={supplierOptions}
      defaultSupplierId={defaultSupplierId}
      statements={statements}
      charges={charges}
      ledgerEntries={ledgerEntries}
      balance={balance}
      health={health}
      conversions={conversions}
      forexRevenue={forexRevenue}
      claimOffsets={claimOffsets}
      overdueBillAlerts={overdueBillAlerts}
    />
  );
}
