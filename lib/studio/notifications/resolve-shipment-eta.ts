/**
 * Resolución del ETA/ETD de un embarque para anclar avisos al cliente
 * (SDD-0156 · Slice D).
 *
 * Cierra el seam que en Slice A devolvía null a propósito: una regla anclada en
 * `eta`/`etd` ahora resuelve una fecha real caminando la cadena naviera que YA
 * existe (SDD-0047/0101), SIN duplicar dato en `shipments` ni escribir JOINs
 * nuevos — reusa `getShipmentTrackingSnapshot` (SeaRates vivo) y
 * `getShipmentNaviera` (sailings). Orden de preferencia para el ETA:
 *
 *   1. `tracking_snapshots.pod_eta`  — SeaRates vivo (lo más fiel; SDD-0101).
 *   2. `sailings.eta`                — itinerario de la naviera (SDD-0047).
 *   3. `warehouse_receipts_ve.eta`   — ETA anunciada al recibir en VE (SDD-0067),
 *                                      resuelta por el Shipping Mark del envío.
 *
 * Sin ninguna fuente → null: la regla anclada en ETA se salta (no rompe), tal
 * como documenta la spec.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getShipmentNaviera,
  getShipmentTrackingSnapshot,
} from "@/lib/studio/naviera-tracking/queries";

/**
 * Parsea una fecha de fuente heterogénea (ISO de SeaRates o `date` 'YYYY-MM-DD'
 * de Postgres) a un `Date` válido, o null si no es parseable. Una `date` pura la
 * ancla a mediodía UTC para que el offset en minutos no cruce de día por el
 * corrimiento de zona horaria.
 */
export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  // 'YYYY-MM-DD' (columna date de Postgres) → mediodía UTC (estable ante TZ).
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * ETA del embarque (Date) o null. Recorre pod_eta → sailings.eta →
 * warehouse_receipts_ve.eta. Best-effort: cualquier fallo de la cadena degrada a
 * la siguiente fuente y, si todas fallan, a null.
 */
export async function resolveShipmentEta(
  admin: SupabaseClient,
  shipmentId: string,
): Promise<Date | null> {
  // 1) SeaRates vivo (pod_eta) por consolidación.
  try {
    const snap = await getShipmentTrackingSnapshot(admin, shipmentId);
    const fromLive = parseFlexibleDate(snap?.podEta);
    if (fromLive) return fromLive;
  } catch {
    /* degrada a la siguiente fuente */
  }

  // 2) sailings.eta vía shipment → consolidation → sailing.
  try {
    const naviera = await getShipmentNaviera(admin, shipmentId);
    const fromSailing = parseFlexibleDate(naviera?.eta);
    if (fromSailing) return fromSailing;
  } catch {
    /* degrada a la siguiente fuente */
  }

  // 3) warehouse_receipts_ve.eta por el Shipping Mark del envío (la más reciente).
  try {
    const fromReceipt = await resolveReceiptVeEta(admin, shipmentId);
    if (fromReceipt) return fromReceipt;
  } catch {
    /* sin ETA */
  }

  return null;
}

/**
 * ETD del embarque (Date) o null: `sailings.etd` vía la cadena naviera. El ETD no
 * tiene equivalente en SeaRates ni en recepción VE, así que es una única fuente.
 */
export async function resolveShipmentEtd(
  admin: SupabaseClient,
  shipmentId: string,
): Promise<Date | null> {
  try {
    const naviera = await getShipmentNaviera(admin, shipmentId);
    return parseFlexibleDate(naviera?.etd);
  } catch {
    return null;
  }
}

/**
 * ETA anunciada en la recepción VE: busca la caja esperada con el Shipping Mark
 * del envío y toma el `eta` de su recibo (el más reciente). El vínculo box→envío
 * es por `markbox` (las cajas VE no guardan shipment_id); si el cliente tiene
 * varias cajas en curso, gana la de la recepción creada más tarde.
 */
async function resolveReceiptVeEta(
  admin: SupabaseClient,
  shipmentId: string,
): Promise<Date | null> {
  const { data: shipment } = await admin
    .from("shipments")
    .select("client_markbox")
    .eq("id", shipmentId)
    .maybeSingle<{ client_markbox: string | null }>();
  const markbox = shipment?.client_markbox?.trim();
  if (!markbox) return null;

  const { data: box } = await admin
    .from("warehouse_receipt_ve_boxes")
    .select("warehouse_receipts_ve!inner(eta, created_at)")
    .eq("markbox", markbox)
    .not("warehouse_receipts_ve.eta", "is", null)
    .order("created_at", {
      ascending: false,
      referencedTable: "warehouse_receipts_ve",
    })
    .limit(1)
    .maybeSingle<{ warehouse_receipts_ve: { eta: string | null } | null }>();

  return parseFlexibleDate(box?.warehouse_receipts_ve?.eta ?? null);
}
