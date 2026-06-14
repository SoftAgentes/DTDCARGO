/**
 * Gate RBAC del módulo Costing & Margen (SDD-0085).
 * Márgenes (sensible) → solo accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("costing");
  return <>{children}</>;
}
