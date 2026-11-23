/**
 * Lectura de las cajas por proveedor de una lista de embarques.
 *
 * Una lectura, con la sesión del usuario (la RLS por tenant decide qué se ve; no
 * se usa service_role) y sin migración: `warehouse_receipts_cn` ya trae `boxes`,
 * `total_cbm`, `supplier_name` y `shipment_id` (se llena al consolidar). Solo
 * cuentan las recepciones consolidadas y vivas: la RLS no esconde las eliminadas
 * (migr 0230), el `.is("deleted_at", null)` es lo único que las separa.
 *
 * Devuelve `null` si la lectura falla o supera el tope: la pantalla dice «No se
 * pudo leer» y no «Sin recepción», que sería falso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds } from "@/lib/db/paginate";
import {
  agruparCajasPorEnvio,
  type CajasDeEnvio,
  type RecepcionDeEnvio,
} from "./cajas-por-proveedor";

type Fila = Record<string, unknown>;

export async function leerCajasPorProveedor(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
): Promise<Record<string, CajasDeEnvio> | null> {
  const ids = [...new Set(shipmentIds.filter((x) => x.length > 0))];
  if (ids.length === 0) return {};
  try {
    const { rows, complete } = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
      supabase
        .from("warehouse_receipts_cn")
        .select("id, shipment_id, supplier_name, boxes, total_cbm")
        .in("shipment_id", lote)
        .eq("status", "consolidado")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    );
    if (!complete) return null;
    const recepciones: RecepcionDeEnvio[] = rows
      .filter((r) => typeof r.shipment_id === "string" && r.shipment_id.length > 0)
      .map((r) => ({
        shipmentId: String(r.shipment_id),
        proveedor: typeof r.supplier_name === "string" ? r.supplier_name : null,
        cajas: Number(r.boxes),
        cbm: Number(r.total_cbm),
      }));
    return agruparCajasPorEnvio(recepciones);
  } catch {
    return null;
  }
}
