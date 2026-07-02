/**
 * Gate RBAC del módulo Noticias Web (SDD-0085 · hardening 2026-07-02).
 * Motor de noticias → marketing/commercial/support (+admin). Las actions
 * además exigen admin (requireAdminWithTenant) para publicar.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("noticias-web");
  return <>{children}</>;
}
