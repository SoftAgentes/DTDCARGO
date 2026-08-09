/**
 * Gate RBAC del módulo cotizador (SDD-0085).
 * cotizaciones — cubre page + cotizador/[code].
 *
 * Va en layout.tsx y no en page.tsx a propósito: un `page.tsx` NO envuelve a
 * sus sub-rutas, así que gatear solo la página dejaba `cotizador/<algo>` abierto a
 * cualquier rol que tipeara la URL. El layout cubre el subtree entero.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("quotes");
  return <>{children}</>;
}
