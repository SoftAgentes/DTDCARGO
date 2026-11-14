/**
 * Resolución del snapshot naviero de un embarque (SDD-0101 · Slice A).
 *
 * Camina la cadena que ya existe (SDD-0047) SIN duplicar dato en `shipments`:
 *   shipment → consolidation_items → consolidations → {sailings, bookings} → carriers
 *
 * Funciones puras que reciben un `SupabaseClient` (patrón del repo). El portal las
 * llama con el ADMIN client scopeado al envío PROPIO del cliente (el cliente del
 * portal no tiene RLS sobre sailings/consolidations); el ERP, con el client normal
 * (RLS por tenant). El caller decide el client — esta capa no asume cuál.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NavieraSnapshot } from "./types";
import {
  getTrackingSnapshotByConsolidation,
  type TrackingSnapshotRow,
} from "./snapshot-queries";

const EMPTY: Omit<NavieraSnapshot, "consolidationRef" | "navieraStatus"> = {
  containerNo: null,
  containerType: null,
  blNumber: null,
  carrierName: null,
  carrierScac: null,
  vessel: null,
  voyage: null,
  pol: null,
  pod: null,
  etd: null,
  eta: null,
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Snapshot naviero de UN embarque por su id, o null si no está consolidado todavía
 * (→ el caller cae a la heurística honesta). Resuelve por pasos para degradar
 * limpio cuando la cadena está a medio cargar (consolidación sin sailing, etc.).
 */
export async function getShipmentNaviera(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<NavieraSnapshot | null> {
  // 1) ¿Está el envío en algún contenedor? (la asignación más reciente gana)
  const { data: item, error: itemErr } = await supabase
    .from("consolidation_items")
    .select("consolidation_id")
    .eq("shipment_id", shipmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (itemErr || !item?.consolidation_id) return null;

  // 2) El contenedor: ref/estado/contenedor + los punteros a booking y sailing.
  const { data: c, error: cErr } = await supabase
    .from("consolidations")
    .select("ref, status, container_no, container_type, booking_id, sailing_id")
    .eq("id", item.consolidation_id as string)
    .maybeSingle();
  if (cErr || !c) return null;

  const snap: NavieraSnapshot = {
    ...EMPTY,
    consolidationRef: str(c.ref),
    navieraStatus: str(c.status),
    containerNo: str(c.container_no),
    containerType: str(c.container_type),
  };

  // 3) Sailing (buque/viaje/POL/POD/ETD/ETA) si el contenedor ya tiene zarpe.
  let sailingCarrierId: string | null = null;
  if (c.sailing_id) {
    const { data: s } = await supabase
      .from("sailings")
      .select("vessel, voyage, pol, pod, etd, eta, transit_days, carrier_id")
      .eq("id", c.sailing_id as string)
      .maybeSingle();
    if (s) {
      snap.vessel = str(s.vessel);
      snap.voyage = str(s.voyage);
      snap.pol = str(s.pol);
      snap.pod = str(s.pod);
      snap.etd = str(s.etd);
      snap.eta = str(s.eta);
      // SDD-0627 · días de mar del zarpe, para estimar desde el zarpe real.
      // Sólo se pone cuando viene: los snapshots sin él quedan iguales.
      if (typeof s.transit_days === "number" && Number.isFinite(s.transit_days)) {
        snap.transitDays = s.transit_days;
      }
      sailingCarrierId = str(s.carrier_id);
    }
  }

  // 4) Booking (BL + nº de contenedor a nivel reserva, fallback del de la consolidación).
  let bookingCarrierId: string | null = null;
  if (c.booking_id) {
    const { data: b } = await supabase
      .from("bookings")
      .select("bl_number, container_no, carrier_id")
      .eq("id", c.booking_id as string)
      .maybeSingle();
    if (b) {
      snap.blNumber = str(b.bl_number);
      snap.containerNo = snap.containerNo ?? str(b.container_no);
      bookingCarrierId = str(b.carrier_id);
    }
  }

  // 5) Naviera: la del sailing manda; cae a la del booking.
  const carrierId = sailingCarrierId ?? bookingCarrierId;
  if (carrierId) {
    const { data: car } = await supabase
      .from("carriers")
      .select("name, scac")
      .eq("id", carrierId)
      .maybeSingle();
    if (car) {
      snap.carrierName = str(car.name);
      snap.carrierScac = str(car.scac);
    }
  }

  return snap;
}

/**
 * Snapshot VIVO de SeaRates del envío (SDD-0101 · Slice B.3), resuelto por su
 * consolidación. SOLO LECTURA del cache (el refresh lo dispara el ERP, no el portal
 * → cero cuota). En el portal recibe el admin client (sin RLS sobre
 * tracking_snapshots), scopeado al envío PROPIO del cliente. null si no se rastreó.
 */
export async function getShipmentTrackingSnapshot(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<TrackingSnapshotRow | null> {
  const { data: item, error } = await supabase
    .from("consolidation_items")
    .select("consolidation_id")
    .eq("shipment_id", shipmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !item?.consolidation_id) return null;
  return getTrackingSnapshotByConsolidation(
    supabase,
    item.consolidation_id as string,
  );
}
