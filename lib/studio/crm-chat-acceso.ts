import "server-only";

import type { createClient } from "@/lib/db/server";
import { accesoCrm } from "@/lib/studio/crm-acceso";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { getStudioAccess } from "@/lib/studio/rbac-guard";

/**
 * ¿Quien mira puede abrir el chat de Chatwoot desde el CRM (SDD-0648 §4)?
 *
 * Es la misma regla que decide si ve la pestaña Bandeja del CRM (SDD-0655,
 * `accesoCrm`): módulo `bandeja` por rol + flag `chatwoot_inbox`. Sin ella,
 * «Abrir chat» no se muestra, y la ruta del chat devuelve un aviso en vez de
 * rebotar al inicio.
 */
export async function puedeAbrirBandeja(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const [access, flags] = await Promise.all([getStudioAccess(supabase), listFeatureFlags(supabase)]);
  return accesoCrm(access.role, flags, access.overrides, access.grants).bandeja;
}
