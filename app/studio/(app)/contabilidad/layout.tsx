/**
 * Gate RBAC del módulo Contabilidad (SDD-0085).
 * Libros y asientos → solo accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("accounting");
  return <>{children}</>;
}
