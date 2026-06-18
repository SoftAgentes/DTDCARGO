/**
 * Matriz de rutas que el cron de SeaRates cachea SEMANALMENTE (SDD-0094 Fase 2).
 *
 * Dimensionada para CABER EN LA CUOTA (100 llamadas/mes): se deriva del catálogo
 * público (`lib/shared/ocean-rate.ts`) cruzando orígenes × destinos × configs.
 *   2 orígenes (CN) × 3 destinos (VE) × 2 configs (LCL + FCL HC40) = 12 rutas/semana
 *   ≈ 52/mes → entra holgado en 100 (+ headroom para reintentos).
 *
 * Cada llamada gasta 1 rate (+ 1 auth cacheada). Si Oleh sube el límite, se
 * expande el catálogo o la cadencia sin tocar código del cron (solo data).
 *
 * Vive en `lib/studio/` (lado ERP) porque la consume el cron, que sí puede usar
 * el cliente SeaRates server-only. NO lo importa el sitio público.
 */

import {
  OCEAN_ORIGINS,
  OCEAN_DESTINATIONS,
  type OceanShippingType,
  type OceanContainer,
} from "@/lib/shared/ocean-rate";

/** Una ruta a cachear. Para LCL se usa un volumen de referencia (1 CBM). */
export type OceanMatrixRoute = {
  pointIdFrom: string;
  pointIdTo: string;
  shippingType: OceanShippingType;
  container?: OceanContainer;
  /** Volumen de referencia para LCL (m³). El escalado por CBM real es slice B. */
  volumeM3?: number;
  /** Peso de referencia para LCL (kg). */
  weightKg?: number;
};

/** Configs que se cachean por cada par origen→destino. */
const ROUTE_CONFIGS: ReadonlyArray<Omit<OceanMatrixRoute, "pointIdFrom" | "pointIdTo">> = [
  // LCL con 1 CBM de referencia (la mayoría del negocio DTD es LCL).
  { shippingType: "LCL", volumeM3: 1, weightKg: 250 },
  // FCL 40' High Cube (el contenedor más usado en la ruta).
  { shippingType: "FCL", container: "HC40" },
];

/** La matriz completa: catálogo de orígenes × destinos × configs. */
export const OCEAN_RATES_MATRIX: readonly OceanMatrixRoute[] = OCEAN_ORIGINS.flatMap(
  (from) =>
    OCEAN_DESTINATIONS.flatMap((to) =>
      ROUTE_CONFIGS.map((cfg) => ({
        pointIdFrom: from.id,
        pointIdTo: to.id,
        ...cfg,
      })),
    ),
);
