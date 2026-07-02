/**
 * Gate RBAC del módulo Almacén VE (SDD-0085 · hardening 2026-07-02).
 * Recepción/despacho VE → operations/warehouse/support (+admin).
 * (La PWA de operario vive en /m/ve con auth por PIN — esto es la vista Studio.)
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("ve");
  return <>{children}</>;
}
