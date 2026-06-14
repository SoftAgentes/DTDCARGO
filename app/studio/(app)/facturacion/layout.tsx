/**
 * Gate RBAC del módulo Facturación (SDD-0085).
 * Facturas → solo accounting (+admin). Cubre page + facturacion/[code].
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("invoices");
  return <>{children}</>;
}
