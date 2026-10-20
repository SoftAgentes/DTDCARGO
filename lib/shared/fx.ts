/**
 * SDD-0569 · El conversor canónico a USD (2.1 del plan contable).
 *
 * La misma regla que `public.to_usd` (migración 0495) y que `amountToUsd` de
 * Financiero China:
 *  - USD y USDT valen 1:1 (decisión 1 de Sam, 2026-10-19: «todo el sistema
 *    tiene que estar en USDT»);
 *  - VES y CNY se dividen por la tasa (unidades de esa moneda por 1 USD). RMB es
 *    el nombre de Financiero China para CNY;
 *  - sin una tasa finita y mayor que 0, sin monto, con |monto| >= 1e12 o con una
 *    moneda desconocida, FALLA CERRADO: nunca devuelve 0 ni el monto tal cual.
 *    Quien llama decide qué hacer (no asentar, mostrar «sin convertir», pedir la
 *    tasa);
 *  - la cuenta es DECIMAL EXACTA (enteros escalados, BigInt), con el redondeo a 2
 *    decimales al final y la mitad lejos de cero, como `round(numeric, 2)` de
 *    Postgres. Con coma flotante, 15,66 CNY a 7,2 daba 2,17 y `to_usd` 2,18.
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

/**
 * Captura de documentos: valor que numeric(20,8) realmente conservará.
 * Redondea en decimal, mitad lejos de cero. Una entrada positiva que terminaría
 * en cero se rechaza; nunca se sustituye por otra tasa silenciosamente.
 * El conversor puro mantiene su dominio original mediante tasaValida.
 */
export function tasaPersistible(rate: number | string | null | undefined): number | null {
  if (tasaValida(rate) === null) return null;
  const decimal = aDecimal(rate as number | string);
  if (!decimal || decimal.entero <= BigInt(0)) return null;
  const diez = BigInt(10);
  let unidades: bigint;
  if (decimal.escala <= 8) {
    unidades = decimal.entero * diez ** BigInt(8 - decimal.escala);
  } else {
    const divisor = diez ** BigInt(decimal.escala - 8);
    unidades = decimal.entero / divisor;
    if ((decimal.entero % divisor) * BigInt(2) >= divisor) unidades += BigInt(1);
  }
  if (unidades <= BigInt(0) || unidades >= diez ** BigInt(20)) return null;
  return tasaValida(Number(unidades) / 100_000_000);
}

/** Un decimal exacto: valor = entero / 10^escala. */
type Decimal = { entero: bigint; escala: number };

/**
 * El número tal como se escribe (`String(15.66)` es «15.66», el decimal más
 * corto que da ese double), sin pasar por la aritmética de coma flotante.
 */
function aDecimal(valor: number | string): Decimal | null {
  const s = (typeof valor === "number" ? String(valor) : valor).trim();
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null;
  const decimales = m[3] ?? "";
  let escala = decimales.length - Number(m[4] ?? 0);
  let entero = BigInt((m[2] || "0") + decimales);
  if (escala < 0) {
    entero *= BigInt(10) ** BigInt(-escala);
    escala = 0;
  }
  return { entero: m[1] === "-" ? -entero : entero, escala };
}

/** numerador / denominador en centavos, con la mitad lejos de cero (denominador > 0). */
function centavos(numerador: bigint, denominador: bigint): number {
  const negativo = numerador < BigInt(0);
  const n = negativo ? -numerador : numerador;
  let q = n / denominador;
  if ((n % denominador) * BigInt(2) >= denominador) q += BigInt(1);
  return (negativo ? -Number(q) : Number(q)) / 100;
}

/** El monto en USD, o por qué no se puede convertir. Redondea a 2 decimales al final. */
export function toUsd(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  rate?: number | string | null,
): ResultadoUsd {
  const a = amount == null ? null : Number(amount);
  const monto = amount == null || a === null || !Number.isFinite(a) || Math.abs(a) >= TOPE ? null : aDecimal(amount);
  if (monto === null) return { ok: false, reason: "invalid-amount" };
  const m = normalizarMoneda(currency);
  if (m === null) return { ok: false, reason: "unknown-currency" };
  const diez = BigInt(10);
  if (m === "USD" || m === "USDT") {
    return { ok: true, usd: centavos(monto.entero * BigInt(100), diez ** BigInt(monto.escala)) };
  }
  const r = tasaValida(rate);
  const tasa = r === null ? null : aDecimal(rate as number | string);
  if (tasa === null || tasa.entero <= BigInt(0)) return { ok: false, reason: "missing-fx-rate" };
  // (monto / 10^ea) / (tasa / 10^et) en centavos = monto·10^et·100 / (tasa·10^ea).
  return {
    ok: true,
    usd: centavos(
      monto.entero * diez ** BigInt(tasa.escala) * BigInt(100),
      tasa.entero * diez ** BigInt(monto.escala),
    ),
  };
}

/**
 * SDD-0572 · El monto en USD, o null si no se puede convertir (sin tasa, moneda
 * desconocida, monto inválido). Para los que suman: null va a «sin convertir»,
 * nunca a 0 ni al monto tal cual.
 */
export function usdOrNull(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  rate?: number | string | null,
): number | null {
  const r = toUsd(amount, currency, rate);
  return r.ok ? r.usd : null;
}

/**
 * SDD-0572 · Suma en USD exacta (en centavos) de varios montos. Los que no
 * convierten no suman: se cuentan en `sinConvertir` para que la pantalla diga
 * «N sin tasa» al lado del total.
 */
export function sumarEnUsd(
  items: Iterable<{ amount: number | string | null | undefined; currency: string | null | undefined; rate?: number | string | null }>,
): { usd: number; sinConvertir: number } {
  let centavosTotales = 0;
  let sinConvertir = 0;
  for (const it of items) {
    const usd = usdOrNull(it.amount, it.currency, it.rate);
    if (usd === null) sinConvertir += 1;
    else centavosTotales += Math.round(usd * 100);
  }
  return { usd: centavosTotales / 100, sinConvertir };
}
