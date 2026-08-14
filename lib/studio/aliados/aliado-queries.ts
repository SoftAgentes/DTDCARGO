/**
 * Queries del módulo Aliados (SDD-0255).
 *
 * Funciones puras que reciben el SupabaseClient, patrón del proyecto. El
 * aislamiento por tenant lo hace la RLS de `aliados` (política "aliados by
 * tenant", migr 0362); acá no se re-filtra a mano salvo donde ayuda al índice.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Aliado, AliadoOption } from "./aliado-types";

const ALIADO_COLUMNS =
  "id, tenant_id, client_id, parent_aliado_id, prefix, trade_name, status, agreement_notes, billing_model, billing_value, created_at, deleted_at";

/** El aliado que cuelga de un cliente, si ese cliente fue marcado como aliado. */
export async function getAliadoByClientId(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Aliado | null> {
  const { data, error } = await supabase
    .from("aliados")
    .select(ALIADO_COLUMNS)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Aliado | null) ?? null;
}

/** Todos los aliados vivos del tenant, para selectores y listados. */
export async function listAliadoOptions(supabase: SupabaseClient): Promise<AliadoOption[]> {
  // El embed de `clients` trae el Shipping Mark para poder enlazar a la ficha del
  // sub-aliado: la ruta del Studio es /studio/clientes/[markbox], no por id.
  const { data, error } = await supabase
    .from("aliados")
    .select("id, client_id, prefix, trade_name, parent_aliado_id, status, clients:client_id (markbox)")
    .is("deleted_at", null)
    .order("prefix");

  if (error) throw error;

  return (data ?? []).map((r) => {
    // PostgREST devuelve el embed como objeto o como arreglo según cómo infiera
    // la relación; se normalizan los dos casos en vez de apostar por uno.
    const rel = (r as { clients?: { markbox?: string } | { markbox?: string }[] | null }).clients;
    const embedded = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: r.id as string,
      clientId: r.client_id as string,
      markbox: embedded?.markbox ?? null,
      prefix: r.prefix as string,
      tradeName: r.trade_name as string,
      parentAliadoId: (r.parent_aliado_id as string | null) ?? null,
      status: r.status as AliadoOption["status"],
    };
  });
}

/**
 * Cuántos clientes cuelgan de cada aliado. Se usa para avisar antes de suspender
 * o cerrar uno, y como KPI de la cartera.
 *
 * ⚠️ Cuenta por `aliado_id` EXACTO, o sea el aliado más profundo. Los clientes de
 * un sub-aliado NO suman al padre: para eso hay que recorrer la jerarquía.
 */
export async function countClientesPorAliado(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("clients")
    .select("aliado_id")
    .not("aliado_id", "is", null)
    .is("deleted_at", null);

  if (error) throw error;

  const conteo = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.aliado_id as string;
    conteo.set(id, (conteo.get(id) ?? 0) + 1);
  }
  return conteo;
}

/**
 * Siguiente Shipping Mark bajo un aliado, en forma GUARDADA (`DC-FA-0008`).
 *
 * Es la fuente canónica de emisión: el correlativo se calcula del lado de la base
 * por cadena exacta, y la función tiene revocado el `execute` para `anon` y
 * `service_role` a propósito — el registro público anónimo no puede pedir un
 * código de aliado.
 */
export async function nextMarkboxAliado(
  supabase: SupabaseClient,
  aliadoId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("next_markbox_aliado", {
    p_aliado_id: aliadoId,
  });
  if (error) throw error;
  return data as string;
}
