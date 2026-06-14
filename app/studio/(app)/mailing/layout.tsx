/**
 * Gate RBAC del módulo Mailing (SDD-0085) — admin only.
 * Config de reglas de correo a clientes (mail-rule-engine).
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("mailing");
  return <>{children}</>;
}
