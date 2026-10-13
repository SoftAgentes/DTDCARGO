/**
 * Tipos TypeScript del módulo Tarifas (SDD-0008).
 * Matchea schema de supabase/migrations/0005_rates.sql.
 *
 * Reusa `ShipmentService` enum del módulo Tracking (mismo enum en BD).
 */

import type { ShipmentService } from "./shipment-types";

/** Lifecycle de la tarifa (Fase 3 Slice C, SDD-0055). */
export type RateStatus = "draft" | "published" | "archived";

export const RATE_STATUSES: RateStatus[] = ["draft", "published", "archived"];

export type Rate = {
  id: string;
  tenant_id: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  per_cbm: number | null;
  flat_rate: number | null;
  min_charge: number | null;
  transit_days: number | null;
  valid_from: string | null;   // ISO date YYYY-MM-DD · par con valid_until
  valid_until: string | null;  // ISO date YYYY-MM-DD
  is_public: boolean;          // marca la tarifa per_cbm pública del calculador
  status: RateStatus;          // draft | published | archived
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expiry_warn_sent_at: string | null;    // SDD-0164 ⭐1 · último aviso "por vencer"
  expiry_overdue_sent_at: string | null; // SDD-0164 ⭐1 · último aviso "ya vencida"
};

/** Label + tono de badge por estado de tarifa (para la UI). */
export function rateStatusLabel(status: RateStatus): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "published":
      return "Publicada";
    case "archived":
      return "Archivada";
  }
}

export function rateStatusTone(
  status: RateStatus,
): "neutral" | "success" | "warning" {
  switch (status) {
    case "draft":
      return "neutral";
    case "published":
      return "success";
    case "archived":
      return "neutral";
  }
}

/** Subset de Rate que un usuario puede editar (todo menos id/tenant_id/timestamps). */
export type RateInput = {
  service: ShipmentService;
  origin: string;
  destination: string;
  per_cbm: number | null;
  flat_rate: number | null;
  min_charge: number | null;
  transit_days: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_public: boolean;
  /**
   * SDD-0478: reemplaza a la pública del calculador el día de `valid_from`.
   * Ausente = el form no mostró la opción (migr 0459 sin aplicar) y el guardado
   * no debe nombrar la columna.
   */
  publica_programada?: boolean;
  notes: string | null;
};

/**
 * Día de hoy en Caracas, `YYYY-MM-DD`. Es el mismo día con el que decide
 * `promover_tarifas_programadas()` (migr 0459): si el Studio usara UTC, entre
 * las 20:00 y la medianoche de Venezuela diría «mañana» cuando el job todavía
 * dice «hoy».
 */
export function hoyCaracas(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Badge de una tarifa PROGRAMADA (SDD-0478) en /studio/tarifas.
 * · Antes de su día: «Programada · DD/MM», el día en que entra.
 * · El día de arranque: «Programada · hoy» — el relevo corre cada hora desde
 *   las 00:05 de Caracas, así que por un rato puede seguir marcada.
 * · Después de su día y todavía marcada: el relevo NO corrió. El sitio sigue
 *   con la pública anterior; es una alarma, no un estado normal.
 *
 * Cortos a propósito: van en la columna «Servicio» de 170px. MEDIDOS en
 * Nunito Sans 700 a 10,5px (Badge sm): «Programada · sin fecha» 146px, el más
 * largo; «Programada · entra el 30/11» medía 173px y desbordaba. Desde el
 * 2026-10-13 el Studio va en Archivo (tipografía SDD-0505): el texto de
 * «Programada · sin fecha» mide 114px en Archivo 700 a 10,5px (canvas, Preview),
 * así que el techo sigue cubierto.
 */
export function programadaBadge(
  validFrom: string | null,
  hoy: string = hoyCaracas(),
): { label: string; tone: "info" | "danger" } {
  if (!validFrom) return { label: "Programada · sin fecha", tone: "danger" };
  if (validFrom < hoy) return { label: "Programada · no entró", tone: "danger" };
  if (validFrom === hoy) return { label: "Programada · hoy", tone: "info" };
  const [, m, d] = validFrom.split("-");
  return { label: `Programada · ${d}/${m}`, tone: "info" };
}

/**
 * Traduce los rechazos de la ranura programada (migr 0459) a qué hacer. null =
 * el error no es de la ranura y lo maneja el mapeo de siempre. Va ANTES que el
 * del aliado: el guard de la programada también dice «lista de la casa».
 */
export function programadaErrorMessage(
  error: { code?: string; message?: string } | null,
): string | null {
  if (!error) return null;
  const msg = error.message ?? "";
  if (error.code === "23505" && msg.includes("rates_one_programada")) {
    return "Ya hay otra tarifa programada para reemplazar a la pública del calculador. Edita esa o quítale la programación.";
  }
  if (error.code !== "23514") return null;
  if (msg.includes("rates_publica_programada_check")) {
    return "Una tarifa programada necesita precio por CBM y fecha «Válida desde», y no puede ser la pública a la vez.";
  }
  if (msg.includes("borrador")) {
    return "Una tarifa en borrador no puede programarse: publícala primero.";
  }
  if (msg.includes("puede programarse")) {
    return "Solo una tarifa de la lista de la casa puede programarse para la calculadora del sitio.";
  }
  return null;
}

/**
 * Aviso de SEGUNDA pública (el índice singleton de 0255). Con la ranura
 * programada disponible, además dice cómo dejar lista la próxima sin quitar la
 * vigente — que es justo lo que antes obligaba a despublicarla.
 */
export function publicRateConflictMessage(conProgramacion: boolean): string {
  const base = "Ya hay otra tarifa marcada como pública del calculador. Desmárcala primero.";
  if (!conProgramacion) return base;
  return (
    "Ya hay otra tarifa marcada como pública del calculador. Si esta es la que sigue, " +
    "márcala como «Programada»: entra sola el día de «Válida desde» y el sitio no se queda sin tarifa."
  );
}

/**
 * Opciones del select de servicio en el form de Tarifas.
 *
 * Alias de `SERVICE_OPTIONS` (fuente única en `lib/shared/shipment-public`).
 * Antes era una lista propia con labels distintas a las del Tracking — el mismo
 * servicio se llamaba de dos maneras según la pantalla (SDD-0164).
 */
export { SERVICE_OPTIONS as RATE_SERVICE_OPTIONS } from "@/lib/shared/shipment-public";

/**
 * Indica si el servicio se cobra por CBM (LCL-style) o por flat rate (FCL-style).
 * Usado por la UI del drawer para mostrar el campo correcto y por el seed.
 */
export function priceMode(service: ShipmentService): "per_cbm" | "flat_rate" {
  switch (service) {
    case "consolidado_lcl":
    case "puerta_a_puerta_DDP":
      return "per_cbm";
    case "fcl_directo":
    case "fcl_bodega":
    case "transporte_terrestre":
      return "flat_rate";
  }
}

/**
 * Nivel de alerta de vencimiento de una tarifa pública (SDD-0164, ⭐1).
 * "warn" = por vencer (<=7 días) · "overdue" = ya vencida, el sitio ya
 * está cayendo en silencio al respaldo hardcodeado del código.
 */
export type RateExpiryLevel = "warn" | "overdue";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normaliza a ms de medianoche UTC. Fecha inválida → NaN. */
function toDateMs(d: string | Date): number {
  if (d instanceof Date) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return NaN;
  return Date.UTC(y, m - 1, day);
}

/**
 * Badge de vigencia para /studio/tarifas — solo informativo, no decide si
 * hay que alertar (eso es `classifyRateExpiry`). Windowed a 7 días, igual
 * ventana que el cron de alerta.
 */
export function rateExpiryBadge(
  rate: Pick<Rate, "is_public" | "status" | "valid_until">,
  today: string | Date = new Date(),
  windowDays = 7,
): { label: string; tone: "warning" | "danger" } | null {
  if (!rate.is_public || rate.status !== "published" || !rate.valid_until) return null;

  const todayMs = toDateMs(today);
  const validMs = toDateMs(rate.valid_until);
  if (Number.isNaN(todayMs) || Number.isNaN(validMs)) return null;

  if (validMs < todayMs) return { label: "Vencida", tone: "danger" };
  if (validMs < todayMs + windowDays * DAY_MS) return { label: "Por vencer", tone: "warning" };
  return null;
}

/**
 * Decide si el cron de vencimiento (SDD-0164 ⭐1) tiene que DISPARAR el
 * aviso Telegram+email para esta fila, o si ya se avisó y hay que callar.
 *
 * Dedup self-healing: en vez de comparar contra "hoy" (que reenviaría cada
 * corrida), compara el `sent_at` contra el INICIO de la ventana de la
 * vigencia ACTUAL (`valid_until - windowDays` para warn, `valid_until`
 * para overdue). Si el founder renueva `valid_until` en /studio/tarifas,
 * esa ventana se corre para adelante sola — sin resetear columnas a mano,
 * el aviso viejo queda "antes" de la ventana nueva y se re-arma solo.
 */
export function classifyRateExpiry(
  rate: Pick<
    Rate,
    | "is_public"
    | "status"
    | "deleted_at"
    | "valid_until"
    | "expiry_warn_sent_at"
    | "expiry_overdue_sent_at"
  >,
  today: string | Date = new Date(),
  windowDays = 7,
): RateExpiryLevel | null {
  if (!rate.is_public || rate.status !== "published" || rate.deleted_at || !rate.valid_until) {
    return null;
  }

  const todayMs = toDateMs(today);
  const validMs = toDateMs(rate.valid_until);
  if (Number.isNaN(todayMs) || Number.isNaN(validMs)) return null;

  if (validMs < todayMs) {
    const sentMs = rate.expiry_overdue_sent_at ? toDateMs(rate.expiry_overdue_sent_at) : null;
    if (sentMs !== null && sentMs >= validMs) return null;
    return "overdue";
  }

  const warnWindowStartMs = validMs - windowDays * DAY_MS;
  if (todayMs >= warnWindowStartMs) {
    const sentMs = rate.expiry_warn_sent_at ? toDateMs(rate.expiry_warn_sent_at) : null;
    if (sentMs !== null && sentMs >= warnWindowStartMs) return null;
    return "warn";
  }

  return null;
}

/** Format helper para mostrar la tarifa en la tabla. */
export function formatRate(rate: Pick<Rate, "per_cbm" | "flat_rate">): string {
  if (rate.per_cbm != null) {
    return `$${rate.per_cbm.toFixed(2)}/CBM`;
  }
  if (rate.flat_rate != null) {
    return `$${rate.flat_rate.toLocaleString("en-US")}/ctr`;
  }
  return "—";
}

/** Tipo del estado de las server actions (consistente con shipment actions). */
export type RateActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof RateInput, string>>;
  /** ID del rate recién creado · solo en createRate. Sirve para highlight de row. */
  createdId?: string;
};

/**
 * Validación manual del input (patrón del proyecto — sin zod).
 * Retorna {input} si pasa o {fieldErrors} si falla.
 */
export function validateRateInput(
  input: Partial<RateInput>,
  hoy: string = hoyCaracas(),
): {
  input?: RateInput;
  fieldErrors?: RateActionState["fieldErrors"];
} {
  const errors: RateActionState["fieldErrors"] = {};

  if (!input.service) errors.service = "Elige un servicio.";
  if (!input.origin || !input.origin.trim()) errors.origin = "Indica el origen.";
  if (!input.destination || !input.destination.trim())
    errors.destination = "Indica el destino.";

  const hasPerCbm = input.per_cbm != null && Number.isFinite(input.per_cbm) && input.per_cbm > 0;
  const hasFlat = input.flat_rate != null && Number.isFinite(input.flat_rate) && input.flat_rate > 0;
  if (!hasPerCbm && !hasFlat) {
    errors.per_cbm = "Tienes que indicar tarifa por CBM o flat.";
  }

  if (input.transit_days != null && (!Number.isFinite(input.transit_days) || input.transit_days < 0)) {
    errors.transit_days = "Días de tránsito debe ser un entero positivo.";
  }

  if (input.min_charge != null && (!Number.isFinite(input.min_charge) || input.min_charge < 0)) {
    errors.min_charge = "Mínimo cobrable debe ser un número positivo.";
  }

  if (input.per_cbm != null && (!Number.isFinite(input.per_cbm) || input.per_cbm < 0)) {
    errors.per_cbm = "Tarifa por CBM debe ser un número positivo.";
  }

  if (input.flat_rate != null && (!Number.isFinite(input.flat_rate) || input.flat_rate < 0)) {
    errors.flat_rate = "Tarifa flat debe ser un número positivo.";
  }

  const validFromOk = input.valid_from
    ? !Number.isNaN(new Date(input.valid_from).getTime())
    : true;
  const validUntilOk = input.valid_until
    ? !Number.isNaN(new Date(input.valid_until).getTime())
    : true;

  if (!validFromOk) errors.valid_from = "Fecha de vigencia (desde) inválida.";
  if (!validUntilOk) errors.valid_until = "Fecha de vigencia (hasta) inválida.";

  // Invariante: si ambas fechas son válidas, valid_from no puede ser posterior a valid_until.
  if (validFromOk && validUntilOk && input.valid_from && input.valid_until) {
    if (new Date(input.valid_from) > new Date(input.valid_until)) {
      errors.valid_from = "La vigencia 'desde' no puede ser posterior a 'hasta'.";
    }
  }

  // SDD-0478 · la programada tiene que poder servirse el día que entra. Son
  // las mismas reglas que el check `rates_publica_programada_check` (migr
  // 0459), dichas antes de llegar a la base y con qué hacer.
  if (input.publica_programada) {
    if (input.is_public) {
      errors.publica_programada =
        "Elige una: pública desde ya o programada para su fecha. No puede ser las dos.";
    } else if (!hasPerCbm) {
      errors.publica_programada =
        "Solo una tarifa por CBM puede programarse como la pública del calculador.";
    }
    if (!input.valid_from) {
      errors.valid_from ??= "Indica desde qué día rige: ese día reemplaza a la pública.";
    } else if (validFromOk && input.valid_from <= hoy) {
      errors.valid_from ??=
        "Programar es para una fecha futura. Para cambiar el precio hoy, edita la tarifa pública.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      service: input.service!,
      origin: input.origin!.trim(),
      destination: input.destination!.trim(),
      per_cbm: hasPerCbm ? input.per_cbm! : null,
      flat_rate: hasFlat ? input.flat_rate! : null,
      min_charge: input.min_charge ?? null,
      transit_days: input.transit_days ?? null,
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      is_public: input.is_public ?? false,
      ...(input.publica_programada === undefined
        ? {}
        : { publica_programada: input.publica_programada }),
      notes: input.notes?.trim() || null,
    },
  };
}
