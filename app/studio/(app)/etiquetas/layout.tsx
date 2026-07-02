/**
 * Gate RBAC del módulo Etiquetas CN (SDD-0085 · hardening 2026-07-02).
 * Etiquetado de almacén → operations/warehouse (+admin).
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("labels");
  return <>{children}</>;
}
