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
 *   - moduleEditGate(supabase, id)     → igual que moduleEditDenial pero además
 *                                        devuelve tenantId/userId/role, para la
 *                                        action que necesita escribir (SDD-0498).
 *   - tenantAdminGate(supabase)        → gate admin-only con el mismo contexto,
 *                                        para reglas de producto que no son la
 *                                        matriz de módulos (SDD-0498).
 *   - getStudioRole(supabase)          → rol del user en su tenant, o null.
 *
 * Los dos gates con contexto existen para que NINGUNA action tenga que releer
 * `user_tenants` por su cuenta: esa relectura a mano es la que se olvidaba de
 * `disabled_at` y dejaba actuar a un usuario suspendido.
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
  type UserModuleGrants,
} from "@/lib/studio/rbac";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { getRoleModuleOverrides } from "@/lib/studio/role-module-overrides-queries";
import { getMyModuleGrants } from "@/lib/studio/user-module-grants-queries";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export interface StudioAccess {
  role: StudioUserRole | null;
  /**
   * Tenant de la membresía ACTIVA (SDD-0498). `null` sin sesión, sin membership
   * o con el usuario desactivado — viene de la MISMA fila que `role`, así que
   * una action no necesita releer `user_tenants` para saber dónde escribir.
   * Esa relectura a mano era el origen de las cinco puertas que se saltaban
   * `disabled_at`.
   */
  tenantId: string | null;
  /** `auth.uid()` de la sesión, o `null` si no hay. */
  userId: string | null;
  /** Scope de almacén (SDD-0139). 'all' si la columna aún no existe o no hay asignación. */
  warehouseScope: WarehouseScope;
  /**
   * Desvíos de la matriz por rol (SDD-0252, migr 0357). `{}` sin sesión, con
   * rol `admin` (nunca los necesita) o si la lectura falla — fail-closed
   * suave: nunca abre más de lo que el default de código ya permitía.
   */
  overrides: RoleModuleOverrides;
  /**
   * Accesos adicionales VIGENTES de esta persona (SDD-0622, migr 0526). `{}` sin
   * sesión, con rol `admin` o si la lectura falla (p. ej. la 0526 sin aplicar):
   * igual que `overrides`, nunca abre más de lo que el rol ya daba. Solo suman.
   */
  grants: UserModuleGrants;
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
  if (!user) {
    return { role: null, tenantId: null, userId: null, warehouseScope: "all", overrides: {}, grants: {} };
  }

  const { data } = await supabase
    .from("user_tenants")
    .select("*")
    .eq("user_id", user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{
      role: StudioUserRole | null;
      tenant_id?: string | null;
      warehouse_scope?: string | null;
    }>();
  const scope = data?.warehouse_scope;
  const role = data?.role ?? null;
  // Overrides y extras sólo importan para no-admin — admin ya lo ve/edita todo.
  // Sin membership activa (desactivado) no hay extras: rol null = todo cerrado.
  const [overrides, grants] =
    role && role !== "admin"
      ? await Promise.all([getRoleModuleOverrides(supabase), getMyModuleGrants(supabase, user.id)])
      : [{}, {}];
  return {
    role,
    tenantId: data?.tenant_id ?? null,
    userId: user.id,
    warehouseScope: scope === "cn" || scope === "ve" ? scope : "all",
    overrides,
    grants,
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
  const { role, warehouseScope, overrides, grants } = await getStudioAccess(supabase);
  if (!canAccessModule(role, moduleId, overrides, grants)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  // Scope de almacén (SDD-0139): restringe los módulos con lado geográfico
  // (cn/cola-qr/etiquetas vs ve) para no-admin. admin siempre pasa.
  if (role !== "admin" && !scopeAllowsModule(warehouseScope, moduleId)) {
    redirect(`/studio/dashboard?denied=${encodeURIComponent(moduleId)}`);
  }
  // SDD-0252 · segundo candado: financiero-china/legal/no-olvidar/renditions
  // son ADMIN_ONLY (matriz []): llegar acá implica role === 'admin' o un extra
  // de la persona (SDD-0622). En los dos casos se exige además
  // is_platform_admin(), igual que 0355 con feature flags (R2, opción A).
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
  const { role, warehouseScope, overrides, grants } = await getStudioAccess(supabase);
  if (!canAccessModule(role, moduleId, overrides, grants)) {
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
  return editDenial(supabase, await getStudioAccess(supabase), moduleId);
}

/**
 * El predicado de EDICIÓN sobre un acceso ya resuelto. Vive aparte para que
 * `moduleEditDenial` y `moduleEditGate` (SDD-0498) compartan exactamente la
 * misma decisión sin resolver el rol dos veces — dos resoluciones es justo el
 * patrón que esta spec vino a borrar.
 */
async function editDenial(
  supabase: StudioClient,
  { role, warehouseScope, overrides, grants }: StudioAccess,
  moduleId: string,
): Promise<string | null> {
  if (!canEditModule(role, moduleId, overrides, grants)) {
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

// ─── Gates con contexto de tenant (SDD-0498) ──────────────────────────────
//
// `moduleEditDenial` devuelve sólo el mensaje, así que una action que además
// necesita el `tenant_id` para escribir volvía a leer `user_tenants` a mano —
// y esas relecturas se olvidaron de `.is("disabled_at", null)`, el fail-closed
// del endurecimiento 0200. El resultado era una segunda forma de resolver el
// rol, siempre la desactualizada: a un usuario suspendido le seguían
// funcionando cinco puertas del Studio.
//
// Estos dos gates devuelven permiso Y contexto en UNA resolución
// (`getStudioAccess`), para que ninguna action tenga motivo para leer la tabla
// por su cuenta. Discriminan por `ok` y no por el mensaje: un `denied: string`
// no es tipo unidad, así que TypeScript no podría estrecharlo y el call site
// terminaría con un `tenantId` posiblemente indefinido dentro de un insert.

/** Pasó el gate: rol resuelto y contexto de la MISMA fila que lo autorizó. */
export interface StudioGateAllowed {
  ok: true;
  tenantId: string;
  userId: string;
  role: StudioUserRole;
}

/** No pasó: mensaje es-VE listo para el patrón `{ error }` del Studio. */
export interface StudioGateDenied {
  ok: false;
  denied: string;
}

export type StudioGate = StudioGateAllowed | StudioGateDenied;

/** Copias es-VE que cada call site puede sobreescribir sin reimplementar el gate. */
export interface StudioGateMessages {
  /** Reemplaza el mensaje de denegación por rol. */
  denied?: string;
  /** Se usa cuando el rol alcanza pero la fila no trae tenant (no debería pasar). */
  noTenant?: string;
}

const SIN_TENANT = "No se pudo resolver el tenant del usuario.";

/**
 * Cierra el gate: sólo se devuelve contexto si el rol pasó Y la fila trae
 * tenant. Un `tenantId` nulo con rol válido es un estado imposible en la
 * práctica (salen de la misma fila), pero se trata como denegación en vez de
 * dejar que la action escriba con `tenant_id: undefined`.
 */
function gateWith(
  access: StudioAccess,
  denial: string | null,
  messages?: StudioGateMessages,
): StudioGate {
  if (denial) return { ok: false, denied: messages?.denied ?? denial };
  if (!access.tenantId || !access.userId || !access.role) {
    return { ok: false, denied: messages?.noTenant ?? SIN_TENANT };
  }
  return { ok: true, tenantId: access.tenantId, userId: access.userId, role: access.role };
}

/**
 * `moduleEditDenial` + el contexto que la action necesita para escribir:
 *
 *   const gate = await moduleEditGate(supabase, "fiscal");
 *   if (!gate.ok) return { error: gate.denied };
 *   await supabase.from("x").insert({ tenant_id: gate.tenantId, … });
 *
 * Misma matriz, mismos overrides, mismo alcance de almacén y mismo segundo
 * candado de superadministrador que `moduleEditDenial` — una sola resolución.
 */
export async function moduleEditGate(
  supabase: StudioClient,
  moduleId: string,
  messages?: StudioGateMessages,
): Promise<StudioGate> {
  const access = await getStudioAccess(supabase);
  return gateWith(access, await editDenial(supabase, access, moduleId), messages);
}

/**
 * Gate ADMIN-ONLY con contexto, para las puertas cuya regla de producto no es
 * la matriz de módulos sino «sólo un administrador»: el cierre contable
 * (SDD-0080), la configuración fiscal, los transportistas, las notificaciones
 * al cliente y la publicación de noticias del sitio público.
 *
 * Se expresa acá y no con `moduleEditGate("admin")` porque no son el módulo
 * Admin: prestarles su fila de la matriz ataría una regla de producto a una
 * tabla que se edita por otros motivos.
 */
export async function tenantAdminGate(
  supabase: StudioClient,
  messages?: StudioGateMessages,
): Promise<StudioGate> {
  const access = await getStudioAccess(supabase);
  const denial =
    access.role === "admin" ? null : "No tienes permiso para realizar esta acción.";
  return gateWith(access, denial, messages);
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
