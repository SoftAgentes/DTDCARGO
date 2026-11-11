/**
 * Costo de referencia de un chat (SDD-0585, paso 2.8). Puro.
 *
 * Sam, 2026-10-30: «Sí, hacerlo (Recomendado)», a mostrar en la Ficha DTD un costo
 * estimado: mensajes enviados × tarifa de Meta.
 *
 *  - **Mercado:** sale del prefijo del teléfono del contacto (el destinatario), con la
 *    tabla oficial de Meta (`tarifas-meta-2026-10.ts`). Lo que no calza es «Other».
 *  - **Tarifa:** la de servicio (mensaje libre dentro de la ventana de 24 h), que Meta
 *    cobra desde el 2026-10-01.
 *  - **Es informativo.** No descuenta los 1.000 mensajes gratis del mes por número ni
 *    distingue las plantillas, que Meta cobra con su propia categoría: la Ficha lo dice.
 *
 * El teléfono entra solo para elegir el mercado y no sale de aquí: el resultado lleva
 * el nombre del mercado, nunca el número.
 */

import { FUENTE_TARIFA, PREFIJOS, TARIFAS } from "./tarifas-meta-2026-10";

export const MERCADO_OTRO = "Other";

/** Mercado del tarifario para un teléfono, o null si no hay teléfono utilizable. */
export function mercadoDe(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  // Un E.164 tiene de 8 a 15 dígitos; sin «+» no se sabe dónde empieza el código de país.
  if (!(telefono ?? "").trim().startsWith("+") || digitos.length < 8 || digitos.length > 15) return null;
  for (const [prefijo, mercado] of PREFIJOS) {
    if (digitos.startsWith(prefijo)) return mercado;
  }
  return MERCADO_OTRO;
}

export interface CostoChat {
  enviados: number;
  /** false: la conversación tiene más mensajes de los que se leyeron; el costo es un piso. */
  completo: boolean;
  mercado: string;
  tarifa: number;
  total: number;
  vigenteDesde: string;
  fuente: string;
}

/**
 * El costo, o null si no se puede saber el mercado (sin teléfono en E.164). Redondea el
 * total a 4 decimales, como la tarifa, para no inventar precisión.
 */
export function estimarCosto(entrada: { enviados: number; completo: boolean; telefono: string | null }): CostoChat | null {
  const mercado = mercadoDe(entrada.telefono);
  if (mercado === null) return null;
  const tarifa = (TARIFAS[mercado] ?? TARIFAS[MERCADO_OTRO]).service;
  const enviados = Math.max(0, Math.floor(entrada.enviados));
  return {
    enviados,
    completo: entrada.completo,
    mercado,
    tarifa,
    total: Math.round(enviados * tarifa * 10_000) / 10_000,
    vigenteDesde: FUENTE_TARIFA.vigenteDesde,
    fuente: FUENTE_TARIFA.url,
  };
}
