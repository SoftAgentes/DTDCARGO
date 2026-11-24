import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessModule, canEditModule, scopeAllowsModule, type ModuleAccessOverride, type RoleModuleOverrides, type UserModuleGrants } from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole, type WarehouseScope } from "@/lib/studio/user-types";
import { DECISION_COLUMNS, grantsFromRows } from "@/lib/studio/user-module-grants-queries";
import { esUuid, MODULOS_PRACTICA, type PermisoPractica } from "./contrato";

export interface Sujeto { usuario: string; tenant: string }
const DURACION_MS = 4 * 60 * 60 * 1000;

export function referenciaPrivada(sujeto: Sujeto, llave: string, ahora = Date.now()) {
  const clave = Buffer.from(llave, "hex");
  const propietario = createHmac("sha256", clave).update("espacio/v1:" + sujeto.tenant + ":" + sujeto.usuario).digest("hex");
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave, iv);
  cifrador.setAAD(Buffer.from("dtd-practica/v1"));
  const cuerpo = JSON.stringify({ ...sujeto, vence: ahora + DURACION_MS });
  const texto = Buffer.concat([cifrador.update(cuerpo, "utf8"), cifrador.final()]);
  return { propietario, referencia: Buffer.concat([iv, cifrador.getAuthTag(), texto]).toString("base64url") };
}

export function abrirReferencia(valor: unknown, llave: string, ahora = Date.now()): Sujeto | null {
  if (typeof valor !== "string" || !/^[\w-]{64,512}$/.test(valor)) return null;
  try {
    const bytes = Buffer.from(valor, "base64url");
    const descifrador = createDecipheriv("aes-256-gcm", Buffer.from(llave, "hex"), bytes.subarray(0, 12));
    descifrador.setAAD(Buffer.from("dtd-practica/v1"));
    descifrador.setAuthTag(bytes.subarray(12, 28));
    const datos = JSON.parse(Buffer.concat([descifrador.update(bytes.subarray(28)), descifrador.final()]).toString("utf8"));
    if (!esUuid(datos.usuario) || !esUuid(datos.tenant) || !Number.isSafeInteger(datos.vence) || datos.vence <= ahora) return null;
    return { usuario: datos.usuario, tenant: datos.tenant };
  } catch {
    return null;
  }
}

export function permisosDePractica(rol: StudioUserRole, almacen: WarehouseScope, ajustes: RoleModuleOverrides, extras: UserModuleGrants): PermisoPractica[] {
  return MODULOS_PRACTICA.filter(({ id }) =>
    // Detalle financiero interno: 0414/0407 y RPC 0533/0497 exigen estos roles.
    // Un extra de pantalla no amplía las operaciones que la base real permite.
    (id !== "invoices" || rol === "accounting" || rol === "admin") &&
    (rol === "admin" || scopeAllowsModule(almacen, id)) && canAccessModule(rol, id, ajustes, extras)
  ).map(({ id }) => ({ id, edicion: canEditModule(rol, id, ajustes, extras) }));
}

/** Solo en el Studio de origen. Relee identidad y permisos antes de cada acceso protegido. */
export async function permisosVigentes(admin: SupabaseClient, sujeto: Sujeto): Promise<PermisoPractica[] | null> {
  const [cuenta, miembro] = await Promise.all([
    admin.auth.admin.getUserById(sujeto.usuario),
    admin.from("user_tenants").select("role, warehouse_scope").eq("tenant_id", sujeto.tenant)
      .eq("user_id", sujeto.usuario).is("disabled_at", null).maybeSingle(),
  ]);
  const user = cuenta.data.user;
  const rol = miembro.data?.role;
  const scope = miembro.data?.warehouse_scope ?? "all";
  if (cuenta.error) {
    if (cuenta.error.status === 404 || cuenta.error.code === "user_not_found") return null;
    throw new Error("No se pudo comprobar la identidad");
  }
  if (miembro.error) throw new Error("No se pudo comprobar la membresía");
  if (!user || user.id !== sujeto.usuario || user.is_anonymous || user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) return null;
  if (!miembro.data) return null;
  if (!STUDIO_USER_ROLES.includes(rol) || !["all", "cn", "ve"].includes(scope)) throw new Error("Membresía inválida");
  if (rol === "admin") return permisosDePractica(rol, scope, {}, {});
  const [ajustes, extras] = await Promise.all([
    admin.from("studio_role_module_overrides").select("module_id, can_view, can_edit").eq("tenant_id", sujeto.tenant).eq("role", rol),
    admin.from("studio_user_module_grants").select(DECISION_COLUMNS).eq("tenant_id", sujeto.tenant).eq("user_id", sujeto.usuario),
  ]);
  if (ajustes.error || !Array.isArray(ajustes.data) || extras.error || !Array.isArray(extras.data)) throw new Error("No se pudieron comprobar los permisos");
  const mapa: Record<string, ModuleAccessOverride> = {};
  for (const fila of ajustes.data) mapa[rol + ":" + fila.module_id] = { view: fila.can_view, edit: fila.can_edit };
  return permisosDePractica(rol, scope, mapa, grantsFromRows(extras.data));
}
