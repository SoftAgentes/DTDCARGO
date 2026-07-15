/**
 * /m/erp/bitacora — vista HOY de Bitácora en el teléfono (SDD-0146 · Fase 1).
 *
 * Ruta real de la PWA staff (destino del push del digest en Fase 5). Auth =
 * sesión Supabase + gate de membership, igual que /m/erp. "Hoy" se calcula
 * server-side en America/Caracas (nunca con el reloj del browser/server UTC).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { canEditModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  listAssignableProfiles,
  listTasks,
} from "@/lib/studio/bitacora/bitacora-queries";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import { HoyClient } from "./_components/HoyClient";

export const metadata = {
  title: "Bitácora · Hoy",
  description: "Tus tareas del día: atrasadas, para hoy y próximas.",
};

export const dynamic = "force-dynamic";

export default async function MobileBitacoraHoyPage() {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  // GATE de membresía (misma regla que /m/erp): el portal cliente comparte
  // Supabase Auth → sesión válida ≠ acceso al ERP móvil.
  const { data: link } = await supabase
    .from("user_tenants")
    .select("role, tenant_id")
    .eq("user_id", userResp.user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: string; tenant_id: string }>();
  if (!link) {
    const { data: portalClientId } = await supabase.rpc("get_portal_client_id");
    redirect(portalClientId ? "/portal" : "/");
  }

  const [tasks, profiles] = await Promise.all([
    listTasks(supabase, {}), // solo abiertas (la vista Hoy es lo accionable)
    listAssignableProfiles(supabase),
  ]);

  return (
    <HoyClient
      tasks={tasks}
      profiles={profiles}
      myUserId={userResp.user.id}
      myRole={link.role}
      canEdit={canEditModule(link.role as StudioUserRole, "bitacora")}
      hoyISO={todayCaracasISO()}
      tenantId={link.tenant_id ?? null}
    />
  );
}
