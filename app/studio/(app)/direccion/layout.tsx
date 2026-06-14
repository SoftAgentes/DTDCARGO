/**
 * Gate RBAC del módulo Dirección (SDD-0085) — admin only.
 * Tablero ejecutivo (SDD-0048). Refuerza el check admin-only existente.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("direccion");
  return <>{children}</>;
}
