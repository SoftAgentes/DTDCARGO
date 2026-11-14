/** SDD-0569 · VES por 1 USD. Las tasas nunca pasan por coma flotante. */
export const BCV_URL = "https://www.bcv.org.ve/";
export const BCV_SOURCE_TIMEOUT_MS = 20_000;
export const BCV_RUN_TIMEOUT_MS = 50_000;
export const BCV_MAX_BYTES = 1_048_576;
export const BCV_MAX_TENANTS = 25;
/**
 * Banda de plausibilidad (decisión de Sam, valores por defecto propuestos):
 * la tasa nueva no puede alejarse más de este porcentaje (en puntos básicos)
 * de la última tasa vigente del tenant, y esa referencia no puede tener más de
 * estos días. Si falla, el día queda retenido para revisión humana: no se
 * publica ni se pisa la manual.
 */
export const BCV_RATE_MAX_CHANGE_BPS = 1_500n;
export const BCV_RATE_REFERENCE_MAX_AGE_DAYS = 10;

export type BcvReason =
  | "DISABLED" | "INVALID_QUERY" | "INVALID_SCOPE" | "CLIENT_UNAVAILABLE"
  | "SCOPE_UNAVAILABLE" | "SNAPSHOT_UNAVAILABLE" | "SQL_CONTRACT_UNAVAILABLE"
  | "SOURCE_UNAVAILABLE" | "SOURCE_INVALID" | "SOURCE_TOO_LARGE"
  | "SOURCE_REDIRECT_REJECTED" | "SOURCE_TIMEOUT" | "DEADLINE"
  | "DAY_CHANGED" | "WAITING_FOR_VALUE_DATE" | "NO_TODAY_QUOTE_IN_RESPONSE"
  | "WRITE_FAILED" | "WRITE_CONFLICT" | "WRITE_UNKNOWN" | "RATE_HELD_FOR_REVIEW" | "CANDIDATE_VALIDATED" | "COMPLETED";

export class BcvError extends Error {
  constructor(readonly reason: BcvReason) {
    // Solo códigos propios seguros: nunca body, SQL, credenciales o errores externos.
    super(reason);
    this.name = "BcvError";
  }
}

export type BcvQuote = Readonly<{
  currency: "VES";
  source: "bcv";
  unit: "VES/USD";
  rate: string;
  validOn: string;
}>;

export type BcvObservation = Readonly<{
  quote: BcvQuote;
  retrievedAt: string;
  sha256: string;
  bytes: number;
}>;

export type BcvCounts = {
  scope: number;
  inserted: number;
  corrected: number;
  unchanged: number;
  reconciled: number;
  conflicts: number;
  failed: number;
  unknown: number;
  /** Retenidos por la banda de plausibilidad: sin referencia o fuera de banda. */
  held: number;
  notAttempted: number;
  deferred: number;
};

export type BcvSummary = Readonly<{
  status: "DISABLED" | "CANDIDATE" | "COMPLETED" | "PARTIAL" | "REJECTED" | "WAITING";
  reason: BcvReason;
  dryRun: boolean;
  today: string;
  startedAt: string;
  counts: BcvCounts;
  observation?: Readonly<{ validOn: string; rate: string; retrievedAt: string; sha256: string }>;
}>;

/** Clave exacta de numeric(20,8); null si no es positivo/representable. */
export function decimalRateKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^[0-9]{1,12}(?:\.[0-9]{1,8})?$/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  const scaled = BigInt(integer) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
  if (scaled <= 0n || scaled >= 100_000_000_000_000_000_000n) return null;
  return scaled.toString();
}

export function sameDecimalRate(left: string, right: string): boolean {
  const key = decimalRateKey(left);
  return key !== null && key === decimalRateKey(right);
}

export function emptyBcvCounts(scope = 0): BcvCounts {
  return { scope, inserted: 0, corrected: 0, unchanged: 0, reconciled: 0,
    conflicts: 0, failed: 0, unknown: 0, held: 0, notAttempted: scope, deferred: 0 };
}

/**
 * ¿La tasa nueva cae dentro de la banda respecto de la referencia? Aritmética
 * exacta sobre numeric(20,8) escalado: |nueva − ref| × 10000 ≤ ref × bps.
 */
export function rateWithinBand(next: string, reference: string, maxChangeBps = BCV_RATE_MAX_CHANGE_BPS): boolean {
  const a = decimalRateKey(next), b = decimalRateKey(reference);
  if (a === null || b === null) return false;
  const delta = BigInt(a) > BigInt(b) ? BigInt(a) - BigInt(b) : BigInt(b) - BigInt(a);
  return delta * 10_000n <= BigInt(b) * maxChangeBps;
}
