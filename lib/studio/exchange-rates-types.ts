/**
 * Tasas de cambio (SDD-0126, SDD-0569) — types + validación.
 *
 * Desde la SDD-0569 las tasas viven en `fx_rates` (migración 0495): por moneda
 * y día de Caracas, con fuente (bcv, manual u operacion) y quién. Acá el admin
 * registra la tasa manual de un día por la RPC `registrar_tasa_de_cambio`; una
 * segunda del mismo día la reemplaza y queda en la auditoría. Facturas y CxP
 * precargan la vigente (`fx_rate_on`) y la congelan en el documento.
 * `tenant_fx_history` ya no se escribe.
 */

import { FX_RATE_SANITY_RANGE } from "./expense-types";

/** Pares gestionables (USD no aplica: fx = 1). */
export const FX_PAIRS = ["CNY/USD", "VES/USD"] as const;
export type FxPair = (typeof FX_PAIRS)[number];

export function fxPairLabel(pair: FxPair): string {
  switch (pair) {
    case "CNY/USD":
      return "Yuan · CNY / USD";
    case "VES/USD":
      return "Bolívar · VES / USD";
  }
}

export interface FxRateLatest {
  pair: FxPair;
  rate: number | null;
  /** La fecha de valor de la tasa (AAAA-MM-DD, día de Caracas). */
  validOn: string | null;
  source: "bcv" | "manual" | "operacion" | null;
}

/** La moneda que se registra para cada par. */
export function fxPairCurrency(pair: FxPair): "VES" | "CNY" {
  return pair === "VES/USD" ? "VES" : "CNY";
}

export interface ExchangeRatesOverview {
  latest: FxRateLatest[];
}

export interface ExchangeRateActionState {
  ok?: boolean;
  error?: string;
}

/** ¿La tasa está fuera del rango histórico razonable? (warning UI, no bloquea). */
export function isFxOutOfRange(pair: string, rate: number): boolean {
  const range = FX_RATE_SANITY_RANGE[pair];
  if (!range) return false;
  return rate < range[0] || rate > range[1];
}

export function validateExchangeRateInput(fd: FormData): {
  input?: { pair: FxPair; rate: number; validOn: string; note: string | null };
  error?: string;
} {
  const pairRaw = typeof fd.get("pair") === "string" ? (fd.get("pair") as string) : "";
  if (!(FX_PAIRS as readonly string[]).includes(pairRaw)) {
    return { error: "Par de moneda inválido." };
  }
  const rateRaw = typeof fd.get("rate") === "string" ? (fd.get("rate") as string).trim() : "";
  const rate = Number(rateRaw.replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: "La tasa debe ser un número mayor a 0." };
  }
  // fx_rates.rate es numeric(20,8): la RPC rechaza más decimales (0495).
  if (/[.,]\d{9,}$/.test(rateRaw)) {
    return { error: "La tasa admite hasta 8 decimales." };
  }
  const validOn = typeof fd.get("valid_on") === "string" ? (fd.get("valid_on") as string).trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validOn)) {
    return { error: "Indica la fecha de la tasa." };
  }
  const noteRaw = typeof fd.get("note") === "string" ? (fd.get("note") as string).trim() : "";
  if (noteRaw.length > 500) return { error: "La nota no puede pasar de 500 caracteres." };
  return { input: { pair: pairRaw as FxPair, rate, validOn, note: noteRaw || null } };
}
