/**
 * Gate RBAC de Alertas de Telegram (SDD-0271) — admin only.
 * Configura a qué chat llega cada categoría de aviso interno del ERP.
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
