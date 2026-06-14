/**
 * Gate RBAC del módulo Fiscal · SENIAT (SDD-0085).
 * Declaraciones fiscales → solo accounting (+admin). Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("fiscal");
  return <>{children}</>;
}
