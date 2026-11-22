/**
 * SDD-0626 §3.3 y Paso 3b (pendiente D del 3a) · ¿La conversación habla de dinero?
 *
 * La regla del cable es «dinero = prioridad 3 y escalado»: un cobro, un pago, una tarifa o un reembolso no lo
 * redacta el agente, lo ve una persona. En la prueba E del 3a el agente contestó un cobro con el guion
 * `derivar-equipo` y prioridad 2; por eso la regla ya no depende del modelo: el despachador la aplica ANTES de
 * llamar al agente, y entonces el texto del cliente ni siquiera sale hacia el proveedor del modelo.
 *
 * Mira solo los mensajes del CLIENTE, en memoria, sobre el texto normalizado (minúsculas y sin tildes).
 * Conservador a propósito: ante la duda, escala. «DTD Cargo» no cuenta como «cargo».
 */
import type { MensajeLeido } from "./chatwoot-lectura";

function normal(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/dtd\s*cargo/g, "dtd")
    .replace(/\s+/g, " ");
}

const DINERO: readonly RegExp[] = [
  /\bcobr(?:o|os|a|an|ar|aron|ado|ada|ados|aste|amos|en|ando)\b/,
  /\bpag(?:o|os|a|an|ar|ue|uen|aron|ado|ada|ados|amos|ando|aste)\b/,
  /\bfactur\w*/,
  /\breembols\w*/,
  /\bdevol(?:ver|veran|ucion|uciones|vieron|vio)\b/,
  /\bdinero\b/,
  /\bmontos?\b/,
  /\btarifas?\b/,
  /\bprecios?\b/,
  /\bcuest(?:a|an)\b/,
  /\bcuanto (?:vale|valen|sale|salen|es|son|me cobran|cobran)\b/,
  /\btransferencias?\b/,
  /\bzelle\b/,
  /\bpago ?movil\b/,
  /\bbolivares?\b|\bbs\.?(?=\s|$|\d)/,
  /\bdolares?\b|\busd\b|\$/,
  /\beuros?\b/,
  /\bcargos?\b/,
  /\bsaldo\b/,
  /\bdeuda\b/,
  /\bcomision(?:es)?\b/,
  /\bdescuentos?\b/,
];

export function hablaDeDinero(mensajes: readonly MensajeLeido[]): boolean {
  return mensajes.some((m) => m.rol === "cliente" && DINERO.some((p) => p.test(normal(m.texto))));
}
