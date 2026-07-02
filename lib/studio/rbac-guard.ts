/**
 * Guards server-side de RBAC por módulo (SDD-0085).
 *
 *   - requireModuleView(id)            → al tope de una page.tsx de módulo.
 *                                        Redirige a /studio/resumen?denied=<id>
 *                                        si el rol no puede ver el módulo.
 *   - moduleEditDenial(supabase, id)   → al tope de una server action de
 *                                        mutación. Devuelve el mensaje de
 *                                        denegación (es-VE) o null si está OK,
 *                                        para el patrón `{ error }` del Studio.
 *   - getStudioRole(supabase)          → rol del user en su tenant, o null.
 *
 * Server-only de facto: importa `createClient` (usa next/headers cookies), así
 * que importarlo desde un client component rompe en build — justo lo deseado.
 * El gate real de seguridad vive acá; el sidebar solo esconde links (UX).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { canAccessModule, canEditModule } from "@/lib/studio/rbac";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resuelve el rol del user logueado en su tenant (primer membership ACTIVO).
 * null si no hay sesión, membership, o el membership está desactivado
 * (`disabled_at` — hardening 0200: un desactivado no conserva rol → todos los
 * gates fail-closed). Mismo patrón que el layout (SDD-0007); `limit(1)`
 * protege contra un user en N tenants (V1 single-tenant por sesión).
 */
export async function getStudioRole(
  supabase: StudioClient,
): Promise<StudioUserRole | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("role")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: StudioUserRole | null }>();
  return data?.role ?? null;
}

/**
 * Guard de VISTA. Llamar al tope del server component de la page del módulo:
 *
 *   export default async function Page() {
 *     await requireModuleView("treasury");
 *     // ...
 *   }
 *
 * Redirige (no renderiza) si el rol no puede ver el módulo. Devuelve el rol por
 * si la page lo quiere reusar. Va directo a `/studio/dashboard` (NO a
 * `/studio/resumen`, que rebota a dashboard y se come el `?denied=`) — así el
 * param sobrevive y `<DeniedToast>` puede mostrar el aviso. dashboard lo ve
 * todo rol → sin loop.
 */
export async function requireModuleView(
  moduleId: string,
): Promise<StudioUserRole | null> {
  const supabase = await createClient();
  const role = await getStudioRole(supabase);
  if (!canAccessModule(role, moduleId)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  return role;
}

/**
 * Guard de EDICIÓN para server actions. Reusa el `supabase` que la action ya
 * creó (no duplica cliente). Devuelve el mensaje de denegación o null:
 *
 *   const denial = await moduleEditDenial(supabase, "users");
 *   if (denial) return { error: denial };
 *
 * Es el backstop server-side: el sidebar + requireModuleView ya evitan llegar
 * acá por UI, pero las server actions son invocables directo (como un endpoint)
 * → deben validar su propio permiso. Ver SDD-0085 §Seguridad.
 */
export async function moduleEditDenial(
  supabase: StudioClient,
  moduleId: string,
): Promise<string | null> {
  const role = await getStudioRole(supabase);
  if (!canEditModule(role, moduleId)) {
    return "No tienes permiso para realizar esta acción.";
  }
  return null;
}
