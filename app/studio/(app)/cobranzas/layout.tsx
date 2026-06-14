/**
 * Gate RBAC del módulo Cobranzas (SDD-0085).
 * Cobros y recibos → solo accounting (+admin). Cubre page + cobranzas/recibo/[code].
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("collections");
  return <>{children}</>;
}
