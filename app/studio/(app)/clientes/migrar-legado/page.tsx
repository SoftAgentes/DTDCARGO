/**
 * Clientes › Migrar códigos del legado (SDD-0258).
 *
 * Pasa por tandas las fichas con serie de VENDEDOR (`DTD-A101`, `DTD-j029`…) al
 * rango `DTD-8xxx`, separado de la serie viva de la casa. Cada renombrado jubila
 * su código viejo, que queda reservado y sigue resolviendo.
 *
 * ⚠️ ESTA PÁGINA NO CUENTA NADA POR SU CUENTA. Antes resolvía el conteo y el
 * desglose con una consulta propia, y esa consulta se desincronizó de la base en
 * cuatro horas (marcaba 201 donde la base contaba 361). Ahora todos los números
 * los pide la propia función que ejecuta, en simulacro — así lo que se ve y lo
 * que se hace no pueden discrepar.
 *
 * El candado real es de la base: `rename_legacy_markboxes` exige rol admin y
 * rechaza a cualquier otro con 42501. Acá se resuelve el rol sólo para no
 * ofrecerle un botón a quien la base va a rechazar.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView, getStudioRole } from "@/lib/studio/rbac-guard";
import { MigrarLegadoClient } from "../_components/MigrarLegadoClient";

export const metadata = { title: "Migrar códigos del legado" };

export default async function MigrarLegadoPage() {
  await requireModuleView("clients");

  const supabase = await createClient();
  const role = await getStudioRole(supabase);

  return <MigrarLegadoClient esAdmin={role === "admin"} />;
}
