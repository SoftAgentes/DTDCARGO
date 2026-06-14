/**
 * Gate RBAC de Agentes y Skills (SDD-0085) — admin only.
 * Config de agentes IA (SDD-0020). Cubre page + agentes/[skillSlug].
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
