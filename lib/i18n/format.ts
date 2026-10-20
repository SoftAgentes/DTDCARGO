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

