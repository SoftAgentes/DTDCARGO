/**
 * lib/i18n/format.ts · Formatters locale-aware con Intl.* nativo.
 *
 * Reemplaza los `toLocaleString("es-VE")` hardcoded del codebase por
 * helpers que respetan el locale del user activo. Cero dependencias
 * nuevas — usa `Intl.DateTimeFormat` e `Intl.NumberFormat` del browser.
 *
 * Convención:
 *   - es-VE: fecha "27 may. 2026", número "12.323,50"
 *   - zh-CN: fecha "2026年5月27日", número "12,323.50"
 *
 * Ver plan sección A.6.
 */

import type { Locale } from "./locales";
import type { ExpenseCurrency } from "./region";

export type DateStyle = "short" | "long" | "datetime";

/**
 * Formatea una fecha según el locale.
 *
 *   formatDate("2026-05-27", "es-VE", "short")    → "27 may 2026"
 *   formatDate("2026-05-27", "zh-CN", "short")    → "2026年5月27日"
 *   formatDate(now, "es-VE", "datetime")          → "27 may 2026, 14:35"
 *   formatDate(now, "zh-CN", "datetime")          → "2026年5月27日 14:35"
 */
export function formatDate(
  value: Date | string | number,
  locale: Locale,
  style: DateStyle = "short",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { year: "numeric", month: "short", day: "numeric" }
      : style === "long"
        ? { year: "numeric", month: "long", day: "numeric", weekday: "long" }
        : {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          };

  return new Intl.DateTimeFormat(locale, options).format(d);
}

/**
 * Formatea un número genérico según el locale.
 *
 *   formatNumber(12323.5, "es-VE")  → "12.323,5"
 *   formatNumber(12323.5, "zh-CN")  → "12,323.5"
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formatea un monto monetario.
 *
 *   formatCurrency(12323.5, "USD", "es-VE")  → "USD 12.323,50"
 *   formatCurrency(12323.5, "CNY", "zh-CN")  → "¥12,323.50"
 *   formatCurrency(12323.5, "USD", "zh-CN")  → "US$12,323.50"
 *   formatCurrency(12323.5, "VES", "es-VE")  → "Bs. 12.323,50"
 *
 * Usa Intl con currency style — la posición del símbolo, separadores
 * y cantidad de decimales los decide el locale + ISO 4217 estándar.
 */
export function formatCurrency(
  amount: number,
  currency: ExpenseCurrency,
  locale: Locale,
): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

