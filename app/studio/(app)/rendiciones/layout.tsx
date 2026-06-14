/**
 * Gate RBAC del módulo Rendiciones (SDD-0085) — admin only.
 * Cubre page + rendiciones/[code].
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("renditions");
  return <>{children}</>;
}
