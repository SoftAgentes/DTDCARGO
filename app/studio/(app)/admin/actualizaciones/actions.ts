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
 *  - `analizarConIa` (paso 3.4): arma un paquete solo de código (diff público de
 *    Chatwoot y la superficie de DTD) y lo manda al motor GLM; guarda el informe
 *    con service_role en `chatwoot_version_analyses`. Si el motor falla, guarda
 *    el informe sin IA. Tope diario, caché por salto y **nada se despliega**.
 */
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { VERSION_RE } from "@/lib/studio/chatwoot/versiones";
import { ultimaRevision } from "@/lib/studio/chatwoot/versiones-queries";
import { analizarSalto } from "@/lib/studio/chatwoot/analisis-motor";
import { leerSuperficieDtd } from "@/lib/studio/chatwoot/analisis-superficie";
import { RUTA_ACTUALIZACIONES, revisarAhora } from "@/lib/studio/chatwoot/versiones-vigilante";

/** Códigos de error; el panel los traduce. */
export type ActualizacionesErrorCode = "denied" | "invalid" | "stale" | "duplicate" | "tope" | "en_curso" | "service";

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

export async function analizarConIa(_prev: ActualizacionesState, formData: FormData): Promise<ActualizacionesState> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) return { ok: false, error: "denied" };

  const desde = formData.get("from_version");
  const hasta = formData.get("to_version");
  if (typeof desde !== "string" || typeof hasta !== "string" || !VERSION_RE.test(desde) || !VERSION_RE.test(hasta)) {
    return { ok: false, error: "invalid" };
  }

  // Solo el salto que muestra la última revisión: un formulario viejo no analiza
  // (ni gasta llamadas en) un salto que ya no es el pendiente.
  const revision = await ultimaRevision(supabase, gate.tenantId);
  if (!revision) return { ok: false, error: "service" };
  if (revision.estado !== "hay_nueva" || revision.instalada !== desde || revision.disponible !== hasta) {
    return { ok: false, error: "stale" };
  }

  const r = await analizarSalto({
    admin: createAdminClient(),
    tenantId: gate.tenantId,
    usuarioId: gate.userId,
    desde,
    hasta,
    checkId: revision.id,
    superficie: () => leerSuperficieDtd().archivos,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(RUTA_ACTUALIZACIONES);
  return { ok: true, error: null };
}
