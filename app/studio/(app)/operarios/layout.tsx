/**
 * Gate RBAC del módulo Operarios PWA (SDD-0085).
 * Gestión de PINs de operario → operations (+admin). Los RPCs admin_* solo
 * validan tenant, NO rol → este gate (+ el de acción) es el control real.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("operarios");
  return <>{children}</>;
}
