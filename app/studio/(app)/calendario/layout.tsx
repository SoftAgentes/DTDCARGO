/**
 * Gate RBAC del módulo Calendario (SDD-0085 · hardening 2026-07-02).
 * Agenda operativa → commercial/operations/accounting/warehouse/support (+admin).
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("calendar");
  return <>{children}</>;
}
