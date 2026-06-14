/**
 * Gate RBAC del módulo Legal · T&C (SDD-0085) — admin only.
 * Cubre page + legal/evidencia/[code] + legal/expediente/[code].
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("legal");
  return <>{children}</>;
}
