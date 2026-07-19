/**
 * Motor de oferta al cliente (SDD-0090) — el "cerebro" que arma una propuesta.
 *
 * PURO y source-agnostic: vive en lib/shared porque lo consumen AMBOS lados — el sitio
 * público (wizard "¿Qué necesitas?") y el Studio (preview de la oferta). No toca DB ni red.
 *
 * Dado lo que el cliente pide (intención + núcleo elegido), decide:
 *   1. qué NÚCLEO va (DDP por default),
 *   2. qué ADD-ONS se le cruzan (matriz de oferta),
 *   3. qué va ya INCLUIDO en el núcleo (no se ofrece),
 *   4. cómo se COBRA cada item.
 *
 * La matriz de cruce es CONFIGURABLE en Studio (decisión founder 2026-06-16): vive en
 * service_configs.suggests_keys/includes_keys/charge_mode. Acá va el DEFAULT derivado de las
 * reglas dictadas (entrevista-servicios.md, SDD-0063), que sirve de fallback hasta que el
 * founder seede la matriz. Patrón idéntico a mergeServiciosPublicados (lib/public/servicios-
 * queries.ts): la DB pisa, el código respalda → cero pantalla vacía.
 *
 * Regla de oro (heredada de 0063/0076): NO INVENTAR. La matriz default solo refleja lo dictado.
 */

import {
  SERVICE_CATALOG_BY_ID,
  NUCLEO_SERVICES,
  type ServicioId,
} from "./service-catalog";

/** Lo que el cliente quiere (entrada del wizard "¿Qué necesitas?"). */
export type IntencionCliente = "embarque" | "origen" | "suelto" | "estimar";

export const INTENCION_OPTIONS: { value: IntencionCliente; label: string }[] = [
  { value: "embarque", label: "Traer carga de China" },
  { value: "origen", label: "Conseguir o revisar un proveedor" },
  { value: "suelto", label: "Un trámite puntual" },
  { value: "estimar", label: "Calcular cuánto cuesta" },
];

/** Cómo se cobra un servicio — determinístico para la UI de oferta (SDD-0090 Pieza 3). */
export type ChargeMode =
  | "calculadora" // CBM vía la calculadora (RPC) — hoy solo DDP
  | "tabla_comision" // tabla regresiva (compra asistida)
  | "valorizacion" // valorización de factura (aduana); cliente paga planillas directo
  | "asesor" // stand-by, lo cierra el asesor
  | "honorarios"; // honorarios + tasas oficiales (visado, marca)

export const CHARGE_MODES: ChargeMode[] = [
  "calculadora",
  "tabla_comision",
  "valorizacion",
  "asesor",
  "honorarios",
];

export const CHARGE_MODE_LABEL: Record<ChargeMode, string> = {
  calculadora: "Estimado por CBM (calculadora)",
  tabla_comision: "Comisión según monto",
  valorizacion: "Según valorización de la factura",
  asesor: "Lo cotiza el asesor",
  honorarios: "Honorarios + tasas oficiales",
};

/** Opciones para el select de cómo se cobra (editor del Studio). */
export const CHARGE_MODE_OPTIONS: { value: ChargeMode; label: string }[] =
  CHARGE_MODES.map((m) => ({ value: m, label: CHARGE_MODE_LABEL[m] }));

// ── Grupos de add-ons (reflejan la taxonomía dictada) ────────────────
// documentos-importacion NO va acá (fusión founder 2026-07-19): la gestión
// documental viaja DENTRO de transito-aduana y nunca se ofrece como chip
// propio. El id sigue en el catálogo/charge-mode para la config del ERP.
const ADUANA: ServicioId[] = ["transito-aduana"];
const BODEGA: ServicioId[] = [
  "revision-recepcion",
  "etiquetado-piezas",
  "reempaque-defectuosas",
];
const INSPECCION: ServicioId[] = [
  "verificacion-proveedores",
  "inspeccion-calidad",
  "auditoria-calidad",
  "lab-permisologia",
];
const ORIGEN_SUELTOS: ServicioId[] = [
  "compra-asistida",
  "asesoria-pagos",
  "muestras-courier",
];
/** Trámites que NO dependen de importar con DTD — se ofrecen siempre (transversal). */
const TRAMITES_TRANSVERSALES: ServicioId[] = ["visado-chino", "registro-marca-cn"];

/** Lo que ve un cliente que llega por el modo "origen" (sourcing / proveedor). */
const MODO_ORIGEN: ServicioId[] = [
  "compra-asistida",
  "verificacion-proveedores",
  "inspeccion-calidad",
  "auditoria-calidad",
  "lab-permisologia",
  "asesoria-pagos",
];

/** Lo que ve un cliente que llega por el modo "suelto" (trámite puntual). */
const MODO_SUELTO: ServicioId[] = [
  ...TRAMITES_TRANSVERSALES,
  "muestras-courier",
];

type MatrixEntry = { includes: ServicioId[]; suggests: ServicioId[] };

/**
 * Matriz de cruce DEFAULT por núcleo. Reglas dictadas (entrevista-servicios.md):
 *   · origen + inspección aplican a TODO núcleo,
 *   · bodega NO aplica a FCL Fábrica (no pasa por la bodega de DTD),
 *   · aduana se ofrece solo donde NO va incluida (todos menos DDP).
 * Solo los núcleo arman oferta; los add-on no tienen entrada (getMatrix → vacío).
 */
export const DEFAULT_OFFER_MATRIX: Partial<Record<ServicioId, MatrixEntry>> = {
  "puerta-a-puerta-ddp": {
    includes: ADUANA, // DDP nacionaliza a su nombre → aduana incluida
    suggests: [...BODEGA, ...INSPECCION, ...ORIGEN_SUELTOS],
  },
  "lcl-consolidado": {
    includes: [],
    suggests: [...ADUANA, ...BODEGA, ...INSPECCION, ...ORIGEN_SUELTOS],
  },
  "fcl-bodega": {
    includes: [],
    suggests: [...ADUANA, ...BODEGA, ...INSPECCION, ...ORIGEN_SUELTOS],
  },
  "fcl-directo": {
    includes: [],
    suggests: [...ADUANA, ...INSPECCION, ...ORIGEN_SUELTOS], // sin bodega
  },
  "transporte-terrestre": {
    includes: [],
    suggests: [], // VE-interno, sin tramo de origen/bodega
  },
};

/**
 * Modo de cobro DEFAULT por servicio (los 20). Anti-drift: hay un test que verifica
 * que cada id del catálogo tenga una entrada. Lo `asesor` es el fallback honesto hasta
 * que el founder dicte precio (pendientes: mini-bodega, asesoría pagos, courier, etc.).
 */
export const DEFAULT_CHARGE_MODE: Record<ServicioId, ChargeMode> = {
  "puerta-a-puerta-ddp": "calculadora",
  "lcl-consolidado": "asesor",
  "fcl-bodega": "asesor",
  "fcl-directo": "asesor",
  "transporte-terrestre": "asesor",
  "transito-aduana": "valorizacion",
  "documentos-importacion": "valorizacion",
  "revision-recepcion": "asesor",
  "etiquetado-piezas": "asesor",
  "reempaque-defectuosas": "asesor",
  "inspeccion-calidad": "asesor",
  "verificacion-proveedores": "asesor",
  "auditoria-calidad": "asesor",
  "lab-permisologia": "asesor",
  "compra-asistida": "tabla_comision",
  "asesoria-pagos": "asesor",
  "muestras-courier": "asesor",
  "visado-chino": "honorarios",
  "registro-marca-cn": "honorarios",
  "cursos-importacion": "asesor",
};

/** Override por servicio desde la DB (service_configs). Todo opcional → la DB pisa el default. */
export type OfferOverride = {
  suggests?: ServicioId[] | null;
  includes?: ServicioId[] | null;
  chargeMode?: ChargeMode | null;
};
export type OfferOverrides = Partial<Record<ServicioId, OfferOverride>>;

/** La oferta armada que consume la UI. */
export type OfertaArmada = {
  modo: IntencionCliente;
  /** Núcleo elegido (transporte). null en modos origen/suelto/estimar. */
  nucleo: ServicioId | null;
  /** Add-ons que se cruzan, en orden de catálogo, sin duplicados ni incluidos. */
  sugeridos: ServicioId[];
  /** Add-ons ya plegados en el núcleo (se muestran como "incluido", no se cobran aparte). */
  incluidos: ServicioId[];
  /** Trámites siempre disponibles (visado, marca), en su propio slot. */
  transversales: ServicioId[];
  /** Cómo se cobra cada item mostrado (núcleo + sugeridos + transversales). */
  cobro: Record<string, ChargeMode>;
};

function getMatrix(id: ServicioId, overrides: OfferOverrides): MatrixEntry {
  const ov = overrides[id];
  const base = DEFAULT_OFFER_MATRIX[id] ?? { includes: [], suggests: [] };
  return {
    includes: ov?.includes ?? base.includes,
    suggests: ov?.suggests ?? base.suggests,
  };
}

/** Cómo se cobra un servicio: override de DB si existe, si no el default. */
export function getChargeMode(
  id: ServicioId,
  overrides: OfferOverrides = {},
): ChargeMode {
  return overrides[id]?.chargeMode ?? DEFAULT_CHARGE_MODE[id];
}

const esNucleo = (id: ServicioId) =>
  SERVICE_CATALOG_BY_ID[id]?.tipo === "nucleo";

/** Ordena por el `orden` del catálogo, deduplica y descarta servicios suspendidos. */
function limpiar(ids: ServicioId[], excluir: Set<ServicioId>): ServicioId[] {
  const vistos = new Set<ServicioId>();
  return ids
    .filter((id) => {
      const c = SERVICE_CATALOG_BY_ID[id];
      if (!c || c.estado === "suspendido") return false;
      if (excluir.has(id) || vistos.has(id)) return false;
      vistos.add(id);
      return true;
    })
    .sort(
      (a, b) =>
        SERVICE_CATALOG_BY_ID[a].orden - SERVICE_CATALOG_BY_ID[b].orden,
    );
}

function cobroDe(ids: ServicioId[], overrides: OfferOverrides): Record<string, ChargeMode> {
  const out: Record<string, ChargeMode> = {};
  for (const id of ids) out[id] = getChargeMode(id, overrides);
  return out;
}

/**
 * Arma la oferta a partir de la intención del cliente. Función PURA — la UI le pasa
 * `overrides` (lo que el founder configuró en Studio); sin overrides usa el default.
 *
 * - `embarque`: núcleo (default DDP) + add-ons cruzados (matriz) + transversales.
 * - `origen`:   sin núcleo; sourcing/proveedor (compra asistida, verificación, inspección…).
 * - `suelto`:   sin núcleo; trámites puntuales (visado, marca, courier).
 * - `estimar`:  ruteo a la calculadora; sin servicios.
 */
export function armarOferta(
  input: { intencion: IntencionCliente; nucleoId?: ServicioId | null },
  overrides: OfferOverrides = {},
): OfertaArmada {
  const { intencion } = input;

  if (intencion === "estimar") {
    return {
      modo: "estimar",
      nucleo: null,
      sugeridos: [],
      incluidos: [],
      transversales: [],
      cobro: {},
    };
  }

  if (intencion === "origen" || intencion === "suelto") {
    const base = intencion === "origen" ? MODO_ORIGEN : MODO_SUELTO;
    const sugeridos = limpiar(base, new Set());
    return {
      modo: intencion,
      nucleo: null,
      sugeridos,
      incluidos: [],
      transversales:
        intencion === "origen" ? limpiar(TRAMITES_TRANSVERSALES, new Set()) : [],
      cobro: cobroDe(sugeridos, overrides),
    };
  }

  // modo embarque
  const pedido = input.nucleoId ?? null;
  const nucleo: ServicioId =
    pedido && esNucleo(pedido) ? pedido : "puerta-a-puerta-ddp";

  const { includes, suggests } = getMatrix(nucleo, overrides);
  const excluir = new Set<ServicioId>([nucleo, ...includes]);

  const sugeridos = limpiar(suggests, excluir);
  const incluidos = limpiar(includes, new Set([nucleo]));
  const transversales = limpiar(
    TRAMITES_TRANSVERSALES,
    new Set([...sugeridos, ...incluidos, nucleo]),
  );

  return {
    modo: "embarque",
    nucleo,
    sugeridos,
    incluidos,
    transversales,
    cobro: cobroDe([nucleo, ...sugeridos, ...transversales], overrides),
  };
}

/** Núcleos elegibles para el wizard (modo embarque), en orden de catálogo. */
export function nucleosElegibles(): ServicioId[] {
  return NUCLEO_SERVICES.filter((s) => s.estado !== "suspendido")
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((s) => s.id);
}
