/**
 * Gate RBAC de Actualizaciones de Chatwoot (SDD-0588) — admin only.
 * Versión instalada, versión publicada y pedidos de actualización.
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
