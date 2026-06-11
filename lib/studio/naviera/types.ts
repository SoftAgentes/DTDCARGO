/**
 * Tipos TypeScript del módulo Naviera & Consolidación (SDD-0047, Slice A).
 * Matchea el schema de supabase/migrations/0096_naviera_consolidacion.sql y
 * calca el modelo + helper `containerStats` del Norte
 * (docs/design/studio/_norte/erp/modules/naviera-data.jsx).
 *
 * Modela la naviera como entidad propia:
 *  - `Carrier`        · naviera (COSCO/Maersk/MSC/Evergreen).
 *  - `Port`           · puerto CN/VE (tenant-scoped, código corto).
 *  - `ContainerType`  · catálogo de capacidad útil (cbm/kg).
 *  - `Sailing`        · itinerario (vessel/voyage/POL/POD/ETD/ETA/cutoff).
 *  - `Booking`        · reserva de espacio (BKG-YYYY-NNNN) + bl_number.
 *  - `Consolidation`  · = el `Container` del blueprint (DTD-CONSOL-NNNN).
 *  - `ConsolidationItem` · pieza LCL asignada (aporte cbm/kg/pieces).
 *
 * Sin server actions / UI acá (eso es Slice B). Helpers PUROS + validadores
 * manuales (no Zod, patrón del repo).
 */

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Tipos de contenedor · capacidad útil (catálogo)           ║
// ╚═══════════════════════════════════════════════════════════╝

/** Códigos de tipo de contenedor del catálogo. */
export type ContainerTypeCode = "20GP" | "40GP" | "40HC";

export type ContainerTypeSpec = {
  label: string;
  cbm: number;
  kg: number;
};

/**
 * Capacidad útil de cada tipo. Espejo en TS del seed de `container_types`
 * y del `CONTAINER_TYPES` del Norte. Fuente de verdad para `containerStats`
 * cuando no hay fila de catálogo a mano (tests / cálculo puro).
 */
export const CONTAINER_TYPES: Record<ContainerTypeCode, ContainerTypeSpec> = {
  "20GP": { label: "20' GP", cbm: 33, kg: 28000 },
  "40GP": { label: "40' GP", cbm: 67, kg: 26500 },
  "40HC": { label: "40' HC", cbm: 76, kg: 26500 },
};

export const CONTAINER_TYPE_OPTIONS: {
  value: ContainerTypeCode;
  label: string;
}[] = (Object.keys(CONTAINER_TYPES) as ContainerTypeCode[]).map((code) => ({
  value: code,
  label: CONTAINER_TYPES[code].label,
}));

export function isContainerTypeCode(v: unknown): v is ContainerTypeCode {
  return typeof v === "string" && v in CONTAINER_TYPES;
}

/** Una fila persistida del catálogo de tipos de contenedor. */
export type ContainerType = {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  cbm_capacity: number;
  kg_capacity: number;
  display_order: number;
  created_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estados (enums de display) — calcan naviera-data.jsx       ║
// ╚═══════════════════════════════════════════════════════════╝

export type SailingStatus =
  | "abierto"
  | "cutoff"
  | "zarpado"
  | "transito"
  | "arribado";

export const SAILING_STATUS: Record<
  SailingStatus,
  { label: string; tone: BadgeTone }
> = {
  abierto: { label: "Espacio abierto", tone: "success" },
  cutoff: { label: "Cut-off próximo", tone: "warning" },
  zarpado: { label: "Zarpado", tone: "info" },
  transito: { label: "En tránsito", tone: "info" },
  arribado: { label: "Arribado", tone: "neutral" },
};

export const SAILING_STATUSES = Object.keys(
  SAILING_STATUS,
) as SailingStatus[];

export function sailingStatusLabel(status: string): string {
  return SAILING_STATUS[status as SailingStatus]?.label ?? status;
}
export function sailingStatusTone(status: string): BadgeTone {
  return SAILING_STATUS[status as SailingStatus]?.tone ?? "neutral";
}

export type BookingStatus =
  | "abierto"
  | "solicitado"
  | "confirmado"
  | "cerrado"
  | "zarpado"
  | "transito";

export const BOOKING_STATUS: Record<
  BookingStatus,
  { label: string; tone: BadgeTone }
> = {
  abierto: { label: "Abierto", tone: "warning" },
  solicitado: { label: "Solicitado", tone: "info" },
  confirmado: { label: "Confirmado", tone: "success" },
  cerrado: { label: "Cerrado", tone: "wine" },
  zarpado: { label: "Zarpado", tone: "info" },
  transito: { label: "En tránsito", tone: "info" },
};

export const BOOKING_STATUSES = Object.keys(
  BOOKING_STATUS,
) as BookingStatus[];

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS[status as BookingStatus]?.label ?? status;
}
export function bookingStatusTone(status: string): BadgeTone {
  return BOOKING_STATUS[status as BookingStatus]?.tone ?? "neutral";
}

/** Modo de la reserva. */
export type BookingMode = "FCL" | "LCL";
export const BOOKING_MODES: BookingMode[] = ["FCL", "LCL"];

export type ContainerStatus =
  | "consolidando"
  | "cerrado"
  | "zarpado"
  | "arribado";

export const CONTAINER_STATUS: Record<
  ContainerStatus,
  { label: string; tone: BadgeTone }
> = {
  consolidando: { label: "Consolidando", tone: "warning" },
  cerrado: { label: "Cerrado", tone: "success" },
  zarpado: { label: "Zarpado", tone: "info" },
  arribado: { label: "Arribado", tone: "neutral" },
};

export const CONTAINER_STATUSES = Object.keys(
  CONTAINER_STATUS,
) as ContainerStatus[];

export function containerStatusLabel(status: string): string {
  return CONTAINER_STATUS[status as ContainerStatus]?.label ?? status;
}
export function containerStatusTone(status: string): BadgeTone {
  return CONTAINER_STATUS[status as ContainerStatus]?.tone ?? "neutral";
}

/** Disponibilidad de espacio del zarpe → tono de badge (calca SPACE_TONE). */
export type SpaceLevel = "alta" | "media" | "baja" | "cerrada";

export const SPACE_TONE: Record<SpaceLevel, BadgeTone> = {
  alta: "success",
  media: "warning",
  baja: "danger",
  cerrada: "neutral",
};

export const SPACE_LEVELS = Object.keys(SPACE_TONE) as SpaceLevel[];

export function spaceTone(space: string): BadgeTone {
  return SPACE_TONE[space as SpaceLevel] ?? "neutral";
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type Carrier = {
  id: string;
  tenant_id: string;
  name: string;
  name_cn: string | null;
  scac: string | null;
  tone: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Port = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  name_cn: string | null;
  country: string;
  created_at: string;
};

export type Sailing = {
  id: string;
  tenant_id: string;
  carrier_id: string | null;
  vessel: string;
  voyage: string | null;
  pol: string;
  pod: string;
  etd: string | null;
  eta: string | null;
  cutoff: string | null;
  transit_days: number | null;
  status: SailingStatus;
  space: SpaceLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Booking = {
  id: string;
  tenant_id: string;
  code: string;
  carrier_id: string | null;
  sailing_id: string | null;
  bl_number: string | null;
  container_type: string | null;
  mode: BookingMode;
  shipper: string | null;
  commodity: string | null;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Consolidation = {
  id: string;
  tenant_id: string;
  ref: string;
  booking_id: string | null;
  sailing_id: string | null;
  container_type: string | null;
  status: ContainerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ConsolidationItem = {
  id: string;
  tenant_id: string;
  consolidation_id: string;
  shipment_id: string | null;
  client_markbox: string | null;
  client_name: string | null;
  supplier_name: string | null;
  cbm: number;
  weight_kg: number;
  pieces: number;
  created_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ containerStats · utilización (calca el helper del Norte)   ║
// ╚═══════════════════════════════════════════════════════════╝

/** El aporte mínimo de una pieza para el cálculo de utilización. */
export type StatItem = {
  cbm: number;
  weight_kg: number;
  pieces: number;
};

export type ContainerStats = {
  /** Capacidad del tipo (cbm/kg). null si el tipo es desconocido. */
  cap: ContainerTypeSpec | null;
  usedCbm: number;
  usedKg: number;
  pieces: number;
  /** % de CBM usado vs capacidad (0 si no hay cap). >100 = sobre-capacidad. */
  cbmPct: number;
  kgPct: number;
  freeCbm: number;
  freeKg: number;
  /** Cantidad de piezas/clientes asignados (items.length, igual que el Norte). */
  clients: number;
};

/**
 * Métricas de utilización de un contenedor. PURA — testeable sin DB.
 *
 * Calca `containerStats` de naviera-data.jsx: suma cbm/kg/pieces de los items,
 * compara contra la capacidad del tipo, devuelve %/libre. `clients` = items.length
 * (cada item es un embarque/cliente asignado, igual que el Norte).
 *
 * Si el tipo es desconocido, `cap=null` y los % quedan en 0 (no divide por cero).
 * El % puede superar 100 (sobre-capacidad) → la UI lo pinta wine (advisory, §4.4).
 */
export function containerStats(
  items: StatItem[],
  type: string | null | undefined,
): ContainerStats {
  const cap = isContainerTypeCode(type) ? CONTAINER_TYPES[type] : null;

  const usedCbm = items.reduce((s, i) => s + (Number(i.cbm) || 0), 0);
  const usedKg = items.reduce((s, i) => s + (Number(i.weight_kg) || 0), 0);
  const pieces = items.reduce((s, i) => s + (Number(i.pieces) || 0), 0);

  return {
    cap,
    usedCbm,
    usedKg,
    pieces,
    cbmPct: cap ? (usedCbm / cap.cbm) * 100 : 0,
    kgPct: cap ? (usedKg / cap.kg) * 100 : 0,
    freeCbm: cap ? Math.max(0, cap.cbm - usedCbm) : 0,
    freeKg: cap ? Math.max(0, cap.kg - usedKg) : 0,
    clients: items.length,
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Guard de capacidad · ADVISORY (§4.4) — PURO, testeable     ║
// ╚═══════════════════════════════════════════════════════════╝

export type CapacityWarning = {
  /** true si tras agregar la pieza el CBM o el kg superan la capacidad. */
  over: boolean;
  cbmPct: number;
  kgPct: number;
  /** Aviso para la UI (null si no hay sobre-capacidad). */
  message: string | null;
};

/**
 * Guard de capacidad ADVISORY (§4.4): calcula la utilización resultante de
 * sumar `incoming` a los `existing` items para el `containerType`. NO bloquea —
 * solo devuelve un aviso cuando el resultado supera la capacidad del tipo.
 * PURO: testeable sin DB. Se reusa en la server action `assignLooseCargo`.
 */
export function evaluateCapacity(
  existing: StatItem[],
  incoming: StatItem,
  containerType: string | null,
): CapacityWarning {
  const stats = containerStats([...existing, incoming], containerType);
  const overCbm = stats.cap != null && stats.cbmPct > 100;
  const overKg = stats.cap != null && stats.kgPct > 100;
  const over = overCbm || overKg;

  let message: string | null = null;
  if (over) {
    const parts: string[] = [];
    if (overCbm) parts.push(`CBM al ${stats.cbmPct.toFixed(0)}%`);
    if (overKg) parts.push(`peso al ${stats.kgPct.toFixed(0)}%`);
    message = `El contenedor queda sobre-capacidad (${parts.join(
      " · ",
    )}). Se asignó igual; reacomodá si hace falta.`;
  }
  return { over, cbmPct: stats.cbmPct, kgPct: stats.kgPct, message };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Códigos correlativos (espejos en TS para test sin DB)     ║
// ╚═══════════════════════════════════════════════════════════╝

/** Patrón del booking code: BKG-YYYY-NNNN (mínimo 4 dígitos). */
export const BOOKING_CODE_RE = /^BKG-\d{4}-\d{4,}$/;

/** Patrón del consolidation ref: DTD-CONSOL-NNNN (mínimo 4 dígitos). */
export const CONSOLIDATION_REF_RE = /^DTD-CONSOL-\d{4,}$/;

/** Formatea un booking code. Espejo en TS de la SQL next_booking_code. */
export function formatBookingCode(year: number, seq: number): string {
  return `BKG-${year}-${String(seq).padStart(4, "0")}`;
}

/** Formatea un consolidation ref. Espejo en TS de la SQL next_consolidation_ref. */
export function formatConsolidationRef(seq: number): string {
  return `DTD-CONSOL-${String(seq).padStart(4, "0")}`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Inputs + validadores manuales (no Zod, patrón del repo)   ║
// ╚═══════════════════════════════════════════════════════════╝

const VALID_SAILING_STATUS = new Set<string>(SAILING_STATUSES);
const VALID_SPACE = new Set<string>(SPACE_LEVELS);
const VALID_BOOKING_STATUS = new Set<string>(BOOKING_STATUSES);
const VALID_BOOKING_MODE = new Set<string>(BOOKING_MODES);
const VALID_CONTAINER_STATUS = new Set<string>(CONTAINER_STATUSES);

function dateOk(s: string | null | undefined): boolean {
  return !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ── Sailing ────────────────────────────────────────────────────

export type SailingInput = {
  carrierId: string | null;
  vessel: string;
  voyage: string | null;
  pol: string;
  pod: string;
  etd: string | null; // YYYY-MM-DD
  eta: string | null; // YYYY-MM-DD
  cutoff: string | null; // YYYY-MM-DD
  transitDays: number | null;
  status: SailingStatus;
  space: SpaceLevel;
  notes: string | null;
};

export type SailingActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SailingInput, string>>;
  sailingId?: string;
};

/**
 * Validación manual del input de itinerario (sin zod).
 *  - vessel requerido.
 *  - pol/pod requeridos (códigos de puerto).
 *  - status normaliza a 'abierto' si desconocido; space a 'alta'.
 *  - etd/eta/cutoff formato YYYY-MM-DD cuando vienen.
 */
export function validateSailingInput(input: Partial<SailingInput>): {
  input?: SailingInput;
  fieldErrors?: SailingActionState["fieldErrors"];
} {
  const errors: SailingActionState["fieldErrors"] = {};

  const vessel = (input.vessel ?? "").trim();
  if (!vessel) errors.vessel = "Indicá el buque (vessel).";

  const pol = (input.pol ?? "").trim().toUpperCase();
  if (!pol) errors.pol = "Indicá el puerto de carga (POL).";

  const pod = (input.pod ?? "").trim().toUpperCase();
  if (!pod) errors.pod = "Indicá el puerto de descarga (POD).";

  if (!dateOk(input.etd)) errors.etd = "Fecha ETD inválida (YYYY-MM-DD).";
  if (!dateOk(input.eta)) errors.eta = "Fecha ETA inválida (YYYY-MM-DD).";
  if (!dateOk(input.cutoff)) errors.cutoff = "Fecha cut-off inválida (YYYY-MM-DD).";

  const status: SailingStatus = VALID_SAILING_STATUS.has(input.status ?? "")
    ? (input.status as SailingStatus)
    : "abierto";

  const space: SpaceLevel = VALID_SPACE.has(input.space ?? "")
    ? (input.space as SpaceLevel)
    : "alta";

  let transitDays: number | null = null;
  if (input.transitDays != null && `${input.transitDays}`.trim() !== "") {
    const n = Number(input.transitDays);
    if (!Number.isFinite(n) || n < 0) {
      errors.transitDays = "Días de tránsito inválidos.";
    } else {
      transitDays = Math.round(n);
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      carrierId: (input.carrierId ?? "")?.toString().trim() || null,
      vessel,
      voyage: input.voyage?.trim() || null,
      pol,
      pod,
      etd: input.etd?.trim() || null,
      eta: input.eta?.trim() || null,
      cutoff: input.cutoff?.trim() || null,
      transitDays,
      status,
      space,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Booking ────────────────────────────────────────────────────

export type BookingInput = {
  carrierId: string | null;
  sailingId: string | null;
  blNumber: string | null;
  containerType: string | null;
  mode: BookingMode;
  shipper: string | null;
  commodity: string | null;
  status: BookingStatus;
  notes: string | null;
};

export type BookingActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof BookingInput, string>>;
  bookingCode?: string;
};

/**
 * Validación manual del input de reserva (sin zod).
 *  - mode normaliza a 'LCL' si inválido; status a 'abierto'.
 *  - containerType debe ser un code de catálogo si viene (20GP/40GP/40HC).
 *  - bl_number opcional (se captura cuando la naviera lo emite).
 */
export function validateBookingInput(input: Partial<BookingInput>): {
  input?: BookingInput;
  fieldErrors?: BookingActionState["fieldErrors"];
} {
  const errors: BookingActionState["fieldErrors"] = {};

  const mode: BookingMode = VALID_BOOKING_MODE.has(input.mode ?? "")
    ? (input.mode as BookingMode)
    : "LCL";

  const status: BookingStatus = VALID_BOOKING_STATUS.has(input.status ?? "")
    ? (input.status as BookingStatus)
    : "abierto";

  const containerTypeRaw = (input.containerType ?? "").trim();
  let containerType: string | null = null;
  if (containerTypeRaw) {
    if (!isContainerTypeCode(containerTypeRaw)) {
      errors.containerType = "Tipo de contenedor inválido (20GP/40GP/40HC).";
    } else {
      containerType = containerTypeRaw;
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      carrierId: (input.carrierId ?? "")?.toString().trim() || null,
      sailingId: (input.sailingId ?? "")?.toString().trim() || null,
      blNumber: input.blNumber?.trim() || null,
      containerType,
      mode,
      shipper: input.shipper?.trim() || null,
      commodity: input.commodity?.trim() || null,
      status,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Consolidation ──────────────────────────────────────────────

export type ConsolidationInput = {
  bookingId: string | null;
  sailingId: string | null;
  containerType: string | null;
  status: ContainerStatus;
  notes: string | null;
};

export type ConsolidationActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ConsolidationInput, string>>;
  consolidationRef?: string;
};

/**
 * Validación manual del input del contenedor de consolidación (sin zod).
 *  - containerType requerido y debe ser un code de catálogo (20GP/40GP/40HC).
 *  - status normaliza a 'consolidando' si inválido.
 */
export function validateConsolidationInput(
  input: Partial<ConsolidationInput>,
): {
  input?: ConsolidationInput;
  fieldErrors?: ConsolidationActionState["fieldErrors"];
} {
  const errors: ConsolidationActionState["fieldErrors"] = {};

  const containerTypeRaw = (input.containerType ?? "").trim();
  if (!containerTypeRaw) {
    errors.containerType = "Elige el tipo de contenedor.";
  } else if (!isContainerTypeCode(containerTypeRaw)) {
    errors.containerType = "Tipo de contenedor inválido (20GP/40GP/40HC).";
  }

  const status: ContainerStatus = VALID_CONTAINER_STATUS.has(input.status ?? "")
    ? (input.status as ContainerStatus)
    : "consolidando";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      bookingId: (input.bookingId ?? "")?.toString().trim() || null,
      sailingId: (input.sailingId ?? "")?.toString().trim() || null,
      containerType: containerTypeRaw,
      status,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Consolidation item ─────────────────────────────────────────

export type ConsolidationItemInput = {
  shipmentId: string | null;
  clientMarkbox: string | null;
  clientName: string | null;
  supplierName: string | null;
  cbm: number;
  weightKg: number;
  pieces: number;
};

export type ConsolidationItemActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ConsolidationItemInput, string>>;
};

/**
 * Validación manual del input de una pieza asignada (sin zod).
 *  - cbm > 0 (no se asigna una pieza vacía).
 *  - weightKg ≥ 0, pieces ≥ 0 (enteros).
 *  - shipmentId opcional (la pieza puede registrarse a mano sin embarque).
 */
export function validateConsolidationItemInput(
  input: Partial<ConsolidationItemInput>,
): {
  input?: ConsolidationItemInput;
  fieldErrors?: ConsolidationItemActionState["fieldErrors"];
} {
  const errors: ConsolidationItemActionState["fieldErrors"] = {};

  const cbm = Number(input.cbm);
  if (!Number.isFinite(cbm) || cbm <= 0) {
    errors.cbm = "El CBM de la pieza debe ser mayor a cero.";
  }

  const weightKg = Number(input.weightKg ?? 0);
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    errors.weightKg = "El peso no puede ser negativo.";
  }

  const piecesNum = Number(input.pieces ?? 0);
  if (!Number.isFinite(piecesNum) || piecesNum < 0) {
    errors.pieces = "La cantidad de bultos no puede ser negativa.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      shipmentId: (input.shipmentId ?? "")?.toString().trim() || null,
      clientMarkbox: input.clientMarkbox?.trim() || null,
      clientName: input.clientName?.trim() || null,
      supplierName: input.supplierName?.trim() || null,
      cbm,
      weightKg,
      pieces: Math.round(piecesNum),
    },
  };
}
