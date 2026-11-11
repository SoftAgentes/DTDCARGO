/**
 * Gate del módulo Bandeja (SDD-0585).
 *
 * Dos capas, dos preguntas distintas, como en `seniat/layout.tsx`:
 *  - `requireModuleView("bandeja")` — ¿tu ROL puede verla?
 *  - `requireFeatureEnabled("bandeja")` — ¿esta empresa la usa? (flag
 *    `chatwoot_inbox`, apagado hasta que el token y los vínculos estén listos)
 *
 * En el layout y no en `page.tsx`: cubre cualquier sub-ruta que nazca después.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { requireFeatureEnabled } from "@/lib/studio/feature-flag-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("bandeja");
  await requireFeatureEnabled("bandeja");
  return <>{children}</>;
}
