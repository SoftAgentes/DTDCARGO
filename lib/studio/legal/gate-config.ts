/**
 * Config del gate legal AUT-04 (SDD-0054 §3.1 / §3.1-bis · movida acá por
 * SDD-0067 para que /studio/legal pueda MOSTRAR el modo vigente).
 *
 * Vivía como const privada en `app/studio/(app)/facturacion/actions.ts`, pero
 * un módulo `"use server"` solo puede exportar funciones async — por eso el
 * flag vive acá (módulo puro) y Facturación lo importa. Cero cambio de
 * comportamiento.
 */

/**
 * ── FLAG · Gate legal AUT-04: advisory ⇄ bloqueo duro
 *
 * `false` (ADVISORY, modo actual): si un embarque DDP no tiene aceptación T&C
 * vigente, el operador VE el aviso pero PUEDE emitir igual (queda
 * `legal_ack: "override"` en la auditoría).
 *
 * `true` (BLOQUEO DURO): emitir una factura DDP sin aceptación vigente queda
 * PROHIBIDO (la action no muta y no ofrece override; el create-and-emit cae a
 * borrador).
 *
 * Se deja en `false` a propósito al shipear Slice C: el día que se activa el
 * flujo de aceptación NO hay aceptaciones previas en prod (cero adopción) → un
 * bloqueo duro inmediato congelaría TODA factura DDP en vuelo. El FOUNDER lo
 * pone en `true` cuando haya adopción (clientes aceptando por el Portal).
 * Cambiar SOLO esta constante alcanza para el flip — el resto del gate ya está
 * cableado, y el banner de /studio/legal refleja el modo automáticamente.
 */
export const LEGAL_GATE_HARD_BLOCK = false;
