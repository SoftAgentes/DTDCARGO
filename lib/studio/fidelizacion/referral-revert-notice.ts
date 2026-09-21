/**
 * SDD-0495 · El aviso de que la reversión del crédito de referido no se completó.
 *
 * ## Por qué vive acá y no al lado de `voidInvoice`
 *
 * `app/studio/(app)/facturacion/actions.ts` es un módulo `"use server"`, y de
 * uno de esos **sólo se pueden exportar funciones async**: un `export const`
 * rompe el build de Next. Medido sobre `main` el 2026-09-20: los **116** módulos
 * del repo que llevan la directiva exportan únicamente `async function`, `type`
 * o `interface` —los dos últimos se borran al compilar—, sin una sola
 * excepción. Y el texto lo necesitan los dos lados —la action que lo devuelve y
 * el banner que lo pinta—, así que tiene que ser importable desde un client
 * component. Un módulo neutro resuelve las dos cosas.
 *
 * ## Por qué son DOS textos y no uno (SDD-0496: cuáles son los dos)
 *
 * Cuando esta SDD se escribió, `revertReferralCreditsForInvoice` recorría los
 * créditos de la factura de a uno, así que `ok: false` con `reverted > 0`
 * significaba «uno se liberó y otro no» y había un texto para ese caso parcial.
 *
 * **La SDD-0496 mató ese caso**: la reversión es ahora UNA transacción
 * (`revert_referral_credits`, migr 0471), todos los créditos o ninguno. El texto
 * parcial se retiró porque ya no podía ocurrir, y dejarlo habría sido peor que
 * no tenerlo: `reverted > 0` con `ok: false` pasó a significar otra cosa, y el
 * aviso parcial habría dicho que hay créditos varados cuando no queda ninguno.
 *
 * Los dos casos de hoy los distingue `failure`, no el conteo:
 *
 *  - **`"revert"`** — no se liberó nada. El crédito sigue pegado a la factura
 *    anulada y el referidor no lo puede usar. Es el que duele al cliente.
 *  - **`"entries"`** — el crédito SÍ volvió y la factura quedó bien; lo que no
 *    se pudo fue anular su asiento contable. No hay crédito varado: hay un
 *    asiento vivo que el mayor no debería tener. Le duele a contabilidad, no al
 *    referidor, y decirle «el crédito quedó sin liberar» sería falso.
 *
 * Los avisos DURABLES no necesitan esta distinción: derivan del estado y listan
 * exactamente los que quedaron varados, así que no pueden mentir por más
 * créditos que haya. Ojo con eso en el caso `"entries"`: el crédito no está
 * varado, así que Fidelización —con razón— no lo va a listar.
 */

import type { ReferralCreditRevertFailure } from "@/lib/studio/accounting/referral-credit-posting";

/** Ninguno se liberó: `ok: false` con `reverted === 0`. */
export const VOID_REFERRAL_REVERT_WARNING =
  "La factura quedó anulada, pero el crédito de referido que tenía aplicado no " +
  "se pudo liberar: sigue marcado como usado, así que el referidor no lo va a " +
  "poder aprovechar en otra compra. No se arregla desde aquí. El caso queda " +
  "avisado en esta factura y en Fidelización: coordínalo con quien lleva el " +
  "programa de referidos.";

/**
 * El crédito volvió al referidor y la factura quedó bien; lo que no se pudo fue
 * anular su asiento: `ok: false` con `failure === "entries"` (SDD-0496).
 */
export const VOID_REFERRAL_REVERT_ENTRY_WARNING =
  "La factura quedó anulada y el crédito de referido volvió a estar disponible " +
  "para el referidor, así que por ese lado no falta nada. Lo que no se pudo fue " +
  "anular el asiento contable de ese crédito: quedó vivo en el mayor, que ahora " +
  "no cuadra con la factura. No se arregla desde aquí: pásaselo a contabilidad " +
  "con el código de esta factura.";

/** Título del banner, que tiene que acompañar al cuerpo y no contradecirlo. */
export const VOID_REFERRAL_REVERT_TITLE = "El crédito de referido quedó sin liberar";
export const VOID_REFERRAL_REVERT_ENTRY_TITLE =
  "El asiento del crédito quedó sin anular";

/**
 * El aviso que corresponde, elegido por QUÉ falló. Llamarla sólo cuando la
 * reversión devolvió `ok: false`.
 *
 * SDD-0496: antes elegía por `reverted`, y ese criterio dejó de servir cuando la
 * reversión pasó a ser una sola transacción. Hoy `reverted > 0` con `ok: false`
 * significa que la plata SÍ volvió, que es justo lo contrario de lo que el aviso
 * parcial decía.
 */
export function voidReferralRevertWarning(failure?: ReferralCreditRevertFailure): string {
  return failure === "entries"
    ? VOID_REFERRAL_REVERT_ENTRY_WARNING
    : VOID_REFERRAL_REVERT_WARNING;
}

/** El título que acompaña a `voidReferralRevertWarning`, anclado en la constante. */
export function voidReferralRevertTitle(warning: string): string {
  return warning === VOID_REFERRAL_REVERT_ENTRY_WARNING
    ? VOID_REFERRAL_REVERT_ENTRY_TITLE
    : VOID_REFERRAL_REVERT_TITLE;
}
