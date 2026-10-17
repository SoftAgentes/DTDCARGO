/**
 * Gate RBAC del módulo Operarios PWA (SDD-0085).
 * Gestión de PINs de operario → operations (+admin), según la matriz de
 * módulos. La base repite el candado: desde 0475 (SDD-0515) la policy de
 * operario_pins y las RPC de alta, restablecimiento y «Ver PIN» autorizan con
 * la misma matriz, y desde 0480 (SDD-0529) también editar; activar/desactivar
 * sigue con admin|operations escrito a mano (0351/0475).
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("operarios");
  return <>{children}</>;
}
