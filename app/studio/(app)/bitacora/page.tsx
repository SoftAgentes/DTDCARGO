/**
 * Bitácora — gestor de tareas del equipo (SDD-0146 · Fase 1).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch en paralelo de
 * tareas (con asignados + checklist embebidos) y pool de asignables → render
 * del orquestador client (tabs Tablero | Lista + drawer + cola por rol).
 *
 * Las actas con IA (capturar → confirmar) llegan en Fase 2 — esta fase es el
 * gestor manual completo en desktop y teléfono.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listAssignableProfiles,
  listTasks,
} from "@/lib/studio/bitacora/bitacora-queries";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import { BitacoraClient } from "./_components/BitacoraClient";

export const metadata = { title: "Bitácora · DTD Studio" };

export const dynamic = "force-dynamic";

export default async function BitacoraPage() {
  const role = await requireModuleView("bitacora");
  const canEdit = role !== "support";

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const myUserId = userResp.user?.id ?? null;

  const [tasks, profiles] = await Promise.all([
    listTasks(supabase, { includeDone: true, limit: 500 }),
    listAssignableProfiles(supabase),
  ]);

  return (
    <BitacoraClient
      tasks={tasks}
      profiles={profiles}
      canEdit={canEdit}
      myUserId={myUserId}
      myRole={role}
      hoyISO={todayCaracasISO()}
    />
  );
}
