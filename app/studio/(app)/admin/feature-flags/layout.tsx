/**
 * Gate RBAC de Feature flags (SDD-0085) — admin only.
 * Enciende/apaga módulos del tenant — sensible. Cubre todo el subtree.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("admin");
  return <>{children}</>;
}
