/**
 * Gate RBAC del módulo Operarios PWA (SDD-0085).
 * Gestión de PINs de operario → operations (+admin). Los RPCs admin_* solo
 * validan tenant, NO rol → este gate (+ el de acción) es el control real.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { requireFeatureEnabled } from "@/lib/studio/feature-flag-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("operarios");
  // Feature flag `mobile_operator` (SDD-0240): hasta hoy sólo escondía el
  // link del sidebar y la URL seguía abriendo.
  await requireFeatureEnabled("operarios");
  return <>{children}</>;
}
