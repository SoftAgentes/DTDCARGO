/**
 * SDD-0522 · Las RPC de la migr 0476, del lado del servidor.
 *
 * Reciben el cliente de SESIÓN (`@/lib/db/server`): las RPC son SECURITY
 * DEFINER pero deciden con el `auth.uid()` de quien llama (admin activo de una
 * sola membresía). Nunca el admin client: sin principal, la base rechaza.
 *
 * Funciones puras sobre `SupabaseClient`, sin `revalidatePath` ni mensajes de
 * UI: eso lo ponen las acciones con `reglas.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AVISOS_EMBARQUE,
  AVISOS_RECEPCION,
  BLOQUEOS_EMBARQUE,
  BLOQUEOS_RECEPCION,
  interpretarFilas,
  parseAvisos,
  parseBloqueos,
  tipoDeError,
  type BloqueoEmbarque,
  type BloqueoRecepcion,
  type InfoBorradoEmbarque,
  type InfoBorradoRecepcion,
  type ResultadoBorrado,
} from "./reglas";

/** Tope de la lectura en la base (`shipment_delete_blockers`): 500 ids. */
const MAX_LECTURA = 500;

async function leerInfo<B extends string, A extends string>(
  supabase: SupabaseClient,
  rpc: "shipment_delete_blockers" | "warehouse_receipt_cn_delete_blockers",
  idKey: "shipment_id" | "receipt_id",
  ids: string[],
  bloqueos: readonly B[],
  avisos: readonly A[],
): Promise<Record<string, { bloqueos: Partial<Record<B | "otro", number>>; avisos: Partial<Record<A, number>> }> | null> {
  const unicos = [...new Set(ids)];
  const out: Record<string, { bloqueos: Partial<Record<B | "otro", number>>; avisos: Partial<Record<A, number>> }> = {};
  for (let i = 0; i < unicos.length; i += MAX_LECTURA) {
    const tramo = unicos.slice(i, i + MAX_LECTURA);
    const { data, error } = await supabase.rpc(rpc, { p_ids: tramo });
    if (error || !Array.isArray(data)) {
      if (error) console.error(`[borrado] ${rpc}`, error.code, error.message);
      return null;
    }
    for (const fila of data as Record<string, unknown>[]) {
      const id = fila[idKey];
      if (typeof id !== "string") return null;
      out[id] = { bloqueos: parseBloqueos(fila.blockers, bloqueos), avisos: parseAvisos(fila.warnings, avisos) };
    }
  }
  return out;
}

/**
 * Bloqueos y avisos de cada embarque, por id. `null` si no se pudo leer (sin
 * 0476, sin permiso o caída): la UI no ofrece borrar lo que no comprobó.
 */
export async function leerInfoEmbarques(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, InfoBorradoEmbarque> | null> {
  if (ids.length === 0) return {};
  return leerInfo(supabase, "shipment_delete_blockers", "shipment_id", ids, BLOQUEOS_EMBARQUE, AVISOS_EMBARQUE);
}

export async function leerInfoRecepciones(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, InfoBorradoRecepcion> | null> {
  if (ids.length === 0) return {};
  return leerInfo(supabase, "warehouse_receipt_cn_delete_blockers", "receipt_id", ids, BLOQUEOS_RECEPCION, AVISOS_RECEPCION);
}

async function eliminar<K extends string>(
  supabase: SupabaseClient,
  rpc: "soft_delete_shipments_with_audit_reason" | "soft_delete_warehouse_receipts_cn_with_audit_reason",
  idKey: "shipment_id" | "receipt_id",
  ids: string[],
  motivo: string,
  conocidos: readonly K[],
): Promise<ResultadoBorrado<K | "otro">> {
  const { data, error } = await supabase.rpc(rpc, { p_ids: ids, p_reason: motivo });
  if (error) {
    // El mensaje crudo va al log del servidor, nunca a la pantalla.
    console.error(`[borrado] ${rpc}`, error.code, error.message);
    return { estado: "error", tipo: tipoDeError(error) };
  }
  return interpretarFilas(data, idKey, ids, conocidos);
}

/**
 * Borra 1 a 100 embarques (ids ya normalizados, motivo ya validado). Todo o
 * nada: lo decide la RPC.
 */
export async function eliminarEmbarques(
  supabase: SupabaseClient,
  ids: string[],
  motivo: string,
): Promise<ResultadoBorrado<BloqueoEmbarque>> {
  return eliminar(supabase, "soft_delete_shipments_with_audit_reason", "shipment_id", ids, motivo, BLOQUEOS_EMBARQUE);
}

export async function eliminarRecepciones(
  supabase: SupabaseClient,
  ids: string[],
  motivo: string,
): Promise<ResultadoBorrado<BloqueoRecepcion>> {
  return eliminar(
    supabase,
    "soft_delete_warehouse_receipts_cn_with_audit_reason",
    "receipt_id",
    ids,
    motivo,
    BLOQUEOS_RECEPCION,
  );
}

/** Rutas que muestran embarques y cambian al eliminar uno. */
export const RUTAS_EMBARQUES = [
  "/studio/embarques",
  "/studio/tracking",
  "/studio/resumen",
  "/studio/calendario",
] as const;
