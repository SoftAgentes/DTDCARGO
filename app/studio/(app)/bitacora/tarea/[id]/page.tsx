/**
 * Deep-link de tarea (desktop) — SDD-0146 · Fase 4.
 *
 * Destino del enlace de la bandeja de menciones (/studio/menciones) para
 * `entity_type = 'bitacora_task'`. La bandeja usa `entityHref` que DEBE ser una
 * ruta limpia (sin query string, invariante del sistema 0045); esta ruta traduce
 * `/studio/bitacora/tarea/{id}` → `/studio/bitacora?task={id}`, donde el tablero
 * abre el drawer de la tarea. Gate de módulo antes de redirigir.
 */

import { redirect } from "next/navigation";
import { requireModuleView } from "@/lib/studio/rbac-guard";

export const metadata = { title: "Tarea · Bitácora · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function BitacoraTaskDeepLink({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleView("bitacora");
  const { id } = await params;
  redirect(`/studio/bitacora?task=${encodeURIComponent(id)}`);
}
