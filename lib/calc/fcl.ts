/**
 * Cálculo puro del estimado FCL (contenedor completo · reserva_FCL).
 *
 * A diferencia del LCL (por CBM) o el terrestre (por peso/zona), el FCL se cobra
 * por TARIFA FLAT por contenedor por ruta. El "cálculo" es directo:
 *   total = nº de contenedores × tarifa flat de la ruta (con piso opcional).
 *
 * La lista de rutas públicas la trae `getPublicFclRoutes()` (RPC anon) desde la
 * tabla `rates` (service='reserva_FCL', is_public). El cliente elige una ruta y la
 * cantidad de contenedores → ve el total al instante. La tarifa final la confirma
 * un asesor (igual que LCL): naviera, tipo de contenedor real (20'/40'/HC) y
 * disponibilidad afinan el precio.
 *
 * Módulo PURO (sin red, sin Supabase) → testeable.
 */

/** Estimado FCL calculado para mostrar en la calculadora. */
export type FclEstimate = {
  /** Contenedores cotizados (entero ≥ 1). */
  containers: number;
  /** Tarifa flat por contenedor (USD), de la ruta elegida. */
  flatRate: number;
  /** containers × flatRate. */
  subtotal: number;
  /** Piso comercial de la ruta, si lo hay. */
  minCharge: number | null;
  /** Total a mostrar (USD): subtotal, elevado al piso si aplica. */
  total: number;
};

/**
 * Calcula el estimado FCL. `containers` se normaliza a entero ≥ 1. Si la ruta
 * trae `minCharge`, el total nunca baja de ese piso (defensa; en la práctica FCL
 * no suele tener piso porque la flat YA es el cargo).
 */
export function calcFclEstimate(
  route: { flatRate: number; minCharge: number | null },
  opts: { containers: number },
): FclEstimate {
  const containers = Math.max(1, Math.floor(Number(opts.containers)) || 1);
  const flatRate =
    Number.isFinite(route.flatRate) && route.flatRate > 0 ? route.flatRate : 0;
  const subtotal = containers * flatRate;
  const minCharge =
    route.minCharge != null && Number.isFinite(route.minCharge) && route.minCharge > 0
      ? route.minCharge
      : null;
  const total = minCharge != null ? Math.max(subtotal, minCharge) : subtotal;
  return { containers, flatRate, subtotal, minCharge, total };
}

/** Etiqueta de ruta para el selector y el mensaje de WhatsApp ("Origen → Destino"). */
export function fclRouteLabel(route: {
  origin: string;
  destination: string;
}): string {
  return `${route.origin} → ${route.destination}`;
}
