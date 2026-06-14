/**
 * Gate RBAC de Rutas y ciudades (SDD-0085) — operations (+admin).
 * NO es admin-only (config operativa); ver matriz "admin-rutas".
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("admin-rutas");
  return <>{children}</>;
}
