/**
 * Gate RBAC del módulo cola-qr (SDD-0085).
 * cola de QR — cubre page + cola-qr/[id]/imprimir.
 *
 * Va en layout.tsx y no en page.tsx a propósito: un `page.tsx` NO envuelve a
 * sus sub-rutas, así que gatear solo la página dejaba `cola-qr/<algo>` abierto a
 * cualquier rol que tipeara la URL. El layout cubre el subtree entero.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { requireFeatureEnabled } from "@/lib/studio/feature-flag-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("qrqueue");
  // Feature flag `mobile_operator` (SDD-0240): hasta hoy sólo escondía el
  // link del sidebar y la URL seguía abriendo.
  await requireFeatureEnabled("qrqueue");
  return <>{children}</>;
}
