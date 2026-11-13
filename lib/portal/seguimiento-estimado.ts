/**
 * Seguimiento estimado (SDD-0627): «cuando salga el envío, estimamos los
 * tiempos y sobre eso le vamos avisando al cliente» (Sam, 2026-11-13).
 *
 * Todo puro: sin DB, sin React, sin reloj. Recibe lo que ya existe y devuelve
 * una fecha ESTIMADA por etapa del stepper.
 *
 * ── De dónde sale cada dato (medido antes de crear nada) ─────────────────────
 * · Fecha del zarpe: el evento `shipped` del historial del envío. La 0477
 *   (SDD-0530) lo inserta en la misma transacción que pone el contenedor en
 *   «zarpado». Si el envío está embarcado sin ese evento (un lote cargado por
 *   SQL), se usa el ETD del itinerario (`sailings.etd`).
 * · Días de tránsito por ruta: `sailings.transit_days` del zarpe del
 *   contenedor (0096). Si falta, la diferencia ETA − ETD del mismo zarpe. Si
 *   tampoco, el default por puerto de descarga de abajo.
 * · Etapas después del puerto: días fijos de aduana y de reparto. Son
 *   estimaciones de oficina, no datos de la naviera: se muestran como tales.
 *
 * Sin tabla nueva ni migración: `sailings` ya tiene `transit_days`.
 */
import type { ShipmentService, ShipmentStatus } from "@/lib/shared/shipment-public";
import { flowForService } from "@/lib/studio/tracking-progress";

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Días de mar por puerto de descarga cuando el zarpe no trae los suyos. Los
 * códigos son los de `ports` (0096): PBL Puerto Cabello, LGU La Guaira.
 * Valores de partida para calibrar con la operación (pendiente en el handoff).
 */
export const DIAS_TRANSITO_POR_PUERTO: Readonly<Record<string, number>> = {
  PBL: 40,
  LGU: 42,
};

/** Días de mar cuando no hay zarpe, ni ETA, ni puerto conocido. */
export const DIAS_TRANSITO_DEFAULT = 40;

/** Transporte terrestre interno: del despacho a la entrega. */
export const DIAS_TERRESTRE = 3;

/**
 * Días desde la llegada a puerto hasta cada etapa siguiente (acumulados). La
 * aduana empieza el día del arribo; la bodega VE, cuando libera la aduana.
 */
export const DIAS_DESDE_PUERTO: Readonly<Partial<Record<ShipmentStatus, number>>> = {
  in_customs: 0,
  arrived_destination: 10,
  out_for_delivery: 12,
  last_mile: 13,
  delivered: 14,
};

/** Itinerario del contenedor, tal como sale de `sailings`. Todo opcional. */
export type ZarpeItinerario = {
  pod?: string | null;
  etd?: string | null;
  eta?: string | null;
  transitDays?: number | null;
};

export type FuenteTransito = "zarpe" | "itinerario" | "puerto" | "default";

export type SeguimientoEstimado = {
  /** Fecha del zarpe usada como ancla (ISO). */
  zarpeIso: string;
  /** Llegada estimada a puerto venezolano (ISO). */
  etaPuertoIso: string;
  /** Días de mar usados. */
  diasTransito: number;
  /** De dónde salieron los días de mar (para decirlo con honestidad). */
  fuente: FuenteTransito;
  /**
   * Fecha estimada de las etapas que TODAVÍA no ocurrieron. Las cumplidas no
   * aparecen: para esas manda la fecha real del historial.
   */
  porEtapa: Partial<Record<ShipmentStatus, string>>;
  /** Fecha estimada de entrega (la última etapa del flujo), si no ocurrió. */
  entregaIso: string | null;
};

/** 'YYYY-MM-DD' o ISO completo → ms; null si no se puede leer. */
export function leerFecha(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? Date.parse(`${raw}T12:00:00Z`)
    : Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** Días de mar y su fuente. Nunca negativo ni absurdo: fuera de 1–120 se ignora. */
export function diasDeTransito(
  itinerario: ZarpeItinerario | null | undefined,
): { dias: number; fuente: FuenteTransito } {
  const t = itinerario?.transitDays;
  if (typeof t === "number" && Number.isFinite(t) && t >= 1 && t <= 120) {
    return { dias: Math.round(t), fuente: "zarpe" };
  }
  const etd = leerFecha(itinerario?.etd);
  const eta = leerFecha(itinerario?.eta);
  if (etd != null && eta != null) {
    const dias = Math.round((eta - etd) / DIA_MS);
    if (dias >= 1 && dias <= 120) return { dias, fuente: "itinerario" };
  }
  const pod = itinerario?.pod?.trim().toUpperCase();
  if (pod && DIAS_TRANSITO_POR_PUERTO[pod] != null) {
    return { dias: DIAS_TRANSITO_POR_PUERTO[pod], fuente: "puerto" };
  }
  return { dias: DIAS_TRANSITO_DEFAULT, fuente: "default" };
}

/** Estados en que el envío ya no tiene tránsito que estimar. */
const SIN_ESTIMACION: ReadonlySet<ShipmentStatus> = new Set<ShipmentStatus>([
  "draft",
  "cancelled",
  "delivered",
  "exception",
]);

/**
 * Seguimiento estimado del envío, o null si todavía no zarpó (no se estima
 * antes del zarpe: es la decisión de Sam) o si ya no aplica.
 *
 * @param stepDates fecha real por estado (el primer evento de cada uno).
 */
export function estimarSeguimiento(input: {
  status: ShipmentStatus;
  service: ShipmentService;
  stepDates?: Partial<Record<ShipmentStatus, string>> | null;
  itinerario?: ZarpeItinerario | null;
}): SeguimientoEstimado | null {
  const { status, service } = input;
  if (SIN_ESTIMACION.has(status)) return null;

  const flow = flowForService(service);
  const idxShipped = flow.indexOf("shipped");
  const idxActual = flow.indexOf(status === "delayed_warehouse" ? "arrived_destination" : status);
  // Antes del zarpe no hay nada que estimar.
  if (idxShipped < 0 || idxActual < idxShipped) return null;

  const stepDates = input.stepDates ?? {};
  const zarpeMs = leerFecha(stepDates.shipped) ?? leerFecha(input.itinerario?.etd);
  if (zarpeMs == null) return null;

  const terrestre = service === "transporte_terrestre";
  const { dias, fuente } = terrestre
    ? { dias: 0, fuente: "default" as FuenteTransito }
    : diasDeTransito(input.itinerario);
  // Si la carga ya llegó a puerto (aduana con fecha real), el resto se ancla
  // en esa fecha y no en el estimado de mar.
  const aduanaReal = leerFecha(stepDates.in_customs);
  const puertoMs = aduanaReal ?? zarpeMs + dias * DIA_MS;

  const porEtapa: Partial<Record<ShipmentStatus, string>> = {};
  for (let i = idxActual + 1; i < flow.length; i++) {
    const etapa = flow[i];
    let ms: number | null = null;
    if (terrestre) {
      // Terrestre: el reparto y la entrega se reparten en DIAS_TERRESTRE.
      if (etapa === "in_transit") ms = zarpeMs + 1 * DIA_MS;
      else if (etapa === "out_for_delivery") ms = zarpeMs + (DIAS_TERRESTRE - 1) * DIA_MS;
      else if (etapa === "last_mile") ms = zarpeMs + (DIAS_TERRESTRE - 1) * DIA_MS;
      else if (etapa === "delivered") ms = zarpeMs + DIAS_TERRESTRE * DIA_MS;
    } else if (etapa === "in_transit") {
      ms = zarpeMs + 1 * DIA_MS;
    } else {
      const offset = DIAS_DESDE_PUERTO[etapa];
      if (offset != null) ms = puertoMs + offset * DIA_MS;
    }
    if (ms != null) porEtapa[etapa] = new Date(ms).toISOString();
  }

  const ultima = flow[flow.length - 1];
  return {
    zarpeIso: new Date(zarpeMs).toISOString(),
    etaPuertoIso: new Date(puertoMs).toISOString(),
    diasTransito: dias,
    fuente,
    porEtapa,
    entregaIso: porEtapa[ultima] ?? null,
  };
}

/** Rótulo honesto de la fuente para el pie del stepper. */
export function rotuloFuente(fuente: FuenteTransito): string {
  switch (fuente) {
    case "zarpe":
      return "con los días de tránsito del zarpe";
    case "itinerario":
      return "con el itinerario de la naviera";
    case "puerto":
      return "con el tiempo habitual de la ruta";
    case "default":
      return "con el tiempo habitual de la ruta";
  }
}
