/**
 * SDD-0495 · El aviso de que la reversión del crédito de referido no se completó.
 *
 * ## Por qué vive acá y no al lado de `voidInvoice`
 *
 * `app/studio/(app)/facturacion/actions.ts` es un módulo `"use server"`, y de
 * uno de esos **sólo se pueden exportar funciones async**: un `export const`
 * rompe el build de Next (los 40 y pico de `actions.ts` del Studio exportan
 * únicamente tipos e interfaces, que se borran al compilar). Y el texto lo
 * necesitan los dos lados —la action que lo devuelve y el banner que lo pinta—,
 * así que tiene que ser importable desde un client component. Un módulo neutro
 * resuelve las dos cosas.
 *
 * ## Por qué son DOS textos y no uno
 *
 * `revertReferralCreditsForInvoice` devuelve `{ ok, reverted, error? }` y
 * recorre los créditos de la factura de a uno: acumula `reverted` por cada uno
 * que sale bien y junta el resto en `failures`. O sea que con más de un crédito
 * en la misma factura, **`ok: false` con `reverted > 0` es alcanzable hoy**, sin
 * esperar a que la reversión se mude a SQL: uno se liberó y otro no.
 *
 * Decir «el crédito no se pudo liberar» en ese caso es **falso**, y manda a
 * alguien a arreglar algo que en parte ya está bien. El aviso distingue los dos
 * casos, y quién es quién lo dice el conteo, no el texto del error.
 *
 * Los avisos DURABLES no necesitan esta distinción: derivan del estado y listan
 * exactamente los que quedaron varados, así que no pueden mentir por más
 * créditos que haya.
 */

/** Ninguno se liberó: `ok: false` con `reverted === 0`. */
export const VOID_REFERRAL_REVERT_WARNING =
  "La factura quedó anulada, pero el crédito de referido que tenía aplicado no " +
  "se pudo liberar: sigue marcado como usado, así que el referidor no lo va a " +
  "poder aprovechar en otra compra. No se arregla desde aquí. El caso queda " +
  "avisado en esta factura y en Fidelización: coordínalo con quien lleva el " +
  "programa de referidos.";

/** Algunos sí se liberaron y otros no: `ok: false` con `reverted > 0`. */
export const VOID_REFERRAL_REVERT_PARTIAL_WARNING =
  "La factura quedó anulada y parte de los créditos de referido se liberó, pero " +
  "no todos: los que quedaron siguen marcados como usados. En esta misma " +
  "factura se listan cuáles son, para que no se revise de más. No se arregla " +
  "desde aquí: coordínalo con quien lleva el programa de referidos, que también " +
  "los ve en Fidelización.";

/** Título del banner, que tiene que acompañar al cuerpo y no contradecirlo. */
export const VOID_REFERRAL_REVERT_TITLE = "El crédito de referido quedó sin liberar";
export const VOID_REFERRAL_REVERT_PARTIAL_TITLE =
  "Parte de los créditos de referido quedó sin liberar";

/**
 * El aviso que corresponde, elegido por cuántos créditos SÍ se liberaron.
 * Llamarla sólo cuando la reversión devolvió `ok: false`.
 */
export function voidReferralRevertWarning(reverted: number): string {
  return reverted > 0
    ? VOID_REFERRAL_REVERT_PARTIAL_WARNING
    : VOID_REFERRAL_REVERT_WARNING;
}

/** El título que acompaña a `voidReferralRevertWarning`, anclado en la constante. */
export function voidReferralRevertTitle(warning: string): string {
  return warning === VOID_REFERRAL_REVERT_PARTIAL_WARNING
    ? VOID_REFERRAL_REVERT_PARTIAL_TITLE
    : VOID_REFERRAL_REVERT_TITLE;
}
