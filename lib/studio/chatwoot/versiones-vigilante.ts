import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { drainOperarioPushOutbox, enqueueUserPush } from "@/lib/studio/notify/operario-push-outbox";
import { revisarVersiones } from "./versiones-fuentes";
import { guardarRevision, purgarRevisiones, ultimaRevision, type RevisionVersiones } from "./versiones-queries";

/**
 * Vigilante de versiones de Chatwoot (SDD-0588, paso 3.2): lee, guarda y avisa.
 *
 * 1. Lee la revisión anterior, revisa (`/api` y los releases) y guarda la nueva.
 * 2. Borra las revisiones de más de 180 días.
 * 3. Si aparece una versión nueva que la revisión anterior no mostraba, encola un
 *    push a los admins del tenant que lleva a Administración › Actualizaciones.
 *    No avisa dos veces por la misma versión ni avisa errores: un `/api` caído ya
 *    lo avisa Uptime Kuma (monitor «Chatwoot · API»).
 *
 * Nunca despliega ni toca Chatwoot: solo lee `/api`, que es pública.
 */

export const RUTA_ACTUALIZACIONES = "/studio/admin/actualizaciones";
/** «Revisar ahora» reutiliza una revisión de menos de esto (límite de GitHub sin token). */
export const REUSO_MS = 10 * 60_000;

export interface ContextoVersiones {
  admin: SupabaseClient;
  tenantId: string;
  origen: string;
  fetchImpl?: typeof fetch;
  ahora?: Date;
}

export interface SalidaVigilante {
  omitido: boolean;
  revision: RevisionVersiones | null;
  avisados: number;
}

async function avisarVersionNueva(ctx: ContextoVersiones, r: RevisionVersiones): Promise<number> {
  const { data } = await ctx.admin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);
  const seguridad = r.pendientes.some((p) => p.seguridad);
  const cuerpo = `Chatwoot ${r.disponible} está publicado; tienes la ${r.instalada}.${seguridad ? " Las notas mencionan seguridad." : ""}`;
  let encolados = 0;
  for (const fila of (data ?? []) as { user_id: string }[]) {
    const id = await enqueueUserPush(ctx.admin, ctx.tenantId, fila.user_id, {
      title: "Chatwoot · versión nueva",
      body: cuerpo,
      url: RUTA_ACTUALIZACIONES,
      tag: "chatwoot-version",
    });
    if (id) encolados += 1;
  }
  if (encolados > 0) await drainOperarioPushOutbox(ctx.admin);
  return encolados;
}

export async function vigilarVersiones(ctx: ContextoVersiones): Promise<SalidaVigilante> {
  // La última que leyó bien: un error en medio no hace avisar dos veces la misma versión.
  const previa = await ultimaRevision(ctx.admin, ctx.tenantId, { sinError: true });
  const resultado = await revisarVersiones(ctx.origen, ctx.fetchImpl);
  const revision = await guardarRevision(ctx.admin, ctx.tenantId, resultado);
  if (!revision) return { omitido: true, revision: null, avisados: 0 };
  await purgarRevisiones(ctx.admin, ctx.tenantId, 180, ctx.ahora);
  const nueva =
    revision.estado === "hay_nueva" && !(previa?.estado === "hay_nueva" && previa.disponible === revision.disponible);
  const avisados = nueva ? await avisarVersionNueva(ctx, revision) : 0;
  return { omitido: false, revision, avisados };
}

/** Para el botón «Revisar ahora»: la última si es reciente; si no, una revisión nueva. */
export async function revisarAhora(ctx: ContextoVersiones): Promise<SalidaVigilante> {
  const previa = await ultimaRevision(ctx.admin, ctx.tenantId);
  const ahora = (ctx.ahora ?? new Date()).getTime();
  if (previa && previa.estado !== "error" && ahora - new Date(previa.revisada).getTime() < REUSO_MS) {
    return { omitido: false, revision: previa, avisados: 0 };
  }
  return vigilarVersiones(ctx);
}
