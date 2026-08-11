/**
 * lib/money.ts · El formato de plata del ERP. Punto único.
 *
 * Antes de esto había **21 definiciones propias de `fmtUsd`** repartidas por
 * `app/` y `lib/`, con **13 comportamientos distintos**: el mismo 1234.5 salía
 * `$1,234.50` en Nómina, `$1,235` en Kommo, `$1K` en Reportes y
 * `USD 1.234,50` en el móvil del empleado. El cero salía de cinco formas y el
 * negativo de tres (`-$80`, `$-80`, `−$80` con U+2212).
 *
 * Decisión del founder (2026-08-11):
 *   - Todo el ERP muestra la plata igual: `$1,234.50` (en-US, 2 decimales).
 *   - Kommo, Costing y Dirección recuperan los centavos que redondeaban.
 *   - El móvil del empleado deja de usar `es-VE` y se alinea con el resto.
 *   - **Única excepción:** los KPI de Reportes siguen compactos (`fmtUsdCompact`).
 *
 * ⚠️ NO confundir con `formatCurrency` de `lib/i18n/format.ts`: ése es
 * locale-aware para el IDIOMA de la UI (`es-VE` | `zh-CN`) y no admite `en-US`.
 * Son dos problemas distintos — el idioma del usuario y el formato contable.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLAIN = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `$1,234.50` · `-$80.25` · `$0.00`. El formato por defecto del ERP. */
export function fmtUsd(n: number): string {
  const v = Number(n);
  return USD.format(Number.isFinite(v) ? v : 0);
}

/**
 * `1,234.50` — sin símbolo. Para los sitios que ya escriben `USD` o `$` al
 * lado (rendiciones impresas, cobranzas, el texto de WhatsApp del cotizador).
 */
export function fmtAmount(n: number): string {
  const v = Number(n);
  return PLAIN.format(Number.isFinite(v) ? v : 0);
}

/**
 * `$1K` · `$1.25M` · `$850` — para KPIs donde el ancho manda y el centavo es
 * ruido. Sólo lo usan las tarjetas de Reportes; no lo repliques por comodidad.
 */
export function fmtUsdCompact(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}
