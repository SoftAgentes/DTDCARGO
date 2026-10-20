/**
 * SDD-0569 · El conversor canónico a USD (2.1 del plan contable).
 *
 * La misma regla que `public.to_usd` (migración 0495) y que `amountToUsd` de
 * Financiero China:
 *  - USD y USDT valen 1:1 (decisión 1 de Sam, 2026-10-19: «todo el sistema
 *    tiene que estar en USDT»);
 *  - VES y CNY se dividen por la tasa (unidades de esa moneda por 1 USD). RMB es
 *    el nombre de Financiero China para CNY;
 *  - sin una tasa finita y mayor que 0, o con una moneda desconocida, FALLA
 *    CERRADO: nunca devuelve 0 ni el monto tal cual. Quien llama decide qué
 *    hacer (no asentar, mostrar «sin convertir», pedir la tasa).
 *
 * Es puro y sin dependencias: lo pueden usar el Studio, el portal y el móvil.
 * Los 13 conversores de hoy se reemplazan por este en la SDD siguiente.
 */

/** Las monedas que el sistema convierte. USDT es un USD (1:1). */
export type MonedaConvertible = "USD" | "USDT" | "VES" | "CNY";

export type ResultadoUsd =
  | { ok: true; usd: number }
  | { ok: false; reason: "missing-fx-rate" | "unknown-currency" | "invalid-amount" };

/** Mismo tope que la 0495: deja afuera a NaN, Infinity y montos absurdos. */
const TOPE = 1_000_000_000_000;

/** El código en mayúsculas, con RMB como CNY. null si no es una moneda que se convierte. */
export function normalizarMoneda(currency: string | null | undefined): MonedaConvertible | null {
  const c = (currency ?? "").trim().toUpperCase();
  const m = c === "RMB" ? "CNY" : c;
  return m === "USD" || m === "USDT" || m === "VES" || m === "CNY" ? m : null;
}

/** ¿Esta moneda necesita tasa para pasar a USD? USD y USDT no. */
export function necesitaTasa(currency: string | null | undefined): boolean {
  const m = normalizarMoneda(currency);
  return m === "VES" || m === "CNY";
}

/** Una tasa válida: un número finito, mayor que 0 y por debajo del tope. */
export function tasaValida(rate: number | string | null | undefined): number | null {
  if (rate == null || rate === "") return null;
  const r = Number(rate);
  return Number.isFinite(r) && r > 0 && r < TOPE ? r : null;
}

const redondear2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** El monto en USD, o por qué no se puede convertir. Redondea a 2 decimales al final. */
export function toUsd(
  amount: number | string,
  currency: string | null | undefined,
  rate?: number | string | null,
): ResultadoUsd {
  const a = Number(amount);
  if (!Number.isFinite(a) || Math.abs(a) >= TOPE) return { ok: false, reason: "invalid-amount" };
  const m = normalizarMoneda(currency);
  if (m === null) return { ok: false, reason: "unknown-currency" };
  if (m === "USD" || m === "USDT") return { ok: true, usd: redondear2(a) };
  const r = tasaValida(rate);
  if (r === null) return { ok: false, reason: "missing-fx-rate" };
  return { ok: true, usd: redondear2(a / r) };
}
