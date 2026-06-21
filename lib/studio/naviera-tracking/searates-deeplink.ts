/**
 * Deep-link a la web de tracking de SeaRates (SDD-0101 · Slice A).
 *
 * Modo por DEFECTO del tracking naviero: en vez de gastar una llamada del API
 * (cuota dura 100/mes, compartida con el cron de fletes SDD-0092), se abre la web
 * de SeaRates en el navegador. El operador/cliente ve el mapa + buque + ETA en vivo
 * en la propia herramienta de SeaRates, con CERO costo de cuota.
 *
 * Funciones PURAS (sin red, sin secretos) → testeables y reusables en ERP y portal.
 */

import type { NavieraSnapshot, TrackingRef } from "./types";

/** Base de la herramienta de tracking pública de SeaRates. */
const SEARATES_TRACKING_BASE = "https://www.searates.com/container/tracking/";

/** Normaliza un nº de contenedor/BL como se teclea en SeaRates: sin espacios, mayúsculas. */
function normalizeRef(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Elige con qué referencia trackear: prefiere el nº de CONTENEDOR (más fiable) y cae
 * al BL. Devuelve null si no hay ninguno → no se puede armar el deep-link (la UI
 * muestra el estado "sin contenedor asignado").
 */
export function pickTrackingRef(snap: NavieraSnapshot | null): TrackingRef | null {
  if (!snap) return null;
  const scac = snap.carrierScac?.trim() ? snap.carrierScac.trim().toUpperCase() : null;
  if (snap.containerNo?.trim()) {
    return { kind: "container", value: snap.containerNo.trim(), scac };
  }
  if (snap.blNumber?.trim()) {
    return { kind: "bl", value: snap.blNumber.trim(), scac };
  }
  return null;
}

/**
 * Arma la URL de tracking de SeaRates para una referencia. `type` = CT (contenedor)
 * o BL (bill of lading); `sealine` = SCAC de la naviera, o AUTO si no se conoce
 * (SeaRates autodetecta). Devuelve null si la referencia viene vacía.
 */
export function buildSeaRatesTrackingUrl(ref: TrackingRef | null): string | null {
  if (!ref) return null;
  const number = normalizeRef(ref.value);
  if (!number) return null;
  const type = ref.kind === "bl" ? "BL" : "CT";
  const sealine = ref.scac?.trim() ? normalizeRef(ref.scac) : "AUTO";
  const params = new URLSearchParams({ number, type, sealine });
  return `${SEARATES_TRACKING_BASE}?${params.toString()}`;
}

/** Atajo: snapshot → URL de tracking de SeaRates (o null si no hay con qué trackear). */
export function trackingUrlFromSnapshot(snap: NavieraSnapshot | null): string | null {
  return buildSeaRatesTrackingUrl(pickTrackingRef(snap));
}
