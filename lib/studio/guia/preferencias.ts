/**
 * lib/studio/guia/preferencias.ts · Decisiones de la guía pendientes de Sam (SDD-0589, 9.3).
 *
 * Valen las propuestas del guion (`docs/specs/0582-chatwoot-piloto/guia-guion.md`,
 * S-6 y S-7) como valores provisionales. Cambiarlas es cambiar una constante aquí,
 * no reestructurar el motor.
 */

/**
 * S-6, pendiente de Sam: cuándo arranca sola la guía.
 * - `por_pantalla` (propuesta): la primera vez que alguien entra a cada pantalla con recorrido.
 * - `una_vez`: solo la primera pantalla con recorrido; después, solo con el botón.
 */
export type ModoArranque = "por_pantalla" | "una_vez";
export const ARRANQUE_AUTOMATICO: ModoArranque = "por_pantalla";

/**
 * S-7, pendiente de Sam: el nombre del botón es esta clave de i18n («Guía»). El lugar
 * es donde se monte `<GuiaBoton />`: la propuesta es la barra superior de Studio, y
 * montarlo ahí es una línea en `StudioTopbar.tsx` que espera a la adopción del
 * rediseño (SDD-0603).
 */
export const CLAVE_NOMBRE_BOTON = "guide.chrome.toggle";
