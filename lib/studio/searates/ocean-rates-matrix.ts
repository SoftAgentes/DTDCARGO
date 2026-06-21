/**
 * Matriz de rutas que el cron de SeaRates cachea SEMANALMENTE (SDD-0095).
 *
 * Se deriva del catálogo público (`lib/shared/ocean-rate.ts`) cruzando orígenes ×
 * destinos × [40'HQ]. La query a SeaRates usa COORDENADAS (`coordsFrom`/`coordsTo`
 * del catálogo) → agregar un puerto al cotizador = sumar su lat/lng, sin cazar IDs.
 *
 *   5 puertos export (CN) × 5 destinos (VE) × 1 contenedor (40'HQ) = 25 rutas; el cap
 *   (WEEKLY_CALL_CAP=23) cachea las 23 principales (las 2 menos comunes → WhatsApp).
 *   Cacheamos SOLO el 40'HQ (founder 2026-06-21): así entran MÁS
 *   puertos dentro del tope de 20; el 20'/40' estándar cae a "pedir por WhatsApp".
 *
 * `refreshOceanRates` además aplica el tope duro de 20/corrida como guard de cuota.
 * Cada llamada gasta 1 rate (+ 1 auth cacheada).
 *
 * Vive en `lib/studio/` (lado ERP) porque la consume el cron, que sí puede usar el
 * cliente SeaRates server-only. NO lo importa el sitio público.
 */

import {
  OCEAN_ORIGINS,
  OCEAN_DESTINATIONS,
  type OceanShippingType,
  type OceanContainer,
} from "@/lib/shared/ocean-rate";

/**
 * Una ruta a cachear (FCL). `fromId`/`toId` = slugs del catálogo (= clave de caché
 * en `ocean_rates`); `coordsFrom`/`coordsTo` = [lat,lng] para la query a SeaRates.
 */
export type OceanMatrixRoute = {
  fromId: string;
  toId: string;
  coordsFrom: readonly [number, number];
  coordsTo: readonly [number, number];
  shippingType: OceanShippingType;
  container: OceanContainer;
};

/** Contenedor cacheado: SOLO el default (40' High Cube), para que entren más puertos. */
const CACHED_CONTAINER: OceanContainer = "HC40";

/** La matriz: orígenes × destinos × [40'HQ]. 5×4 = 20 = WEEKLY_CALL_CAP. */
export const OCEAN_RATES_MATRIX: readonly OceanMatrixRoute[] = OCEAN_ORIGINS.flatMap((from) =>
  OCEAN_DESTINATIONS.map((to) => ({
    fromId: from.id,
    toId: to.id,
    coordsFrom: [from.lat, from.lng] as const,
    coordsTo: [to.lat, to.lng] as const,
    shippingType: "FCL" as const,
    container: CACHED_CONTAINER,
  })),
);
