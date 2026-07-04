/**
 * /m/erp/bitacora/tarea/[id] — detalle de tarea en el teléfono (SDD-0146).
 *
 * Meta + checklist tap-to-toggle + botón grande de avance. Auth = sesión
 * Supabase + gate de membership (igual que /m/erp). La RLS por tenant hace
 * que una tarea ajena simplemente "no exista" (404 suave → vuelta a Hoy).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { canEditModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  getTask,
  listAssignableProfiles,
} from "@/lib/studio/bitacora/bitacora-queries";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import { TareaDetailClient } from "./_components/TareaDetailClient";

export const metadata = {
  title: "Tarea · Bitácora · DoorTuDoor",
};

export const dynamic = "force-dynamic";

export default async function MobileBitacoraTareaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("role")
    .eq("user_id", userResp.user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: string }>();
  if (!link) {
    const { data: portalClientId } = await supabase.rpc("get_portal_client_id");
    redirect(portalClientId ? "/portal" : "/");
  }

  const [task, profiles] = await Promise.all([
    getTask(supabase, id),
    listAssignableProfiles(supabase),
  ]);

  // Tarea inexistente / de otro tenant (RLS) → vuelta a la vista Hoy.
  if (!task) redirect("/m/erp/bitacora");

  return (
    <TareaDetailClient
      task={task}
      profiles={profiles}
      myUserId={userResp.user.id}
      myRole={link.role}
      canEdit={canEditModule(link.role as StudioUserRole, "bitacora")}
      hoyISO={todayCaracasISO()}
    />
  );
}
