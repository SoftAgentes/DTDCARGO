/**
 * `/studio/legal` — la Capa Legal dejó de ser módulo suelto: el Norte la ubica
 * DENTRO de Administración → INTERMEDIO (secciones "Documentación legal" +
 * "Aceptaciones T&C"). Este índice solo redirige allá. Los sub-routes de
 * expediente/evidencia (`/studio/legal/expediente/[code]`,
 * `/studio/legal/evidencia/[code]` · SDD-0070) siguen vivos: los usa el buscador
 * de expediente de defensa y los links de cada acuse.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegalPage() {
  redirect("/studio/admin?section=legal-docs");
}
