import "server-only";

import type { createClient } from "@/lib/db/server";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { moduleViewDenial } from "@/lib/studio/rbac-guard";

/**
 * ¿Quien mira puede abrir el chat de Chatwoot desde el CRM (SDD-0648 §4)?
 *
 * Son las mismas dos capas que el layout de la Bandeja: el rol, con
 * `requireModuleView("bandeja")`, y que la empresa la use, con el flag
 * `chatwoot_inbox`. Sin las dos, «Abrir chat» y «Conversaciones» no se
 * muestran, y la ruta del chat devuelve un aviso en vez de rebotar al tablero
 * de inicio.
 */
export async function puedeAbrirBandeja(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const [denegado, flags] = await Promise.all([
    moduleViewDenial(supabase, "bandeja"),
    listFeatureFlags(supabase),
  ]);
  return denegado === null && flags.chatwoot_inbox === true;
}
