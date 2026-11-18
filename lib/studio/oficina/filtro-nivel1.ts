/**
 * SDD-0626 §3.3 · Filtro nivel 1 (0 tokens, sin modelo): la prioridad.
 *
 * Prioridad dinero (3) > cliente (2) > interno (1). Se decide AL RECIBIR el evento, porque ahí están
 * las etiquetas de la conversación y el payload no se guarda (R5). Con etiquetas de Chatwoot o con
 * reglas simples configurables. Si no está claro, va como cliente (2): ante la duda, un cliente.
 *
 * Qué pasa DESPUÉS lo hace la base, no este archivo:
 *   · Dedupe: `event_inbox.clave_dedupe` es única (0541). La misma clave no entra dos veces, ni dentro
 *     de 30 min ni después: es más fuerte que la ventana de 30 min de §3.3 y no tiene carreras.
 *   · Cuota: `office_filtrar_bandeja()` (0544) pasa a «triaje» como máximo 20 por hora, primero dinero,
 *     luego cliente, luego interno. Lo que no cabe se queda en «nuevo»: la cuota no descarta nada.
 *   · Pausa: con `office_esta_pausada()` en verdadero esa función no mueve nada.
 */

export type Prioridad = 3 | 2 | 1;

export const PRIORIDAD_DINERO: Prioridad = 3;
export const PRIORIDAD_CLIENTE: Prioridad = 2;
export const PRIORIDAD_INTERNO: Prioridad = 1;

/** Los pasos a «triaje» por hora (§3.3). Es el valor por defecto de `office_filtrar_bandeja()`. */
export const CUOTA_TRIAJE_POR_HORA = 20;

export const ETIQUETAS_DINERO_POR_DEFECTO = ["dinero", "pago", "cobro", "cobranza", "factura", "reembolso"] as const;
export const ETIQUETAS_INTERNO_POR_DEFECTO = ["interno", "prueba"] as const;

export interface ReglasPrioridad {
  dinero: readonly string[];
  interno: readonly string[];
}

const normalizar = (s: string) => s.trim().toLowerCase();

/** «a, b ,,c» → ["a", "b", "c"]; vacío o ausente → null. */
function lista(valor: string | undefined | null): string[] | null {
  if (typeof valor !== "string") return null;
  const items = valor.split(",").map(normalizar).filter(Boolean);
  return items.length > 0 ? items : null;
}

export function reglasDeEntorno(dinero: string | undefined, interno: string | undefined): ReglasPrioridad {
  return {
    dinero: lista(dinero) ?? ETIQUETAS_DINERO_POR_DEFECTO,
    interno: lista(interno) ?? ETIQUETAS_INTERNO_POR_DEFECTO,
  };
}

/**
 * La prioridad de un evento por las etiquetas de su conversación. Dinero le gana a todo (un cobro
 * dentro de una conversación interna sigue siendo dinero); sin etiqueta que lo aclare, cliente.
 */
export function prioridadDelEvento(etiquetas: readonly string[] | undefined, reglas: ReglasPrioridad): Prioridad {
  const vistas = new Set((etiquetas ?? []).map(normalizar));
  if (reglas.dinero.some((e) => vistas.has(normalizar(e)))) return PRIORIDAD_DINERO;
  if (reglas.interno.some((e) => vistas.has(normalizar(e)))) return PRIORIDAD_INTERNO;
  return PRIORIDAD_CLIENTE;
}
