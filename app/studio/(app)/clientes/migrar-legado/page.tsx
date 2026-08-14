/**
 * Clientes › Migrar códigos del legado (SDD-0258).
 *
 * Pasa por tandas las fichas con serie de VENDEDOR (`DTD-A101`, `DTD-j029`…) a
 * la serie limpia de la casa. Cada renombrado jubila su código viejo, que queda
 * reservado y sigue resolviendo.
 *
 * El candado real es de la base: `rename_legacy_markboxes` exige rol admin y
 * rechaza a cualquier otro con 42501. Acá se resuelve el rol sólo para no
 * ofrecerle un botón a quien la base va a rechazar.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView, getStudioRole } from "@/lib/studio/rbac-guard";
import { getLegacyResumen } from "@/lib/studio/markbox-legacy-queries";
import { MigrarLegadoClient } from "../_components/MigrarLegadoClient";

export const metadata = { title: "Migrar códigos del legado" };

export default async function MigrarLegadoPage() {
  await requireModuleView("clients");

  const supabase = await createClient();
  const [resumen, role] = await Promise.all([
    getLegacyResumen(supabase),
    getStudioRole(supabase),
  ]);

  return <MigrarLegadoClient resumen={resumen} esAdmin={role === "admin"} />;
}
