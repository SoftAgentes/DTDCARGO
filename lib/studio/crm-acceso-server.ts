/**
 * Lectura en servidor del acceso a las pestañas del CRM (SDD-0655): rol,
 * desvíos y accesos extra de la sesión (`getStudioAccess`) más los flags del
 * tenant. La decisión es la de `accesoCrm`, la misma que usa el menú.
 *
 * Es cosmético (qué pestañas se pintan): el candado de cada ruta sigue en su
 * layout — `requireModuleView("kommo")` en CRM, y rol + flag en la Bandeja.
 * Si la lectura falla, ninguna pestaña extra: fail-closed sin tumbar la página.
 */
import { createClient } from "@/lib/db/server";
import { getStudioAccess } from "./rbac-guard";
import { listFeatureFlags } from "./feature-flags-queries";
import { accesoCrm, type AccesoCrm } from "./crm-acceso";

export async function leerAccesoCrm(): Promise<AccesoCrm> {
  try {
    const supabase = await createClient();
    const [access, flags] = await Promise.all([getStudioAccess(supabase), listFeatureFlags(supabase)]);
    return accesoCrm(access.role, flags, access.overrides, access.grants);
  } catch {
    return { embudos: false, bandeja: false };
  }
}
