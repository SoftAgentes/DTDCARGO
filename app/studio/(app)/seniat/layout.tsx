/**
 * Gate del módulo Aduana SENIAT.
 *
 * Dos capas, dos preguntas distintas:
 *  - `requireModuleView("seniat")` (SDD-0085) — ¿tu ROL puede verlo?
 *  - `requireFeatureEnabled("seniat")` (SDD-0240) — ¿esta empresa lo usa?
 *
 * El gate de rol vivía en `page.tsx`, que **no envuelve a los hijos**: si el
 * módulo crece con una sub-ruta, nace abierta. Acá cubre el subtree completo,
 * y `page.tsx` deja de tener que acordarse.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { requireFeatureEnabled } from "@/lib/studio/feature-flag-guard";

export default async function ModuleGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("seniat");
  // Feature flag `customs_seniat`: hasta hoy sólo escondía el link del
  // sidebar y la URL seguía abriendo.
  await requireFeatureEnabled("seniat");
  return <>{children}</>;
}
