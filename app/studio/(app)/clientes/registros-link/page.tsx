/**
 * Clientes › Registros por link (SDD-0646).
 *
 * Lo que cada cliente escribió al completar su ficha con el link de registro, al
 * lado de lo que tenía la ficha antes. El equipo lo revisa y lo marca
 * comprobado. Un posible duplicado se resuelve en «Posibles duplicados»: acá
 * nada se fusiona.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listRegistrosPorLink } from "@/lib/studio/registro-link-queries";
import { RegistrosLinkClient } from "../_components/RegistrosLinkClient";

export const metadata = { title: "Registros por link" };

export default async function RegistrosLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("clients");

  const raw = await searchParams;
  const todos = raw.ver === "todos";
  const supabase = await createClient();
  const rows = await listRegistrosPorLink(supabase, { soloPendientes: !todos });

  return <RegistrosLinkClient rows={rows} todos={todos} />;
}
