/**
 * Tracking por contenedor (SDD-0659). PURO: sin base de datos ni reloj propio.
 *
 * La pantalla de Tracking lista contenedores (consolidados) y no envíos sueltos.
 * Este módulo arma lo que la pantalla necesita de cada contenedor: en qué grupo
 * cae, qué tan avanzado va, dónde se dibuja en el mapa y sus hitos.
 *
 * Dos reglas que no se negocian:
 *  - Una posición estimada se marca como estimada. La fuente va siempre en
 *    `PosicionContenedor.fuente` y la pantalla la rotula.
 *  - Sin dato no se inventa: si no hay ETA, `eta` es null y los días son null.
 */

import {
  CONTAINER_TYPES,
  containerStatusLabel,
  isContainerTypeCode,
  type ContainerStatus,
} from "@/lib/studio/naviera/types";
import {
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import {
  buildTimeline,
  computeProgress,
  type TimelineStepState,
} from "@/lib/studio/tracking-progress";

/** Dónde está un contenedor a efectos de la lista. */
export type GrupoContenedor = "mar" | "origen" | "destino" | "entregado";

/** Lo que se puede elegir en los filtros: los tres grupos vivos y «sin contenedor». */
export type FiltroTracking = "mar" | "origen" | "destino" | "sin";

export const FILTROS_TRACKING: readonly FiltroTracking[] = [
  "mar",
  "origen",
  "destino",
  "sin",
];

export const FILTRO_LABEL: Record<FiltroTracking, string> = {
  mar: "En mar",
  origen: "En origen",
  destino: "En destino",
  sin: "Sin contenedor",
};

export function esFiltroTracking(v: unknown): v is FiltroTracking {
  return typeof v === "string" && (FILTROS_TRACKING as readonly string[]).includes(v);
}

/** Días que un contenedor arribado sin envíos enlazados sigue en «En destino». */
export const DIAS_EN_DESTINO_SIN_ENLACE = 30;

const ESTADOS_FUERA_DE_CURSO: ReadonlySet<ShipmentStatus> = new Set([
  "delivered",
  "cancelled",
  "draft",
]);

const ESTADOS_DE_ALERTA: ReadonlySet<ShipmentStatus> = new Set([
  "exception",
  "delayed_warehouse",
]);

const DIA_MS = 86_400_000;

/** Servicio con el que se arma la línea de hitos de un contenedor marítimo. */
const SERVICIO_DEL_CONTENEDOR = "consolidado_lcl" as const;

// ── Entradas ────────────────────────────────────────────────────

export type ContenedorCrudo = {
  id: string;
  ref: string | null;
  container_no: string | null;
  container_type: string | null;
  status: ContainerStatus;
  updated_at: string;
};

export type ItemCrudo = {
  id: string;
  shipment_id: string | null;
  client_markbox: string | null;
  client_name: string | null;
  cbm: number;
  weight_kg: number;
  pieces: number;
};

export type ItinerarioCrudo = {
  vessel: string | null;
  pol: string | null;
  pod: string | null;
  etd: string | null;
  eta: string | null;
};

export type RastreoCrudo = {
  vessel: string | null;
  podEta: string | null;
  lastLat: number | null;
  lastLng: number | null;
  fetchedAt: string;
};

/** Lo mínimo de un envío para saber cómo va dentro del contenedor. */
export type EnvioDelItem = {
  id: string;
  code: string;
  status: ShipmentStatus;
  destination: string | null;
};

// ── Salidas ─────────────────────────────────────────────────────

export type FuentePosicion = "naviera" | "itinerario" | "estado";

export type PosicionContenedor = {
  /** 0 = puerto de salida, 1 = puerto de llegada. Fuera del mar es 0 o 1. */
  avanceDeMar: number;
  /** Solo con fuente `naviera`: la última posición que reportó el rastreo. */
  lon: number | null;
  lat: number | null;
  fuente: FuentePosicion;
  /** Fecha del dato cuando la fuente es `naviera`. */
  fecha: string | null;
};

export type ClienteDelContenedor = {
  itemId: string;
  shipmentId: string | null;
  shipmentCode: string | null;
  client_markbox: string | null;
  client_name: string | null;
  pieces: number;
  cbm: number;
  weight_kg: number;
  destination: string | null;
  status: ShipmentStatus | null;
};

export type ContenedorVista = {
  id: string;
  /** Lo que se muestra como nombre: la referencia, o el número físico si no hay. */
  nombre: string;
  ref: string | null;
  containerNo: string | null;
  containerType: string | null;
  grupo: GrupoContenedor;
  estadoLabel: string;
  /** Estado de envío que representa al contenedor en la línea de hitos. */
  statusEnvio: ShipmentStatus;
  vessel: string | null;
  pol: string | null;
  pod: string | null;
  etd: string | null;
  eta: string | null;
  etaFuente: "naviera" | "itinerario" | null;
  diasRestantes: number | null;
  progreso: number;
  /** Clientes distintos del contenedor, no ítems: un cliente con tres cargas cuenta una vez. */
  clientes: number;
  usedCbm: number;
  capCbm: number | null;
  /** Envíos del contenedor con alerta o bodegaje. */
  alertas: number;
  posicion: PosicionContenedor;
  items: ClienteDelContenedor[];
};

export type HitoContenedor = {
  status: ShipmentStatus;
  label: string;
  state: TimelineStepState;
  fecha: string | null;
  /** true = la fecha es del plan (itinerario); false = ocurrió. */
  planificada: boolean;
};

// ── Reglas ──────────────────────────────────────────────────────

const enCurso = (s: ShipmentStatus | null): s is ShipmentStatus =>
  s !== null && !ESTADOS_FUERA_DE_CURSO.has(s);

function tiempo(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Grupo del contenedor. null = no es de Tracking (solicitud sin autorizar o
 * rechazada).
 *
 * Un contenedor arribado sigue «En destino» mientras alguno de sus envíos siga
 * en curso. Si ninguno de sus ítems está enlazado a un envío no hay cómo
 * saberlo: se muestra en destino durante `DIAS_EN_DESTINO_SIN_ENLACE` días
 * desde su último cambio y después pasa a entregado.
 */
export function grupoDelContenedor(
  status: ContainerStatus,
  estadosDeEnvios: readonly (ShipmentStatus | null)[],
  ultimoCambio: string | null,
  ahora: Date,
): GrupoContenedor | null {
  if (status === "solicitada" || status === "rechazada") return null;
  if (status === "consolidando" || status === "cerrado") return "origen";
  if (status === "zarpado") return "mar";

  const conocidos = estadosDeEnvios.filter((s): s is ShipmentStatus => s !== null);
  if (conocidos.length > 0) {
    return conocidos.some(enCurso) ? "destino" : "entregado";
  }
  const t = tiempo(ultimoCambio);
  if (t === null) return "entregado";
  return ahora.getTime() - t <= DIAS_EN_DESTINO_SIN_ENLACE * DIA_MS
    ? "destino"
    : "entregado";
}

/** Estado de envío que representa al contenedor en hitos y progreso. */
export function statusDelContenedor(
  grupo: GrupoContenedor,
  estadosDeEnvios: readonly (ShipmentStatus | null)[],
): ShipmentStatus {
  if (grupo === "origen") return "consolidating";
  if (grupo === "mar") return "in_transit";
  if (grupo === "entregado") return "delivered";
  // En destino manda el envío más atrasado que siga en curso: el contenedor no
  // «salió de aduana» hasta que salió el último.
  const vivos = estadosDeEnvios.filter(
    (s): s is ShipmentStatus => enCurso(s) && !ESTADOS_DE_ALERTA.has(s),
  );
  if (vivos.length === 0) return "in_customs";
  return vivos.reduce((a, b) => (computeProgress(b) < computeProgress(a) ? b : a));
}

/** Días calendario de hoy a la ETA. Negativo = la ETA ya pasó. */
export function diasHasta(eta: string | null, ahora: Date): number | null {
  const t = tiempo(eta);
  if (t === null) return null;
  return Math.ceil((t - ahora.getTime()) / DIA_MS);
}

/**
 * Dónde se dibuja el contenedor.
 *
 * En mar: la posición del rastreo de la naviera si existe; si no, la proporción
 * del viaje según las fechas del itinerario; si tampoco hay fechas, el medio del
 * tramo. Las dos últimas son estimaciones y así se rotulan.
 */
export function posicionDelContenedor(
  grupo: GrupoContenedor,
  itinerario: ItinerarioCrudo | null,
  rastreo: RastreoCrudo | null,
  ahora: Date,
): PosicionContenedor {
  if (grupo !== "mar") {
    return {
      avanceDeMar: grupo === "origen" ? 0 : 1,
      lon: null,
      lat: null,
      fuente: "estado",
      fecha: null,
    };
  }
  if (rastreo && rastreo.lastLat !== null && rastreo.lastLng !== null) {
    return {
      avanceDeMar: 0.5,
      lon: rastreo.lastLng,
      lat: rastreo.lastLat,
      fuente: "naviera",
      fecha: rastreo.fetchedAt,
    };
  }
  const etd = tiempo(itinerario?.etd ?? null);
  const eta = tiempo(rastreo?.podEta ?? itinerario?.eta ?? null);
  if (etd !== null && eta !== null && eta > etd) {
    const avance = (ahora.getTime() - etd) / (eta - etd);
    return {
      // Zarpado y sin arribo registrado: ni pegado al puerto de salida ni al de
      // llegada, aunque las fechas digan otra cosa.
      avanceDeMar: Math.min(0.97, Math.max(0.03, avance)),
      lon: null,
      lat: null,
      fuente: "itinerario",
      fecha: null,
    };
  }
  return { avanceDeMar: 0.5, lon: null, lat: null, fuente: "estado", fecha: null };
}

/** Progreso 0–100. En mar avanza con el viaje; fuera del mar, por estado. */
export function progresoDelContenedor(
  grupo: GrupoContenedor,
  statusEnvio: ShipmentStatus,
  posicion: PosicionContenedor,
): number {
  if (grupo !== "mar" || posicion.fuente === "estado") {
    return computeProgress(statusEnvio);
  }
  if (posicion.fuente === "naviera") return computeProgress("in_transit");
  const zarpe = computeProgress("shipped");
  const aduana = computeProgress("in_customs");
  return Math.round(zarpe + posicion.avanceDeMar * (aduana - zarpe));
}

export function nombreDelContenedor(c: Pick<ContenedorCrudo, "ref" | "container_no">): string {
  return c.ref ?? c.container_no ?? "Contenedor sin referencia";
}

/**
 * Clientes distintos entre los ítems de un contenedor. Misma llave que
 * Embarques (`embarques-contenedores.ts`): el Shipping Mark o, si falta, el
 * nombre. Así las dos pantallas dan el mismo número para el mismo contenedor.
 */
export function contarClientes(
  items: readonly Pick<ItemCrudo, "client_markbox" | "client_name">[],
): number {
  return new Set(
    items.map(
      (it) =>
        it.client_markbox?.trim() || `__name:${(it.client_name ?? "").trim().toLowerCase()}`,
    ),
  ).size;
}

export function armarContenedor(
  c: ContenedorCrudo,
  items: readonly ItemCrudo[],
  enviosPorId: ReadonlyMap<string, EnvioDelItem>,
  itinerario: ItinerarioCrudo | null,
  rastreo: RastreoCrudo | null,
  ahora: Date,
): ContenedorVista | null {
  const clientes: ClienteDelContenedor[] = items.map((it) => {
    const envio = it.shipment_id ? enviosPorId.get(it.shipment_id) : undefined;
    return {
      itemId: it.id,
      shipmentId: it.shipment_id,
      shipmentCode: envio?.code ?? null,
      client_markbox: it.client_markbox,
      client_name: it.client_name,
      pieces: it.pieces,
      cbm: it.cbm,
      weight_kg: it.weight_kg,
      destination: envio?.destination ?? null,
      status: envio?.status ?? null,
    };
  });
  const estados = clientes.map((x) => x.status);

  const grupo = grupoDelContenedor(c.status, estados, c.updated_at, ahora);
  if (grupo === null) return null;

  const statusEnvio = statusDelContenedor(grupo, estados);
  const posicion = posicionDelContenedor(grupo, itinerario, rastreo, ahora);
  const etaNaviera = rastreo?.podEta ?? null;
  const eta = etaNaviera ?? itinerario?.eta ?? null;
  const cap = isContainerTypeCode(c.container_type)
    ? CONTAINER_TYPES[c.container_type].cbm
    : null;

  return {
    id: c.id,
    nombre: nombreDelContenedor(c),
    ref: c.ref,
    containerNo: c.container_no,
    containerType: c.container_type,
    grupo,
    estadoLabel:
      grupo === "destino" || grupo === "entregado"
        ? STATUS_LABELS[statusEnvio]
        : containerStatusLabel(c.status),
    statusEnvio,
    vessel: rastreo?.vessel ?? itinerario?.vessel ?? null,
    pol: itinerario?.pol ?? null,
    pod: itinerario?.pod ?? null,
    etd: itinerario?.etd ?? null,
    eta,
    etaFuente: etaNaviera ? "naviera" : eta ? "itinerario" : null,
    diasRestantes: grupo === "mar" || grupo === "origen" ? diasHasta(eta, ahora) : null,
    progreso: progresoDelContenedor(grupo, statusEnvio, posicion),
    clientes: contarClientes(items),
    usedCbm: clientes.reduce((s, x) => s + (Number(x.cbm) || 0), 0),
    capCbm: cap,
    alertas: estados.filter((s) => s !== null && ESTADOS_DE_ALERTA.has(s)).length,
    posicion,
    items: clientes,
  };
}

/** Orden de la lista: lo que llega antes, primero; sin ETA, al final. */
export function ordenarContenedores(lista: readonly ContenedorVista[]): ContenedorVista[] {
  return [...lista].sort((a, b) => {
    const ta = tiempo(a.eta);
    const tb = tiempo(b.eta);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta === null && tb !== null) return 1;
    if (ta !== null && tb === null) return -1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export type ConteosDeFiltro = Record<FiltroTracking, number>;

export function contarPorFiltro(
  contenedores: readonly ContenedorVista[],
  sinContenedor: number,
): ConteosDeFiltro {
  const de = (g: GrupoContenedor) => contenedores.filter((c) => c.grupo === g).length;
  return { mar: de("mar"), origen: de("origen"), destino: de("destino"), sin: sinContenedor };
}

/** Sin filtro pedido se abre el primero que tenga algo, empezando por el mar. */
export function filtroPorDefecto(conteos: ConteosDeFiltro): FiltroTracking {
  return FILTROS_TRACKING.find((f) => conteos[f] > 0) ?? "mar";
}

/**
 * Hitos del contenedor con su fecha.
 *
 * Los cumplidos toman la fecha en que ocurrieron (`fechasReales`, por estado).
 * De los pendientes solo dos tienen fecha de plan: el zarpe (ETD) y la llegada a
 * puerto, que abre la aduana (ETA). El resto queda sin fecha: no se inventa.
 */
export function hitosDelContenedor(
  c: Pick<ContenedorVista, "statusEnvio" | "etd" | "eta">,
  fechasReales: ReadonlyMap<ShipmentStatus, string>,
): HitoContenedor[] {
  const plan: Partial<Record<ShipmentStatus, string | null>> = {
    shipped: c.etd,
    in_customs: c.eta,
  };
  return buildTimeline(c.statusEnvio, SERVICIO_DEL_CONTENEDOR).map((paso) => {
    const real = fechasReales.get(paso.status) ?? null;
    const cumplido = paso.state === "done" || paso.state === "active";
    if (cumplido && real) {
      return { ...paso, label: STATUS_LABELS[paso.status], fecha: real, planificada: false };
    }
    const delPlan = cumplido ? null : (plan[paso.status] ?? null);
    return {
      ...paso,
      label: STATUS_LABELS[paso.status],
      fecha: delPlan,
      planificada: delPlan !== null,
    };
  });
}

/** Fecha más antigua de cada estado entre los eventos de un envío. */
export function fechasPorEstado(
  eventos: readonly { status: ShipmentStatus; occurred_at: string }[],
): Map<ShipmentStatus, string> {
  const mapa = new Map<ShipmentStatus, string>();
  for (const e of eventos) {
    const previa = mapa.get(e.status);
    if (!previa || e.occurred_at < previa) mapa.set(e.status, e.occurred_at);
  }
  return mapa;
}

// ── Parámetros de la URL ────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un id que llega por la URL, o null si no tiene forma de UUID. Las columnas son
 * `uuid`: consultar con otra cosa hace fallar la consulta entera (22P02) y
 * tumbaría la página por un enlace mal copiado.
 */
export function idDeUrl(crudo: unknown): string | null {
  return typeof crudo === "string" && UUID.test(crudo) ? crudo.toLowerCase() : null;
}

// ── Búsqueda ────────────────────────────────────────────────────

export const LARGO_MINIMO_DE_BUSQUEDA = 2;

/** Texto de búsqueda limpio, o null si es muy corto para buscar. */
export function normalizarBusqueda(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null;
  const q = crudo.trim().replace(/\s+/g, " ").slice(0, 80);
  return q.length >= LARGO_MINIMO_DE_BUSQUEDA ? q : null;
}

/**
 * Patrón para `.ilike()` que busca el texto tal cual. En PostgREST `%`, `_` y
 * `*` son comodines: los dos primeros se escapan y el asterisco se quita, para
 * que escribir «%» no devuelva la tabla entera.
 */
export function patronIlike(q: string): string {
  const literal = q.replace(/\*/g, "").replace(/[\\%_]/g, (m) => `\\${m}`);
  return `%${literal}%`;
}

export type ResultadoDeBusqueda = {
  clave: string;
  client_markbox: string | null;
  client_name: string | null;
  cargas: {
    itemId: string;
    contenedorId: string;
    contenedorNombre: string;
    estadoLabel: string;
    shipmentId: string | null;
    pieces: number;
    cbm: number;
  }[];
};

/** Agrupa los ítems encontrados por cliente (Shipping Mark, o nombre si no hay). */
export function agruparResultados(
  filas: readonly {
    itemId: string;
    client_markbox: string | null;
    client_name: string | null;
    contenedorId: string;
    contenedorNombre: string;
    estadoLabel: string;
    shipmentId: string | null;
    pieces: number;
    cbm: number;
  }[],
): ResultadoDeBusqueda[] {
  const grupos = new Map<string, ResultadoDeBusqueda>();
  for (const f of filas) {
    const clave = f.client_markbox ?? f.client_name ?? `item:${f.itemId}`;
    const g =
      grupos.get(clave) ??
      ({
        clave,
        client_markbox: f.client_markbox,
        client_name: f.client_name,
        cargas: [],
      } satisfies ResultadoDeBusqueda);
    if (!g.client_name && f.client_name) g.client_name = f.client_name;
    if (!g.cargas.some((x) => x.itemId === f.itemId)) {
      g.cargas.push({
        itemId: f.itemId,
        contenedorId: f.contenedorId,
        contenedorNombre: f.contenedorNombre,
        estadoLabel: f.estadoLabel,
        shipmentId: f.shipmentId,
        pieces: f.pieces,
        cbm: f.cbm,
      });
    }
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}
