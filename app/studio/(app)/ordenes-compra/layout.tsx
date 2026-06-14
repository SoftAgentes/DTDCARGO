/**
 * Gate RBAC del módulo Órdenes de compra (SDD-0085).
 * Vista: commercial + operations + accounting (+admin). Cubre todo el subtree.
 * Ojo: recibir una OC crea una CxP (Tesorería) — ver gate de acción.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("purchase-orders");
  return <>{children}</>;
}
