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
 *   - moduleViewDenial(supabase, id)   → al tope del GET de un route handler.
 *                                        Devuelve un mensaje para responder
 *                                        JSON 403, o null si puede leer.
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
  SUPERADMIN_ONLY_MODULES,
  type RoleModuleOverrides,
  type StudioCapability,
} from "@/lib/studio/rbac";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { getRoleModuleOverrides } from "@/lib/studio/role-module-overrides-queries";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export interface StudioAccess {
  role: StudioUserRole | null;
  /** Scope de almacén (SDD-0139). 'all' si la columna aún no existe o no hay asignación. */
  warehouseScope: WarehouseScope;
  /**
   * Desvíos de la matriz por rol (SDD-0252, migr 0357). `{}` sin sesión, con
   * rol `admin` (nunca los necesita) o si la lectura falla — fail-closed
   * suave: nunca abre más de lo que el default de código ya permitía.
   */
  overrides: RoleModuleOverrides;
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
  // SDD-0251: filtrar por `user_id` explícito. Hoy no cambia ningún resultado
  // —la policy de `user_tenants` ya se auto-scopea (`user_id = auth.uid()`,
  // migr 0200)— pero deja de DEPENDER de ella. La migr 0040 llegó a abrir "ver
  // miembros de tu tenant" y la 0041 la revirtió: si algo así vuelve, sin este
  // filtro el `limit(1)` entregaría el rol de un compañero cualquiera, y acá
  // ese rol es el que decide si pasás. Sin sesión → fail-closed.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: null, warehouseScope: "all", overrides: {} };

  const { data } = await supabase
    .from("user_tenants")
    .select("*")
    .eq("user_id", user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: StudioUserRole | null; warehouse_scope?: string | null }>();
  const scope = data?.warehouse_scope;
  const role = data?.role ?? null;
  // Overrides sólo importan para no-admin — admin ya lo ve/edita todo.
  const overrides =
    role && role !== "admin" ? await getRoleModuleOverrides(supabase) : {};
  return {
    role,
    warehouseScope: scope === "cn" || scope === "ve" ? scope : "all",
    overrides,
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
  const { role, warehouseScope, overrides } = await getStudioAccess(supabase);
  if (!canAccessModule(role, moduleId, overrides)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  // Scope de almacén (SDD-0139): restringe los módulos con lado geográfico
  // (cn/cola-qr/etiquetas vs ve) para no-admin. admin siempre pasa.
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  // SDD-0252 · segundo candado: financiero-china/legal/no-olvidar/renditions
  // son ADMIN_ONLY (matriz []), así que llegar acá ya implica role === 'admin'
  // — esto exige además is_platform_admin(), igual que 0355 con feature flags.
  if (
    SUPERADMIN_ONLY_MODULES.has(moduleId) &&
    !(await isPlatformAdmin(supabase))
  ) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  return role;
}

/**
 * Guard de VISTA para route handlers de la API del Studio (SDD-0286).
 *
 * `requireModuleView` redirige y por eso no conserva el contrato JSON de una
 * API. Este helper aplica la misma matriz, overrides, alcance de almacén y
 * segundo candado de superadministrador, pero devuelve un mensaje para que el
 * handler responda 403 antes de consultar datos del dominio.
 */
export async function moduleViewDenial(
  supabase: StudioClient,
  moduleId: string,
): Promise<string | null> {
  const { role, warehouseScope, overrides } = await getStudioAccess(supabase);
  if (!canAccessModule(role, moduleId, overrides)) {
    return "No tienes permiso para ver esto.";
  }
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
    return "No tienes permiso para ver esto.";
  }
  if (
    SUPERADMIN_ONLY_MODULES.has(moduleId) &&
    !(await isPlatformAdmin(supabase))
  ) {
    return "Esto lo reserva el superadministrador. Pídeselo a quien administra el sistema.";
  }
  return null;
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
  const { role, warehouseScope, overrides } = await getStudioAccess(supabase);
  if (!canEditModule(role, moduleId, overrides)) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
    return "No tienes permiso para realizar esta acción.";
  }
  // SDD-0252 · segundo candado, ver requireModuleView.
  if (
    SUPERADMIN_ONLY_MODULES.has(moduleId) &&
    !(await isPlatformAdmin(supabase))
  ) {
    return "Esta acción la reserva el superadministrador. Pídesela a quien administra el sistema.";
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
