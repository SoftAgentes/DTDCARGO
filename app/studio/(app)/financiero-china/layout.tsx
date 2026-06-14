/**
 * Gate RBAC del módulo Financiero China (SDD-0085) — admin only.
 * Plata internacional/USDT — concentración sensible. Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("financiero-china");
  return <>{children}</>;
}
