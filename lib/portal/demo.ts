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

/**
 * ¿El rediseño "Norte" del portal está PRENDIDO PARA TODOS? (formalización · founder
 * 2026-06-20: "cambiar las plantillas de los clientes a que apunten a Norte").
 *
 * Mientras es `false`, sólo las cuentas demo ven el rediseño + el modo oscuro; en
 * `true` lo ve TODO cliente. Es el ÚNICO interruptor del go-live: con esto en `true`
 * las pantallas rediseñadas (Inicio · Envíos · Facturas) + el modo oscuro por defecto
 * pasan a producción para todos los clientes. Para revertir: poné `false`.
 */
export const NORTE_PORTAL_LIVE = true;

/**
 * ¿Mostrarle a este cliente el portal "Norte" (rediseño + modo oscuro)? `true` para
 * todos cuando `NORTE_PORTAL_LIVE`; si no, sólo para las cuentas demo. Es el gate
 * único que usan el layout (tema), el header (toggle) y las páginas (qué componente
 * renderizar).
 */
export function showNortePortal(markbox: string | null | undefined): boolean {
  return NORTE_PORTAL_LIVE || isDemoMarkbox(markbox);
}
