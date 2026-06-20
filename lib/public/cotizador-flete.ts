/**
 * Helpers del cotizador público de fletes (SDD-0095 Slice B · lado público).
 *
 * Lógica PURA de presentación: aplica el markup configurable al flete cacheado y
 * arma el mensaje de WhatsApp para la cotización en firme. Vive en `lib/public/`
 * (frontera: puede importar tipos de `@/lib/shared/*`, nunca código del ERP).
 *
 * Presentación del precio (decisión founder, configurable):
 *   - A) "Desde USD X"  → markup 0 = flete crudo cacheado.
 *   - B) precio DTD      → markup > 0 aplica el margen.
 *   - C) rango           → cuando la caché guarde un máximo (follow-up); hoy se
 *        muestra "desde" + cuántas navieras se compararon (offersCount).
 */

import type { PublicOceanRate } from "@/lib/shared/ocean-rate";

/**
 * Markup % sobre el flete cacheado para la presentación pública.
 * **0 = flete crudo** (white-label, opción A). Subilo cuando el founder defina el
 * margen DTD (opción B). Único punto de cambio del número mostrado.
 */
export const FREIGHT_MARKUP_PCT = 0;

/** Aplica el markup de presentación al flete y redondea a USD entero. */
export function applyFreightMarkup(
  rateUsd: number,
  pct: number = FREIGHT_MARKUP_PCT,
): number {
  if (!Number.isFinite(rateUsd) || rateUsd <= 0) return 0;
  return Math.round(rateUsd * (1 + pct / 100));
}

/** Respuesta del endpoint `/api/public/ocean-rate`. */
export type OceanRateResponse = {
  available: boolean;
  rate: PublicOceanRate | null;
  disclaimer: string;
};

/** Arma el mensaje de WhatsApp para pedir la cotización en firme (white-label). */
export function buildFleteWhatsAppMessage(args: {
  originName: string;
  destName: string;
  modeLabel: string;
  priceUsd: number | null;
}): string {
  return [
    "Hola, vi el estimado de flete en la web y quiero cotizar en firme:",
    "",
    `• Ruta: ${args.originName} → ${args.destName}`,
    `• Modo: ${args.modeLabel}`,
    ...(args.priceUsd != null && args.priceUsd > 0
      ? [`• Estimado web: desde US$${args.priceUsd.toLocaleString("en-US")}`]
      : []),
    "",
    "¿Me confirman tarifa, cupo y fecha de salida?",
  ].join("\n");
}
