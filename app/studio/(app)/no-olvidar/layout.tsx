/**
 * Gate RBAC del módulo No-Olvidar (SDD-0085) — admin only.
 * Recovery custodial M-of-N (SDD-0025) — máxima sensibilidad.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("no-olvidar");
  return <>{children}</>;
}
