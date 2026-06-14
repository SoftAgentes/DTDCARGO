/**
 * Gate RBAC del módulo Gastos (SDD-0085).
 * Vista: accounting + operations (operations registra, accounting paga).
 * Cubre todo el subtree. El pago/tesorería es accounting.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("expenses");
  return <>{children}</>;
}
