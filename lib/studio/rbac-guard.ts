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
import type { StudioUserRole, WarehouseScope } from "@/lib/studio/user-types";
import {
  canAccessModule,
  canEditModule,
  canSpecial,
  scopeAllowsModule,
  type StudioCapability,
} from "@/lib/studio/rbac";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export interface StudioAccess {
  role: StudioUserRole | null;
  /** Scope de almacén (SDD-0139). 'all' si la columna aún no existe o no hay asignación. */
  warehouseScope: WarehouseScope;
}

/**
 * Resuelve rol + scope de almacén del user logueado en su tenant (primer
 * membership ACTIVO). role=null si no hay sesión, membership, o está
 * desactivado (`disabled_at` — hardening 0200 → fail-closed). `select("*")`
 * a propósito: si la migr 0202 (warehouse_scope) aún no corrió, la query no
 * rompe y el scope degrada a 'all' (el gate duro sigue siendo el rol).
 * `limit(1)` protege contra un user en N tenants (V1 single-tenant).
 */
export async function getStudioAccess(
  supabase: StudioClient,
): Promise<StudioAccess> {
  const { data } = await supabase
    .from("user_tenants")
    .select("*")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: StudioUserRole | null; warehouse_scope?: string | null }>();
  const scope = data?.warehouse_scope;
  return {
    role: data?.role ?? null,
    warehouseScope: scope === "cn" || scope === "ve" ? scope : "all",
  };
}

/** Solo el rol (compat). Prefiere `getStudioAccess` si también necesitas scope. */
export async function getStudioRole(
  supabase: StudioClient,
): Promise<StudioUserRole | null> {
  return (await getStudioAccess(supabase)).role;
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
  const { role, warehouseScope } = await getStudioAccess(supabase);
  if (!canAccessModule(role, moduleId)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  // Scope de almacén (SDD-0139): restringe los módulos con lado geográfico
  // (cn/cola-qr/etiquetas vs ve) para no-admin. admin siempre pasa.
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
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
  const { role, warehouseScope } = await getStudioAccess(supabase);
  if (!canEditModule(role, moduleId)) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
    return "No tienes permiso para realizar esta acción.";
  }
  return null;
}

/**
 * Guard de CAPABILITY para server actions (SDD-0139). Para actos peligrosos
 * que no mapean a "editar un módulo" (ej. causar una CxP desde órdenes de
 * compra). Mismo contrato que moduleEditDenial:
 *
 *   const denial = await capabilityDenial(supabase, "approve_money");
 *   if (denial) return { error: denial };
 */
export async function capabilityDenial(
  supabase: StudioClient,
  capability: StudioCapability,
): Promise<string | null> {
  const { role } = await getStudioAccess(supabase);
  if (!canSpecial(role, capability)) {
    return "No tienes permiso para realizar esta acción.";
  }
  return null;
}
