/**
 * Gate RBAC del módulo Órdenes de venta (SDD-0085).
 * Vista: commercial + operations + accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("sales-orders");
  return <>{children}</>;
}
