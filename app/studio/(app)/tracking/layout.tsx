/**
 * Gate RBAC del módulo tracking (SDD-0085).
 * embarques — cubre page + tracking/[id] + tracking/nuevo (alta).
 *
 * Va en layout.tsx y no en page.tsx a propósito: un `page.tsx` NO envuelve a
 * sus sub-rutas, así que gatear solo la página dejaba `tracking/<algo>` abierto a
 * cualquier rol que tipeara la URL. El layout cubre el subtree entero.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("tracking");
  return <>{children}</>;
}
