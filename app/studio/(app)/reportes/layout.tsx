/**
 * Gate RBAC del módulo Reportes (SDD-0085).
 * Reportes financieros → solo accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("reports");
  return <>{children}</>;
}
