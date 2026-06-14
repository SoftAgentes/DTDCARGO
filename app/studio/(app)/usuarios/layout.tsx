/**
 * Gate RBAC del módulo Usuarios (SDD-0085) — keystone.
 * Gestión de usuarios y roles: SOLO admin. Yolimar=accounting NO admin.
 * Cubre todo el subtree (page + detalle). Gate de mutación: en las actions.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("users");
  return <>{children}</>;
}
