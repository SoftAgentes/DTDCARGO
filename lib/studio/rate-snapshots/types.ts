/**
 * Tarifa congelada por recepción (SDD-0571, migración 0496).
 *
 * La recepción en Yiwu guarda su precio por CBM, su mínimo, el CBM medido, de
 * dónde salió el precio, cuándo y quién. Ese registro no se edita: cambiarlo
 * crea otro con motivo. La base deriva los números de la fila de origen
 * (`congelar_tarifa_recepcion`); la app solo elige la fuente.
 *
 * Sin Zod: validate*Input() a mano, patrón del proyecto.
 */

import type { I18nKey } from "@/lib/i18n";
import type { ShipmentService } from "../shipment-types";
import { isShipmentService } from "../shipment-types";

/** De dónde salió el precio congelado (columna `source`). */
export type RateSnapshotSource = "estimado" | "lista" | "casa" | "manual" | "excel_yiwu";

/** Con `lista`: si fue tarifa propia del aliado, precio pactado o descuento. */
export type RateSnapshotOrigin = "propia" | "pactada" | "descuento";

/** Lo que se le pide a la RPC: la base clasifica `tarifario` en lista o casa. */
export type FreezeSource = "estimado" | "tarifario" | "manual" | "excel_yiwu";

/** Peso incluido por CBM: 500 es la regla, 1.000 la excepción (decisión 9). */
export type IncludedKgPerCbm = 500 | 1000;

export const PESO_INCLUIDO_REGLA: IncludedKgPerCbm = 500;
export const PESO_INCLUIDO_EXCEPCION: IncludedKgPerCbm = 1000;
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 1000;
/** Tope del lote «Congelar tarifas pendientes»: cada recepción es una llamada a la RPC. */
export const MAX_LOTE_TARIFAS = 100;

/** El servicio por defecto al congelar en Yiwu. */
export const SERVICIO_POR_DEFECTO: ShipmentService = "puerta_a_puerta_DDP";

/** Una fila de `shipment_rate_snapshots`. Los montos llegan como número. */
export type RateSnapshot = {
  id: string;
  receipt_id: string;
  shipment_id: string | null;
  client_id: string;
  client_markbox: string;
  service: ShipmentService;
  destination: string | null;
  source: RateSnapshotSource;
  rate_origin: RateSnapshotOrigin | null;
  rate_id: string | null;
  price_book_id: string | null;
  quote_id: string | null;
  discount_pct: number | null;
  per_cbm: number;
  min_charge: number;
  cbm: number;
  weight_kg: number | null;
  included_kg_per_cbm: IncludedKgPerCbm;
  amount_to_invoice: number;
  excess_weight_kg: number;
  reason: string | null;
  frozen_at: string;
  frozen_by: string | null;
  superseded_at: string | null;
  superseded_by_id: string | null;
};

export const RATE_SNAPSHOT_COLUMNS =
  "id, receipt_id, shipment_id, client_id, client_markbox, service, destination, source, rate_origin, " +
  "rate_id, price_book_id, quote_id, discount_pct, per_cbm, min_charge, cbm, weight_kg, included_kg_per_cbm, " +
  "amount_to_invoice, excess_weight_kg, reason, frozen_at, frozen_by, superseded_at, superseded_by_id";

const NUMERIC_FIELDS = [
  "discount_pct",
  "per_cbm",
  "min_charge",
  "cbm",
  "weight_kg",
  "amount_to_invoice",
  "excess_weight_kg",
] as const;

/** PostgREST devuelve `numeric` como texto o número según el caso: se normaliza. */
export function normalizeSnapshot(row: Record<string, unknown>): RateSnapshot {
  const out: Record<string, unknown> = { ...row };
  for (const field of NUMERIC_FIELDS) {
    const v = row[field];
    out[field] = v == null ? null : Number(v);
  }
  out.included_kg_per_cbm = Number(row.included_kg_per_cbm) === 1000 ? 1000 : 500;
  return out as RateSnapshot;
}

export const RATE_SOURCE_LABEL_KEYS: Record<RateSnapshotSource, I18nKey> = {
  estimado: "warehouse_cn.rate.source.estimado",
  lista: "warehouse_cn.rate.source.lista",
  casa: "warehouse_cn.rate.source.casa",
  manual: "warehouse_cn.rate.source.manual",
  excel_yiwu: "warehouse_cn.rate.source.excel_yiwu",
};

export const RATE_ORIGIN_LABEL_KEYS: Record<RateSnapshotOrigin, I18nKey> = {
  propia: "warehouse_cn.rate.origin.propia",
  pactada: "warehouse_cn.rate.origin.pactada",
  descuento: "warehouse_cn.rate.origin.descuento",
};

/**
 * ¿El CBM de la recepción cambió desde que se congeló? La tarifa guarda el CBM
 * de ese momento; si alguien lo corrige después, la pantalla lo avisa y volver
 * a congelar es un reemplazo con motivo. Tolerancia: medio litro (el CBM tiene
 * tres decimales).
 */
export function cbmCambio(snapshot: Pick<RateSnapshot, "cbm">, cbmActual: number | null): boolean {
  if (cbmActual == null) return true;
  return Math.abs(Number(snapshot.cbm) - Number(cbmActual)) >= 0.0005;
}

/**
 * Lo que la app le pide a la RPC. Los números de `estimado` y `tarifario` los
 * pone la base; `perCbm` y `minCharge` solo viajan con `manual` y `excel_yiwu`.
 */
export type FreezeInput = {
  receiptId: string;
  source: FreezeSource;
  rateId: string | null;
  quoteId: string | null;
  perCbm: number | null;
  minCharge: number | null;
  service: ShipmentService;
  includedKgPerCbm: IncludedKgPerCbm;
  reason: string | null;
};

export type FreezeFieldErrors = Partial<Record<"source" | "rateId" | "quoteId" | "perCbm" | "minCharge" | "service" | "includedKgPerCbm" | "reason", I18nKey>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FREEZE_SOURCES: readonly FreezeSource[] = ["estimado", "tarifario", "manual", "excel_yiwu"];

function numero(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Valida lo que llega del cajón antes de llamar a la RPC. La base vuelve a
 * validar todo; esto solo evita un viaje con datos que no pueden pasar y da el
 * error junto al campo.
 */
export function validateFreezeInput(
  raw: Record<string, unknown>,
  options: { requireReason?: boolean } = {},
): {
  input?: FreezeInput;
  fieldErrors?: FreezeFieldErrors;
} {
  const requireReason = options.requireReason ?? true;
  const fieldErrors: FreezeFieldErrors = {};
  const receiptId = String(raw.receiptId ?? "").trim();
  const source = String(raw.source ?? "") as FreezeSource;
  const service = String(raw.service ?? SERVICIO_POR_DEFECTO);
  const kg = Number(raw.includedKgPerCbm ?? PESO_INCLUIDO_REGLA);
  const reasonRaw = String(raw.reason ?? "").trim();
  const reason = reasonRaw === "" ? null : reasonRaw;
  const rateId = raw.rateId ? String(raw.rateId) : null;
  const quoteId = raw.quoteId ? String(raw.quoteId) : null;
  const perCbm = numero(raw.perCbm);
  const minCharge = numero(raw.minCharge);

  if (!UUID.test(receiptId)) {
    return { fieldErrors: { source: "warehouse_cn.rate.err.receipt_invalid" } };
  }
  if (!FREEZE_SOURCES.includes(source)) fieldErrors.source = "warehouse_cn.rate.err.source_invalid";
  if (!isShipmentService(service)) fieldErrors.service = "warehouse_cn.rate.err.service_required";
  if (kg !== 500 && kg !== 1000) fieldErrors.includedKgPerCbm = "warehouse_cn.rate.err.weight_invalid";
  if (reason != null && (reason.length < MOTIVO_MIN || reason.length > MOTIVO_MAX)) {
    fieldErrors.reason = "warehouse_cn.rate.err.reason_length";
  }

  if (source === "estimado" && (!quoteId || !UUID.test(quoteId))) {
    fieldErrors.quoteId = "warehouse_cn.rate.err.quote_required";
  }
  if (source === "tarifario" && (!rateId || !UUID.test(rateId))) {
    fieldErrors.rateId = "warehouse_cn.rate.err.rate_required";
  }
  const aMano = source === "manual" || source === "excel_yiwu";
  if (aMano) {
    if (perCbm == null || !(perCbm > 0)) fieldErrors.perCbm = "warehouse_cn.rate.err.amount_invalid";
    if (minCharge != null && !(minCharge >= 0)) fieldErrors.minCharge = "warehouse_cn.rate.err.amount_invalid";
    if (reason == null && requireReason) fieldErrors.reason = "warehouse_cn.rate.err.reason_required";
  }
  if (kg === 1000 && reason == null && requireReason) fieldErrors.reason = "warehouse_cn.rate.err.reason_required";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      receiptId,
      source,
      rateId: source === "tarifario" ? rateId : null,
      quoteId: source === "estimado" ? quoteId : null,
      perCbm: aMano ? perCbm : null,
      minCharge: aMano ? (minCharge ?? 0) : null,
      service: service as ShipmentService,
      includedKgPerCbm: kg as IncludedKgPerCbm,
      reason,
    },
  };
}

/** Argumentos de la RPC `congelar_tarifa_recepcion`. */
export function freezeRpcArgs(input: FreezeInput, dryRun: boolean): Record<string, unknown> {
  return {
    p_receipt_id: input.receiptId,
    p_source: input.source,
    p_rate_id: input.rateId,
    p_quote_id: input.quoteId,
    p_per_cbm: input.perCbm,
    p_min_charge: input.minCharge,
    p_service: input.service,
    p_included_kg_per_cbm: input.includedKgPerCbm,
    p_reason: input.reason,
    p_dry_run: dryRun,
  };
}

/**
 * Los errores propios de la 0496: llevan `hint = 'dtd-tarifa'` y un código al
 * principio del mensaje (`TARIFA_X: texto`). La app traduce SOLO esos (ERR-01);
 * cualquier otro error de la base no se muestra tal cual.
 */
const RATE_ERROR_KEYS: Record<string, I18nKey> = {
  TARIFA_SIN_PERMISO: "warehouse_cn.rate.err.forbidden",
  TARIFA_FUENTE_INVALIDA: "warehouse_cn.rate.err.source_invalid",
  TARIFA_PESO_INVALIDO: "warehouse_cn.rate.err.weight_invalid",
  TARIFA_MOTIVO_INVALIDO: "warehouse_cn.rate.err.reason_length",
  TARIFA_MOTIVO_REQUERIDO: "warehouse_cn.rate.err.reason_required",
  TARIFA_RECEPCION_NO_ENCONTRADA: "warehouse_cn.rate.err.receipt_not_found",
  TARIFA_RECEPCION_HUERFANA: "warehouse_cn.rate.err.receipt_orphan",
  TARIFA_RECEPCION_SIN_CBM: "warehouse_cn.rate.err.receipt_no_cbm",
  TARIFA_RECEPCION_SIN_CLIENTE: "warehouse_cn.rate.err.receipt_no_client",
  TARIFA_ESTIMADO_NO_ENCONTRADO: "warehouse_cn.rate.err.quote_not_found",
  TARIFA_ESTIMADO_NO_ACEPTADO: "warehouse_cn.rate.err.quote_not_accepted",
  TARIFA_ESTIMADO_OTRO_CLIENTE: "warehouse_cn.rate.err.quote_other_client",
  TARIFA_ESTIMADO_SIN_CBM: "warehouse_cn.rate.err.quote_no_cbm",
  TARIFA_SERVICIO_REQUERIDO: "warehouse_cn.rate.err.service_required",
  TARIFA_FILA_NO_ENCONTRADA: "warehouse_cn.rate.err.rate_not_found",
  TARIFA_FILA_SIN_CBM: "warehouse_cn.rate.err.rate_no_cbm",
  TARIFA_FILA_OTRO_SERVICIO: "warehouse_cn.rate.err.rate_other_service",
  TARIFA_FILA_OTRA_LISTA: "warehouse_cn.rate.err.rate_other_book",
  TARIFA_FILA_VENCIDA: "warehouse_cn.rate.err.rate_expired",
  TARIFA_FILA_OTRO_DESTINO: "warehouse_cn.rate.err.rate_other_destination",
  TARIFA_FILA_NO_APLICA: "warehouse_cn.rate.err.rate_not_applicable",
  TARIFA_RECEPCION_SIN_DESTINO: "warehouse_cn.rate.err.receipt_no_destination",
  TARIFA_MONTO_INVALIDO: "warehouse_cn.rate.err.amount_invalid",
  TARIFA_YA_CONGELADA: "warehouse_cn.rate.err.already_frozen",
};

/** La clave del mensaje para un error de la RPC, o null si no es uno de los suyos. */
export function rateErrorKey(error: { message?: string; hint?: string | null } | null | undefined): I18nKey | null {
  if (error?.hint === "dtd-client-normal" && ["NORMAL_INCOMPATIBLE", "NORMAL_GOVERNED"].includes(String(error.message ?? "").split(":")[0])) {
    return "warehouse_cn.normal.rate_incompatible";
  }
  if (!error || error.hint !== "dtd-tarifa") return null;
  const code = String(error.message ?? "").split(":")[0].trim();
  return RATE_ERROR_KEYS[code] ?? null;
}

/** La tabla o la RPC todavía no existen (0496 sin aplicar). */
export function isMissingRateSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205"
  );
}
