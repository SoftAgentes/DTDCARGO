/**
 * SDD-0626 Paso 3b (D4) · El aviso de Discord cuando hay borradores esperando la revisión de Sam.
 *
 * Solo dice CUÁNTOS hay y el enlace a la página (detrás del inicio de sesión). NUNCA el texto del borrador, ni el
 * del cliente, ni el motivo: `MinimalAlert` (SDD-0606) no tiene dónde ponerlos. Va al canal de equipo, del tenant
 * de `DISCORD_TENANT_ID`; en staging Discord está apagado (SDD-0606). Nunca lanza.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendDiscordCategoryAlert } from "@/lib/studio/alerts/dispatch-alert";
import type { MinimalAlert } from "@/lib/studio/discord/minimal-alert";

export const RUTA_REVISION = "/studio/admin/oficina-virtual";

export function avisoDePendientes(pendientes: number, sitio: string | undefined): MinimalAlert {
  const n = Math.max(0, Math.trunc(pendientes));
  return {
    titulo: n === 1 ? "Oficina_Virtual: hay 1 borrador pendiente de revisión" : `Oficina_Virtual: hay ${n} borradores pendientes de revisión`,
    url: sitio ? `${sitio.replace(/\/+$/, "")}${RUTA_REVISION}` : null,
    conteos: [{ etiqueta: "Pendientes", valor: n }],
  };
}

export async function avisarPendientesADiscord(
  admin: SupabaseClient,
  pendientes: number,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<void> {
  const tenant = (env.DISCORD_TENANT_ID ?? "").trim();
  if (!tenant) return;
  try {
    await sendDiscordCategoryAlert(admin, tenant, "equipo", avisoDePendientes(pendientes, env.NEXT_PUBLIC_SITE_URL), {
      logTag: "oficina-pendientes",
    });
  } catch {
    // El aviso nunca frena al despachador.
  }
}
