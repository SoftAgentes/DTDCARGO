/**
 * Seguimiento estimado (SDD-0627): «cuando salga el envío, estimamos los
 * tiempos y sobre eso le vamos avisando al cliente» (Sam, 2026-11-13).
 *
 * Todo puro: sin DB, sin React y sin leer el reloj. «Hoy» lo pasa quien llama
 * (`ahoraIso`): una fecha estimada que ya pasó no se muestra como si siguiera
 * en pie. Recibe lo que ya existe y devuelve una fecha ESTIMADA por etapa del
 * stepper.
 *
 * ── Precedencia de la llegada a puerto (la misma de resolve-shipment-eta) ────
 * 1. Fecha real de aduana (el evento `in_customs`).
 * 2. ETA conocida: la de SeaRates (`pod_eta`) o la del itinerario
 *    (`sailings.eta`), la que el Portal ya muestra en la tarjeta Naviera.
 * 3. Estimada: zarpe + días de mar. Último recurso.
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
 * Días de la carga a la ETA por puerto de descarga, cuando el zarpe no trae
 * los suyos. Calibrado con el rastreo real de DTD (Subdirector Portal,
 * 2026-11-13): CMA CGM a La Guaira 59–75 días → punto medio 67. Los códigos son
 * los de `ports` (0096). Maracaibo (63–71) y Barranquilla (46–49) no tienen
 * código en ese catálogo: caen al default (límite anotado en la spec).
 */
export const DIAS_TRANSITO_POR_PUERTO: Readonly<Record<string, number>> = {
  LGU: 67,
};

/**
 * Días de mar cuando no hay zarpe, ni ETA, ni puerto conocido: la ruta
 * principal (La Guaira, 59–75 → 67).
 */
export const DIAS_TRANSITO_DEFAULT = 67;

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

export type FuenteTransito =
  | "aduana"
  | "naviera"
  | "zarpe"
  | "itinerario"
  | "puerto"
  | "default"
  | "terrestre";

export type SeguimientoEstimado = {
  /** Fecha del zarpe (o del despacho, en terrestre) usada como ancla (ISO). */
  zarpeIso: string;
  /**
   * Llegada a puerto venezolano (ISO). null en terrestre (no hay puerto) y
   * cuando la estimación ya venció sin que se confirmara la llegada.
   */
  etaPuertoIso: string | null;
  /**
   * true si la carga YA pasó por el puerto: hay fecha real de aduana, o el
   * envío está en aduana o más adelante aunque falte ese evento (un salto de
   * estado o un lote cargado por SQL). Entonces el puerto nunca sale «por
   * confirmar».
   */
  puertoReal: boolean;
  /** Días de mar usados. */
  diasTransito: number;
  /** De dónde salió la llegada a puerto (para decirlo con honestidad). */
  fuente: FuenteTransito;
  /**
   * Etapas cuya fecha estimada ya pasó sin que ocurrieran: se muestran como
   * «Por confirmar», nunca con la fecha vencida.
   */
  vencidas: ShipmentStatus[];
  /**
   * Fecha estimada de las etapas que TODAVÍA no ocurrieron. Las cumplidas no
   * aparecen: para esas manda la fecha real del historial.
   */
  porEtapa: Partial<Record<ShipmentStatus, string>>;
  /** Fecha estimada de entrega (la última etapa del flujo), si no ocurrió ni venció. */
  entregaIso: string | null;
  /** true si la entrega estimada ya pasó: la pantalla dice «Pendiente de confirmar». */
  entregaVencida: boolean;
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
 * ETA de SeaRates sólo si la última consulta salió bien. Cuando SeaRates falla,
 * la fila conserva el `pod_eta` viejo con `fetch_status = "error"`: ese valor ya
 * no se usa. Lo comparten la tarjeta Naviera, la nota del stepper y los avisos
 * (`resolve-shipment-eta`), para que nunca den dos llegadas distintas.
 */
export function etaPodVigente(
  live: { fetchStatus: string; podEta: string | null } | null | undefined,
): string | null {
  return live != null && live.fetchStatus === "ok" ? live.podEta : null;
}

/** ETA conocida del puerto: SeaRates vigente → itinerario (`sailings.eta`). */
export function etaPuertoConocida(
  live: { fetchStatus: string; podEta: string | null } | null | undefined,
  naviera: { eta: string | null } | null | undefined,
): string | null {
  return etaPodVigente(live) ?? naviera?.eta ?? null;
}

/** Día de calendario en Caracas ('YYYY-MM-DD') de un instante. */
export function diaCaracas(ms: number): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

/**
 * Seguimiento estimado del envío, o null si todavía no zarpó (no se estima
 * antes del zarpe: es la decisión de Sam) o si ya no aplica.
 *
 * @param stepDates fecha real por estado (el primer evento de cada uno).
 * @param etaPuertoConocida ETA de SeaRates o del itinerario, si existe.
 * @param ahoraIso «hoy»; sin él no se marca nada como vencido (lo usan los
 *   avisos, que anclan contra su propio reloj).
 */
export function estimarSeguimiento(input: {
  status: ShipmentStatus;
  service: ShipmentService;
  stepDates?: Partial<Record<ShipmentStatus, string>> | null;
  itinerario?: ZarpeItinerario | null;
  etaPuertoConocida?: string | null;
  ahoraIso?: string | null;
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

  const ahoraMs = leerFecha(input.ahoraIso);
  const hoy = ahoraMs == null ? null : diaCaracas(ahoraMs);
  const vencida = (ms: number) => hoy != null && diaCaracas(ms) < hoy;

  const terrestre = service === "transporte_terrestre";

  // Llegada a puerto: aduana real → ETA conocida → zarpe + días de mar.
  let puertoMs: number | null = null;
  let fuente: FuenteTransito = "terrestre";
  let dias = 0;
  let puertoReal = false;
  if (!terrestre) {
    const idxAduana = flow.indexOf("in_customs");
    // En aduana o más adelante, el puerto ya ocurrió, con o sin su evento.
    const pasoPuerto = idxAduana >= 0 && idxActual >= idxAduana;
    const aduanaReal = leerFecha(stepDates.in_customs);
    const etaConocida = leerFecha(input.etaPuertoConocida);
    const mar = diasDeTransito(input.itinerario);
    dias = mar.dias;
    if (aduanaReal != null) {
      puertoMs = aduanaReal;
      fuente = "aduana";
      puertoReal = true;
    } else if (etaConocida != null) {
      puertoMs = etaConocida;
      fuente = "naviera";
    } else {
      puertoMs = zarpeMs + dias * DIA_MS;
      fuente = mar.fuente;
    }
    if (pasoPuerto) puertoReal = true;
  }

  const porEtapa: Partial<Record<ShipmentStatus, string>> = {};
  const vencidas: ShipmentStatus[] = [];
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
    } else if (puertoMs != null) {
      const offset = DIAS_DESDE_PUERTO[etapa];
      if (offset != null) ms = puertoMs + offset * DIA_MS;
    }
    if (ms == null) continue;
    if (vencida(ms)) vencidas.push(etapa);
    else porEtapa[etapa] = new Date(ms).toISOString();
  }

  const ultima = flow[flow.length - 1];
  const puertoVencido = !puertoReal && puertoMs != null && vencida(puertoMs);
  return {
    zarpeIso: new Date(zarpeMs).toISOString(),
    etaPuertoIso: puertoMs == null || puertoVencido ? null : new Date(puertoMs).toISOString(),
    puertoReal,
    diasTransito: dias,
    fuente,
    vencidas,
    porEtapa,
    entregaIso: porEtapa[ultima] ?? null,
    entregaVencida: vencidas.includes(ultima),
  };
}

/** Rótulo honesto de la fuente para la nota del stepper. */
export function rotuloFuente(fuente: FuenteTransito): string {
  switch (fuente) {
    case "aduana":
      return "desde la llegada real a puerto";
    case "naviera":
      return "desde la llegada a puerto que informó la naviera";
    case "zarpe":
      return "desde el zarpe, con los días de tránsito del zarpe";
    case "itinerario":
      return "desde el zarpe, con el itinerario de la naviera";
    case "puerto":
      return "desde el zarpe, con el tiempo habitual hasta ese puerto";
    case "default":
      return "desde el zarpe, con el tiempo habitual de la ruta principal";
    case "terrestre":
      return "desde el despacho, con el tiempo habitual del transporte terrestre";
  }
}
