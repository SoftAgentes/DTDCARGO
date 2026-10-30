"use server";

/**
 * Server actions de Administración › Actualizaciones (SDD-0588, paso 3.3).
 * Solo admin, cada una con su gate: la pantalla escondida no es una barrera.
 *
 *  - `revisarVersionesAhora`: corre el vigilante (3.2) para el tenant del admin.
 *    Reutiliza una revisión de menos de 10 min (límite de GitHub sin token).
 *    Escribe la revisión con service_role, como el cron.
 *  - `pedirActualizacion`: deja el pedido en `chatwoot_update_requests` con el
 *    cliente del propio admin (la RLS exige admin, su tenant y requested_by =
 *    auth.uid()). **No despliega nada** (E3-D1): la subida sigue
 *    docs/runbooks/chatwoot-versiones.md con el OK nominal de Sam. Solo se puede
 *    pedir la versión que la última revisión muestra como disponible.
 */
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { VERSION_RE } from "@/lib/studio/chatwoot/versiones";
import { ultimaRevision } from "@/lib/studio/chatwoot/versiones-queries";
import { RUTA_ACTUALIZACIONES, revisarAhora } from "@/lib/studio/chatwoot/versiones-vigilante";

/** Códigos de error; el panel los traduce. */
export type ActualizacionesErrorCode = "denied" | "invalid" | "stale" | "duplicate" | "service";

export interface ActualizacionesState {
  ok: boolean;
  error: ActualizacionesErrorCode | null;
}

export async function revisarVersionesAhora(): Promise<ActualizacionesState> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) return { ok: false, error: "denied" };

  const r = await revisarAhora({ admin: createAdminClient(), tenantId: gate.tenantId, origen: chatwootOriginFromEnv() });
  if (r.omitido) return { ok: false, error: "service" };
  revalidatePath(RUTA_ACTUALIZACIONES);
  return { ok: true, error: null };
}

export async function pedirActualizacion(_prev: ActualizacionesState, formData: FormData): Promise<ActualizacionesState> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) return { ok: false, error: "denied" };

  const hasta = formData.get("to_version");
  if (typeof hasta !== "string" || !VERSION_RE.test(hasta)) return { ok: false, error: "invalid" };

  // La versión pedida tiene que ser la que muestra la última revisión: un
  // formulario viejo no pide una versión que ya no es la disponible.
  const revision = await ultimaRevision(supabase, gate.tenantId);
  if (!revision) return { ok: false, error: "service" };
  if (revision.estado !== "hay_nueva" || revision.disponible !== hasta || !revision.instalada) {
    return { ok: false, error: "stale" };
  }

  const { error } = await supabase.from("chatwoot_update_requests").insert({
    tenant_id: gate.tenantId,
    from_version: revision.instalada,
    to_version: hasta,
    check_id: revision.id,
    requested_by: gate.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    console.warn(`[chatwoot-versiones] no se guardó el pedido: ${error.code ?? "sin código"}`);
    return { ok: false, error: "service" };
  }
  revalidatePath(RUTA_ACTUALIZACIONES);
  return { ok: true, error: null };
}
