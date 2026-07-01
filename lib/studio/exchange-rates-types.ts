/**
 * Tasas de cambio (SDD-0126) — types + validación.
 *
 * Gestiona `tenant_fx_history` (migr 0074), que YA es el store de tasas del
 * tenant: gastos (prefill) y el posting contable (receipt-posting) leen la
 * última por par. Acá el admin registra una tasa nueva → se agrega al historial
 * (append-only), sin crear otra fuente de verdad ni migración.
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
  setAt: string | null;
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
  input?: { pair: FxPair; rate: number };
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
  return { input: { pair: pairRaw as FxPair, rate } };
}
