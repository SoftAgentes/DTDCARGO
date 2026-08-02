/**
 * Gate RBAC del módulo clientes (SDD-0085).
 * PII del cliente — cubre page + clientes/[markbox].
 *
 * Va en layout.tsx y no en page.tsx a propósito: un `page.tsx` NO envuelve a
 * sus sub-rutas, así que gatear solo la página dejaba `clientes/<algo>` abierto a
 * cualquier rol que tipeara la URL. El layout cubre el subtree entero.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("clients");
  return <>{children}</>;
}
