/**
 * SDD-0608 · Resolver una consulta `/cliente` ya firmada y validada.
 *
 * No hay sesión del Studio: quien pregunta es un usuario de Discord. Por eso
 * se usa el cliente `service_role` y TODOS los candados que la sesión daría se
 * repiten acá, en este orden, y fallan cerrado:
 *
 *   1. `DISCORD_TENANT_ID` (el mismo de la SDD-0606): el servidor de Discord
 *      tiene UN tenant dueño. Sin la variable no responde nadie.
 *   2. Enlace: exactamente un perfil con ese `discord_user_id` (columna de la
 *      migración 0514, SDD-0606). Cero → «no autorizado»; dos o más → ambiguo.
 *   3. Membresía ACTIVA en ese tenant (`disabled_at` nulo), como
 *      `getStudioAccess`.
 *   4. Permiso de ver clientes con la misma matriz del Studio
 *      (`canAccessModule` + desvíos del tenant + alcance de almacén). Si los
 *      desvíos no se pueden leer, no se responde (un desvío puede QUITAR
 *      permiso; ignorarlo abriría de más).
 *   5. Registro + límite por minuto (`discord_consulta_registrar`, migr 0516).
 *      Si no se puede registrar, no se busca.
 *   6. Búsqueda (`discord_buscar_clientes`, migr 0516): devuelve sólo código y
 *      nombre, con los comodines escapados en la base.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessModule,
  scopeAllowsModule,
  type RoleModuleOverrides,
  type UserModuleGrants,
} from "@/lib/studio/rbac";
import { grantsFromRows, type UserModuleGrantRow } from "@/lib/studio/user-module-grants-queries";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { MAX_RESULTADOS, TOPE_POR_MINUTO } from "./comando";
import {
  MENSAJES,
  mensajeDeResultados,
  respuestaEfimera,
  type ClienteEncontrado,
  type RespuestaInteraccion,
} from "./respuesta";

export type ResultadoConsulta =
  | "ok"
  | "sin_enlace"
  | "enlace_ambiguo"
  | "sin_permiso"
  | "limite"
  | "no_disponible";

export interface DependenciasConsulta {
  admin: SupabaseClient;
  /** `DISCORD_TENANT_ID`: el tenant dueño del servidor de Discord. */
  tenantDiscord: string | null | undefined;
  /** Base pública del Studio para el enlace a la ficha. */
  baseUrl: string;
}

export interface Consulta {
  discordUserId: string;
  termino: string;
}

export interface ResultadoResuelto {
  resultado: ResultadoConsulta;
  respuesta: RespuestaInteraccion;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El módulo del Studio que decide si alguien puede ver clientes. */
export const MODULO_CLIENTES = "clients";

type Autorizacion =
  | { resultado: "ok"; userId: string; tenantId: string }
  | { resultado: Exclude<ResultadoConsulta, "ok" | "limite">; userId: string | null; tenantId: string | null };

async function autorizar(
  admin: SupabaseClient,
  tenant: string,
  discordUserId: string,
): Promise<Autorizacion> {
  // 2. Enlace.
  const perfiles = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("discord_user_id", discordUserId)
    .limit(2);
  if (perfiles.error || !perfiles.data) {
    // Incluye la columna ausente (una base sin la 0514).
    return { resultado: "no_disponible", userId: null, tenantId: null };
  }
  if (perfiles.data.length === 0) return { resultado: "sin_enlace", userId: null, tenantId: null };
  if (perfiles.data.length > 1) return { resultado: "enlace_ambiguo", userId: null, tenantId: null };
  const userId = (perfiles.data[0] as { user_id: string }).user_id;

  // 3. Membresía activa en el tenant de Discord. `select("*")` como
  // getStudioAccess: si `warehouse_scope` no existiera, no rompe.
  const membresia = await admin
    .from("user_tenants")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenant)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: StudioUserRole | null; warehouse_scope?: string | null }>();
  if (membresia.error) return { resultado: "no_disponible", userId, tenantId: null };
  const role = membresia.data?.role ?? null;
  if (!role) return { resultado: "sin_permiso", userId, tenantId: null };

  // 4. Matriz del Studio con los desvíos de ESTE tenant.
  let overrides: RoleModuleOverrides = {};
  if (role !== "admin") {
    const desvios = await admin
      .from("studio_role_module_overrides")
      .select("role, module_id, can_view, can_edit")
      .eq("tenant_id", tenant);
    if (desvios.error || !desvios.data) return { resultado: "no_disponible", userId, tenantId: tenant };
    const mapa: Record<string, { view: boolean; edit: boolean }> = {};
    for (const fila of desvios.data as Array<{
      role: string;
      module_id: string;
      can_view: boolean;
      can_edit: boolean;
    }>) {
      mapa[`${fila.role}:${fila.module_id}`] = { view: fila.can_view, edit: fila.can_edit };
    }
    overrides = mapa;
  }
  // Extras de ESTA persona (SDD-0622). Si la 0529 no está aplicada, la lectura
  // falla y no suma nada: el rol decide como antes.
  let grants: UserModuleGrants = {};
  if (role !== "admin") {
    const extras = await admin
      .from("studio_user_module_grants")
      .select("user_id, module_id, can_view, can_edit, reason, expires_at, granted_by, sensitive_confirmed_at, effects_version, created_at, updated_at")
      .eq("tenant_id", tenant)
      .eq("user_id", userId);
    if (!extras.error && extras.data) grants = grantsFromRows(extras.data as UserModuleGrantRow[]);
  }
  const puede =
    canAccessModule(role, MODULO_CLIENTES, overrides, grants) &&
    (role === "admin" || scopeAllowsModule(membresia.data?.warehouse_scope, MODULO_CLIENTES));
  if (!puede) return { resultado: "sin_permiso", userId, tenantId: tenant };

  return { resultado: "ok", userId, tenantId: tenant };
}

export async function resolverConsultaCliente(
  deps: DependenciasConsulta,
  consulta: Consulta,
): Promise<ResultadoResuelto> {
  const { admin } = deps;
  const tenant = deps.tenantDiscord?.trim() ?? "";

  // 1. Tenant dueño del servidor.
  const auth: Autorizacion = UUID.test(tenant)
    ? await autorizar(admin, tenant, consulta.discordUserId)
    : { resultado: "no_disponible", userId: null, tenantId: null };

  // 5. Registro + límite, para TODA consulta firmada desde el servidor.
  const registro = await admin.rpc("discord_consulta_registrar", {
    p_discord_user_id: consulta.discordUserId,
    p_user_id: auth.userId,
    p_tenant_id: auth.tenantId,
    p_termino: consulta.termino,
    p_resultado: auth.resultado,
    p_tope: TOPE_POR_MINUTO,
  });
  if (registro.error || typeof registro.data !== "boolean") {
    return fin("no_disponible");
  }
  if (registro.data === false) return fin("limite");
  if (auth.resultado !== "ok") return fin(auth.resultado);

  // 6. Búsqueda: una más que las que se muestran, para saber si hay más.
  const busqueda = await admin.rpc("discord_buscar_clientes", {
    p_tenant_id: auth.tenantId,
    p_termino: consulta.termino,
    p_limite: MAX_RESULTADOS + 1,
  });
  if (busqueda.error || !Array.isArray(busqueda.data)) return fin("no_disponible");

  // Sólo código y nombre, aunque la fila trajera más.
  const encontrados: ClienteEncontrado[] = (busqueda.data as Array<Record<string, unknown>>)
    .filter((f) => typeof f.markbox === "string" && typeof f.name === "string")
    .map((f) => ({ markbox: f.markbox as string, name: f.name as string }));

  return {
    resultado: "ok",
    respuesta: respuestaEfimera(mensajeDeResultados(consulta.termino, encontrados, deps.baseUrl)),
  };
}

function fin(resultado: Exclude<ResultadoConsulta, "ok">): ResultadoResuelto {
  return { resultado, respuesta: respuestaEfimera(MENSAJES[resultado]) };
}
