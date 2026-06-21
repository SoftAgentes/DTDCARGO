/**
 * Gate del rediseño "Norte" del portal del cliente (founder 2026-06-20).
 *
 * El rediseño del portal a la imagen del Norte se construye GATEADO: solo las
 * cuentas DEMO lo ven; los clientes reales siguen con el portal actual hasta que
 * el founder diga "préndelo para todos". Así armamos el rediseño en producción sin
 * que ningún cliente real lo vea hasta estar listo (cero riesgo).
 *
 * El gate es por MARKBOX (allowlist en código) → SIN migración. La cuenta demo que
 * ya existe es DTD-1004 ("Demo Pyme C.A.", login hailuway.com@gmail.com), sembrada
 * por `scripts/seed-portal-demo.sql`. Para sumar otra cuenta demo, agregá su
 * markbox a `DEMO_MARKBOXES`.
 *
 * Patrón de uso por pantalla (server component del portal):
 *   const client = await getPortalClient(supabase);
 *   if (isDemoMarkbox(client?.markbox)) return <PantallaNorte .../>;  // rediseño
 *   return <PantallaActual .../>;                                     // lo de hoy
 *
 * Para prender el rediseño PARA TODOS cuando esté listo: hacer que
 * `isDemoMarkbox` devuelva `true` siempre (o quitar los condicionales por pantalla
 * y dejar solo la versión Norte).
 */

/** MARKBOX de las cuentas que ven el rediseño "Norte" del portal (demo/preview). */
export const DEMO_MARKBOXES: readonly string[] = ["DTD-1004"];

/**
 * ¿Esta cuenta (por su markbox) ve el rediseño "Norte" del portal? `true` solo
 * para las cuentas demo del allowlist; los clientes reales reciben `false` y
 * siguen con el portal actual.
 */
export function isDemoMarkbox(markbox: string | null | undefined): boolean {
  return typeof markbox === "string" && DEMO_MARKBOXES.includes(markbox);
}
