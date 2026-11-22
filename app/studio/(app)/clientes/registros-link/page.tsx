/**
 * Clientes › Registros por link (SDD-0646).
 *
 * Lo que cada cliente escribió al completar su ficha con el link de registro, al
 * lado de lo que tenía la ficha antes. El equipo lo revisa y lo marca
 * comprobado. Un posible duplicado se resuelve en «Posibles duplicados»: acá
 * nada se fusiona.
 *
 * Datos personales: la pantalla entera son nombres, cédulas, correos y
 * direcciones. Quien no puede ver nombres de clientes (equipo de China sin rol
 * admin, SDD-0531 / PIPL) no entra: el servidor no lee ni manda nada. Y
 * «Marcar comprobado» sólo se ofrece a quien puede editar clientes.
 */

import { createClient } from "@/lib/db/server";
import { getStudioAccess, requireModuleView } from "@/lib/studio/rbac-guard";
import { canEditModule } from "@/lib/studio/rbac";
import { readCanSeeClientNames } from "@/lib/studio/privacidad-cn";
import { listRegistrosPorLink } from "@/lib/studio/registro-link-queries";
import { RegistrosLinkClient } from "../_components/RegistrosLinkClient";

export const metadata = { title: "Registros por link" };

export default async function RegistrosLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("clients");

  const supabase = await createClient();
  const raw = await searchParams;
  const todos = raw.ver === "todos";

  if (!(await readCanSeeClientNames(supabase))) {
    return <RegistrosLinkClient rows={null} todos={todos} canEdit={false} sinAcceso />;
  }

  const access = await getStudioAccess(supabase);
  const canEdit = canEditModule(access.role, "clients", access.overrides, access.grants);
  const rows = await listRegistrosPorLink(supabase, { soloPendientes: !todos });

  return <RegistrosLinkClient rows={rows} todos={todos} canEdit={canEdit} />;
}
