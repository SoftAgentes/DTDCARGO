import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canAccessModule, canEditModule, type RoleModuleOverrides, type UserModuleGrants } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

import { esCanalUnion, type CanalUnion } from "./canal-union";
import { chatwootFichaConfigPara } from "./config";
import {
  armarPanel,
  LIMITE_CONTACTOS,
  puedeAbrirArchivoKommo,
  resumirConversacion,
  type ConversacionEnVivo,
  type PanelConversaciones,
} from "./ficha-conversaciones";
import { leerConversacionesDeContacto } from "./router-api";

/**
 * SDD-0650 F2 · Panel de conversaciones de la ficha del cliente, armado en el servidor.
 *
 * Orden de las barreras, y por qué:
 *   1. Rol: sin el módulo Bandeja no se lee nada y no se toca el token (D3, piso 1).
 *   2. Configuración y tenant: sin la cuenta de servicio, sin la bandeja del Archivo
 *      Kommo, o con una sesión de OTRO tenant que el dueño de la cuenta de Chatwoot
 *      (`CHATWOOT_TENANT_ID`) → «apagado»: la ficha queda como en la F1, sin llamar a
 *      la red. La cuenta de servicio lee toda la cuenta: solo su tenant la usa.
 *   3. Uniones (0554), con el cliente de SESIÓN: la RLS vuelve a pedir la Bandeja y el
 *      tenant. Sin la 0554 (PGRST205/42P01) o sin uniones → la tarjeta de la F1.
 *   4. Chatwoot, en vivo y sin caché (`cache: "no-store"`), un contacto por llamada.
 *
 * El texto y el nombre del contacto se quedan en memoria: no se guardan, no se
 * registran (los avisos llevan solo el código de error) y solo salen al navegador si
 * `puedeVerDatos` (SDD-0531).
 */

export type EstadoPanel =
  | { estado: "apagado" }
  | { estado: "sin_uniones" }
  | { estado: "chatwoot_no_responde" }
  | { estado: "listo"; panel: PanelConversaciones; uniones: UnionDeLaFicha[]; puedeUnir: boolean };

export interface UnionDeLaFicha {
  chatwootContactId: number;
  origen: "webhook" | "kommo" | "manual" | "portal";
  /** SDD-0676: canal del contacto, para el logo. null en las uniones anteriores o sin la migración. */
  canal: CanalUnion | null;
}

const SIN_MIGRACION: ReadonlySet<string> = new Set(["PGRST205", "42P01", "PGRST202", "42883"]);

export interface AccesoFicha {
  role: StudioUserRole | null;
  overrides?: RoleModuleOverrides;
  grants?: UserModuleGrants;
}

/** Solo lectura: las uniones de la ficha con el cliente de SESIÓN (RLS de la 0554). */
export async function listarUniones(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<UnionDeLaFicha[] | null> {
  const leer = (columnas: string) =>
    supabase
      .from("chatwoot_contact_links")
      .select(columnas)
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .limit(20);
  let { data, error } = await leer("chatwoot_contact_id, origen, canal_chat");
  // Sin la migración de la SDD-0676 la columna no existe (42703): se lee como antes, sin canal.
  if (error?.code === "42703") ({ data, error } = await leer("chatwoot_contact_id, origen"));
  if (error) {
    if (!SIN_MIGRACION.has(error.code ?? "")) console.warn(`[ficha] uniones: ${error.code ?? "sin código"}`);
    return null;
  }
  return ((data ?? []) as unknown as { chatwoot_contact_id: number | string; origen: UnionDeLaFicha["origen"]; canal_chat?: unknown }[])
    .map((f) => ({
      chatwootContactId: Number(f.chatwoot_contact_id),
      origen: f.origen,
      canal: esCanalUnion(f.canal_chat) ? f.canal_chat : null,
    }))
    .filter((u) => Number.isSafeInteger(u.chatwootContactId) && u.chatwootContactId > 0);
}

export async function cargarPanelConversaciones(args: {
  supabase: SupabaseClient;
  tenantId: string;
  clientId: string;
  acceso: AccesoFicha;
  puedeVerDatos: boolean;
  fichaSinNombre: boolean;
  /** Para pruebas; en producción, `leerConversacionesDeContacto`. */
  leer?: typeof leerConversacionesDeContacto;
}): Promise<EstadoPanel> {
  const { acceso } = args;
  // 1. Rol, antes que nada.
  if (!canAccessModule(acceso.role, "bandeja", acceso.overrides, acceso.grants)) return { estado: "apagado" };
  // 2. Configuración, y solo para el tenant dueño de la cuenta de Chatwoot.
  const cfg = chatwootFichaConfigPara(args.tenantId);
  if (!cfg) return { estado: "apagado" };
  // 3. Uniones.
  const uniones = await listarUniones(args.supabase, args.tenantId, args.clientId);
  if (uniones === null) return { estado: "apagado" };
  if (uniones.length === 0) return { estado: "sin_uniones" };

  // 4. Chatwoot.
  const leer = args.leer ?? leerConversacionesDeContacto;
  const resultados = await Promise.all(
    uniones.slice(0, LIMITE_CONTACTOS).map((u) => leer(cfg, u.chatwootContactId)),
  );
  const conversaciones: ConversacionEnVivo[] = [];
  let fallidos = 0;
  for (const r of resultados) {
    if (!r.ok) {
      fallidos += 1;
      console.warn(`[ficha] chatwoot: ${r.error}`);
      continue;
    }
    for (const raw of r.data) {
      const c = resumirConversacion(raw);
      if (c) conversaciones.push(c);
    }
  }
  if (fallidos === resultados.length) return { estado: "chatwoot_no_responde" };

  return {
    estado: "listo",
    panel: armarPanel({
      conversaciones,
      archivoKommoInboxId: cfg.archivoKommoInboxId,
      puedeAbrirArchivo: puedeAbrirArchivoKommo(acceso.role),
      puedeVerDatos: args.puedeVerDatos,
      fichaSinNombre: args.fichaSinNombre,
      incompleto: fallidos > 0 || uniones.length > LIMITE_CONTACTOS,
    }),
    uniones,
    puedeUnir: canEditModule(acceso.role, "bandeja", acceso.overrides, acceso.grants),
  };
}
