/**
 * Consolidación (contenedor) de los envíos del cliente — para agrupar
 * "Seguimiento total" por contenedor (SDD-0170 · Norte `PortalAlertas` vista
 * `track`).
 *
 * Camina la MISMA cadena que `lib/studio/naviera-tracking/queries.ts` (SDD-0047 /
 * SDD-0101) pero **en lote**:
 *
 *   consolidation_items → consolidations → sailings
 *
 * `getShipmentNaviera` resuelve UN envío con 5 consultas secuenciales; servía para
 * la pantalla de detalle, pero en una lista de N envíos serían 5N. Acá son **3
 * consultas fijas** sea N=1 o N=100 — sin duplicar dato en `shipments`.
 *
 * Recibe el ADMIN client scopeado a los envíos PROPIOS del cliente: igual que en
 * el detalle del envío, el cliente del portal no tiene RLS sobre
 * `consolidations` / `sailings`. **El caller debe pasar únicamente ids de envíos
 * ya verificados como suyos** (los que devuelve `listMyShipments`, filtrada por
 * `client_markbox`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Datos del contenedor en que viaja un envío, ya resueltos. */
export type ShipmentConsolidation = {
  consolidationId: string;
  /** Ref interna de la consolidación (ej. `CONS-0042`). Siempre presente. */
  ref: string | null;
  /** Nº de contenedor (ej. `DTDU-472816`) — puede no estar cargado todavía. */
  containerNo: string | null;
  /** Puerto de origen / destino del zarpe, si la consolidación ya tiene sailing. */
  pol: string | null;
  pod: string | null;
  eta: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Mapa `shipmentId → consolidación` para un lote de envíos. Los envíos que no
 * están en ninguna consolidación simplemente no aparecen en el mapa (el caller
 * los muestra sueltos). Cualquier fallo devuelve `{}`: la vista degrada a lista
 * plana, nunca rompe.
 */
export async function getConsolidationsForShipments(
  supabase: SupabaseClient,
  shipmentIds: string[],
): Promise<Record<string, ShipmentConsolidation>> {
  if (shipmentIds.length === 0) return {};

  // 1) ¿En qué contenedor va cada envío? La asignación más reciente gana, igual
  //    que en `getShipmentNaviera`.
  const { data: items, error: itemsErr } = await supabase
    .from("consolidation_items")
    .select("shipment_id, consolidation_id, created_at")
    .in("shipment_id", shipmentIds)
    .order("created_at", { ascending: false });
  if (itemsErr || !items?.length) return {};

  const consolidationByShipment = new Map<string, string>();
  for (const it of items) {
    const sid = str(it.shipment_id);
    const cid = str(it.consolidation_id);
    // Como vienen ordenados desc, el PRIMERO que vemos de cada envío es el vigente.
    if (sid && cid && !consolidationByShipment.has(sid)) {
      consolidationByShipment.set(sid, cid);
    }
  }
  if (consolidationByShipment.size === 0) return {};

  // 2) Los contenedores.
  const consolidationIds = [...new Set(consolidationByShipment.values())];
  const { data: cons, error: consErr } = await supabase
    .from("consolidations")
    .select("id, ref, container_no, sailing_id")
    .in("id", consolidationIds);
  if (consErr || !cons?.length) return {};

  // 3) Los zarpes de esos contenedores (POL/POD/ETA), en una sola consulta.
  const sailingIds = [
    ...new Set(cons.map((c) => str(c.sailing_id)).filter((x): x is string => !!x)),
  ];
  const sailingById = new Map<
    string,
    { pol: string | null; pod: string | null; eta: string | null }
  >();
  if (sailingIds.length) {
    const { data: sailings } = await supabase
      .from("sailings")
      .select("id, pol, pod, eta")
      .in("id", sailingIds);
    for (const s of sailings ?? []) {
      const id = str(s.id);
      if (id) {
        sailingById.set(id, {
          pol: str(s.pol),
          pod: str(s.pod),
          eta: str(s.eta),
        });
      }
    }
  }

  const consById = new Map<string, ShipmentConsolidation>();
  for (const c of cons) {
    const id = str(c.id);
    if (!id) continue;
    const sailing = c.sailing_id ? sailingById.get(String(c.sailing_id)) : null;
    consById.set(id, {
      consolidationId: id,
      ref: str(c.ref),
      containerNo: str(c.container_no),
      pol: sailing?.pol ?? null,
      pod: sailing?.pod ?? null,
      eta: sailing?.eta ?? null,
    });
  }

  const out: Record<string, ShipmentConsolidation> = {};
  for (const [shipmentId, consolidationId] of consolidationByShipment) {
    const c = consById.get(consolidationId);
    if (c) out[shipmentId] = c;
  }
  return out;
}
