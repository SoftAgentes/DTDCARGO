/**
 * Gate RBAC del módulo Servicios (catálogo) (SDD-0085 · hardening 2026-07-02).
 * Catálogo + matriz de oferta → commercial/operations (+admin).
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("service-catalog");
  return <>{children}</>;
}
