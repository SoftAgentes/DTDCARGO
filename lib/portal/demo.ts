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

/**
 * ¿El CTA de aceptación DENTRO del detalle del envío está PRENDIDO PARA TODOS?
 * (SDD-0075 §1 · Slice A — formalizado para todos los clientes, founder 2026-07-22).
 *
 * NO abre capacidad nueva: la aceptación ya es visible para todos vía el
 * `PendingAcceptanceCard` del dashboard; esto DUPLICA el acceso en el detalle del
 * envío (decisión de la spec: duplicar, no mover — `/portal/facturas/[code]/aceptar`
 * sigue intacta). Para revertir: poné `false`.
 */
export const SHIPMENT_ACCEPTANCE_CTA_LIVE = true;

/**
 * ¿Mostrarle a este cliente el CTA de aceptación en el detalle del envío? `true`
 * para todos cuando `SHIPMENT_ACCEPTANCE_CTA_LIVE`; mientras tanto, sólo las
 * cuentas demo (para revisarlo en producción sin exponerlo).
 */
export function showShipmentAcceptanceCta(
  markbox: string | null | undefined,
): boolean {
  return SHIPMENT_ACCEPTANCE_CTA_LIVE || isDemoMarkbox(markbox);
}

/**
 * ¿"Nueva compra" es el asistente de 3 pasos del Norte? (SDD-0172 · brecha 3 de
 * la Fase 7 del Revestido).
 *
 * Nace APAGADO a propósito: se entrega por partes (paso 1 → 2 → 3), y mientras
 * tanto el formulario largo de siempre sigue atendiendo a los clientes reales.
 * Las cuentas demo ven el asistente desde el primer tramo, que es como se revisa
 * en producción sin exponerlo. Se prende cuando los 3 pasos están verificados en
 * el navegador. Para revertir: poné `false`.
 */
export const NEW_PURCHASE_WIZARD_LIVE = false;

/**
 * ¿Mostrarle a este cliente el asistente de 3 pasos de "Nueva compra"? `true`
 * para todos cuando `NEW_PURCHASE_WIZARD_LIVE`; mientras tanto, sólo las cuentas
 * demo.
 */
export function showNewPurchaseWizard(
  markbox: string | null | undefined,
): boolean {
  return NEW_PURCHASE_WIZARD_LIVE || isDemoMarkbox(markbox);
}

/**
 * ¿El alta de proveedor pide la ficha extendida del Norte? (SDD-0172 · de dónde
 * salió · si ya le había comprado · canal de comunicación).
 *
 * 🔴 **Depende de la migración `0266_suppliers_cn_portal_profile`, que NO está
 * aplicada.** Con el flag en `false` la ficha no se pinta y la server action no
 * manda esos campos — el alta funciona igual aunque este código llegue a prod
 * antes que la migración. ORDEN OBLIGATORIO: primero aplicar la migración,
 * DESPUÉS prender esto. Al revés el insert revienta.
 *
 * Por eso NO cuelga de `isDemoMarkbox`: ni siquiera las cuentas demo pueden
 * verlo antes de tiempo, porque el que rompería es el INSERT, no la vista.
 */
export const SUPPLIER_PROFILE_EXTENDED_LIVE = false;
