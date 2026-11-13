/** Contrato anual v2. Sin DB, FX ni BigInt en los DTO que cruzan RSC/JSON. */
export type AnnualBilling = {
  state: "completo" | "sin_tasa" | "datos_invalidos";
  subtotalUsd: string | null;
  sinTasaCount: number;
};
export type AnnualBillingRead = AnnualBilling | {
  state: "no_disponible";
  subtotalUsd: null;
  sinTasaCount: null;
};
export const BILLING_UNAVAILABLE: AnnualBillingRead = {
  state: "no_disponible", subtotalUsd: null, sinTasaCount: null,
};
export const BILLING_ZERO: AnnualBilling = {
  state: "completo", subtotalUsd: "0.00", sinTasaCount: 0,
};
export class AnnualBillingError extends Error {
  constructor(readonly reason: "rpc" | "shape" | "paging" | "duplicate") {
    super("Facturación anual no disponible");
    this.name = "AnnualBillingError";
  }
}

const DECIMAL = /^-?(?:0|[1-9]\d*)\.\d{2}$/;
export function usdCents(value: string): bigint {
  if (!DECIMAL.test(value) || value === "-0.00") throw new AnnualBillingError("shape");
  return BigInt(value.replace(".", ""));
}
export function centsUsd(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** PostgREST puede entregar bigint como número o texto; nunca parseo parcial. */
function count(value: unknown): number {
  if (typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value)) {
    const exact = BigInt(value);
    if (exact <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(exact);
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new AnnualBillingError("shape");
}
export function decodeAnnualBilling(value: unknown, portal = false): AnnualBilling {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnualBillingError("shape");
  const row = value as Record<string, unknown>;
  if (portal && row.version !== 2) throw new AnnualBillingError("shape");
  const sinTasaCount = count(row.sin_tasa_count);
  const state = row.conversion_state;
  const subtotalUsd = row.subtotal_usd;
  if (state === "datos_invalidos" && subtotalUsd === null) return { state, subtotalUsd, sinTasaCount };
  if (typeof subtotalUsd !== "string") throw new AnnualBillingError("shape");
  usdCents(subtotalUsd);
  if ((state === "completo" && sinTasaCount === 0) || (state === "sin_tasa" && sinTasaCount > 0)) {
    return { state, subtotalUsd, sinTasaCount };
  }
  throw new AnnualBillingError("shape");
}

/** Puente limitado a motores existentes. Exige ida/vuelta exacta de centavos. */
export function billingNumber(value: AnnualBillingRead): number | null {
  if (value.state !== "completo" || value.subtotalUsd === null) return null;
  const cents = usdCents(value.subtotalUsd);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < -BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const result = Number(value.subtotalUsd);
  // Los consumidores/JSON reciben la representación decimal corta; toFixed
  // puede aparentar recuperar centavos que esa representación ya perdió.
  const decimal = String(result).match(/^(-?\d+)(?:\.(\d{1,2}))?$/);
  const roundTrip = decimal ? `${decimal[1]}.${(decimal[2] ?? "").padEnd(2, "0")}` : null;
  return Number.isFinite(result) && roundTrip === value.subtotalUsd ? result : null;
}

/** Conserva la atribución por fila; deduplica SOLO el contador por clave/ámbito. */
export function sumAnnualBilling(rows: Iterable<{ key: string; billing: AnnualBillingRead }>): AnnualBillingRead {
  let cents = 0n;
  let invalid = false;
  let unavailable = false;
  let missing = 0;
  const seen = new Map<string, AnnualBillingRead>();
  for (const { key, billing } of rows) {
    if (billing.state === "no_disponible") unavailable = true;
    if (billing.state === "datos_invalidos") invalid = true;
    if (billing.subtotalUsd !== null) cents += usdCents(billing.subtotalUsd);
    const previous = seen.get(key);
    if (previous && (previous.state !== billing.state || previous.subtotalUsd !== billing.subtotalUsd || previous.sinTasaCount !== billing.sinTasaCount)) unavailable = true;
    if (!previous) {
      missing += billing.sinTasaCount ?? 0;
      seen.set(key, billing);
    }
  }
  if (unavailable || !Number.isSafeInteger(missing)) return BILLING_UNAVAILABLE;
  return { state: invalid ? "datos_invalidos" : missing ? "sin_tasa" : "completo", subtotalUsd: invalid ? null : centsUsd(cents), sinTasaCount: missing };
}

/** Completos ordenados por importe exacto; pendientes al final, estables. */
export function compareAnnualBilling(a: AnnualBillingRead, b: AnnualBillingRead): number {
  if (a.state !== "completo" || b.state !== "completo") return Number(b.state === "completo") - Number(a.state === "completo");
  const delta = usdCents(b.subtotalUsd!) - usdCents(a.subtotalUsd!);
  return delta > 0n ? 1 : delta < 0n ? -1 : 0;
}
export function formatAnnualUsd(value: string | null): string {
  if (value === null) return "—";
  usdCents(value);
  const [whole, fraction] = value.split(".");
  return `${whole.startsWith("-") ? "−" : ""}$${whole.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
export function billingStatus(value: AnnualBillingRead): string {
  if (value.state === "no_disponible") return "Facturación anual no disponible";
  if (value.state === "datos_invalidos") return `Datos de facturación inválidos${value.sinTasaCount ? ` · ${value.sinTasaCount} sin tasa` : ""}`;
  if (value.state === "sin_tasa") return `Subtotal parcial · ${value.sinTasaCount} ${value.sinTasaCount === 1 ? "factura sin tasa" : "facturas sin tasa"}`;
  return "Facturación completa";
}
