/**
 * Gate RBAC del módulo Tesorería (SDD-0085).
 * Mueve plata → solo accounting (+admin). NUNCA operations/commercial.
 * Cubre todo el subtree. Gate de mutación: en las server actions.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("treasury");
  return <>{children}</>;
}
