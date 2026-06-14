/**
 * Gate RBAC del módulo Naviera & Consolidación (SDD-0085).
 * Vista: operations + accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("naviera");
  return <>{children}</>;
}
