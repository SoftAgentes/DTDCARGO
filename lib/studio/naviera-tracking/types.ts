/**
 * Tipos del tracking naviero (SDD-0101 · Naviera Tier 1).
 *
 * El snapshot naviero de un embarque se RESUELVE de la cadena que ya existe
 * (SDD-0047): shipment → consolidation_items → consolidations → bookings/sailings →
 * carriers. No se duplica el dato en `shipments`. Ver `queries.ts`.
 */

/**
 * Foto naviera de UN embarque, resuelta de la cadena de consolidación. Todos los
 * campos son nullable: la cadena puede estar parcialmente cargada (un envío recién
 * asignado a un contenedor sin sailing todavía).
 */
export type NavieraSnapshot = {
  /** Ref del contenedor de consolidación (DTD-CONSOL-NNNN). */
  consolidationRef: string | null;
  /** Estado del contenedor: consolidando | cerrado | zarpado | arribado. */
  navieraStatus: string | null;
  /** Nº físico del contenedor (ej COSU1234567) — clave de tracking. */
  containerNo: string | null;
  /** Tipo de contenedor (20GP/40GP/40HC). */
  containerType: string | null;
  /** Bill of Lading (clave alternativa de tracking). */
  blNumber: string | null;
  /** Naviera (carrier) — nombre legible. */
  carrierName: string | null;
  /** SCAC de la naviera (Standard Carrier Alpha Code) — para fijar el sealine. */
  carrierScac: string | null;
  /** Buque (ej 'COSCO FORTUNE'). */
  vessel: string | null;
  /** Viaje (ej '048W'). */
  voyage: string | null;
  /** Puerto de carga (código, ej 'NGB'). */
  pol: string | null;
  /** Puerto de descarga (código, ej 'PBL'). */
  pod: string | null;
  /** ETD real del zarpe (date YYYY-MM-DD). */
  etd: string | null;
  /** ETA real del arribo (date YYYY-MM-DD). */
  eta: string | null;
};

/** ¿El snapshot tiene data naviera útil que mostrar (más que solo el ref)? */
export function hasNavieraData(snap: NavieraSnapshot | null): snap is NavieraSnapshot {
  if (!snap) return false;
  return Boolean(
    snap.vessel || snap.etd || snap.eta || snap.containerNo || snap.blNumber,
  );
}

/**
 * Referencia con la que se trackea en SeaRates: por contenedor (CT) o por BL.
 * `scac` fija el sealine; si falta, SeaRates lo autodetecta (AUTO).
 */
export type TrackingRef = {
  kind: "container" | "bl";
  value: string;
  scac: string | null;
};
