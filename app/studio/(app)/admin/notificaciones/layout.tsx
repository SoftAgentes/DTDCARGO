/**
 * Gate RBAC de Notificaciones al cliente (SDD-0156) — admin only.
 * Configura qué avisa el ERP al cliente (canal · offset · texto · visibilidad).
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
