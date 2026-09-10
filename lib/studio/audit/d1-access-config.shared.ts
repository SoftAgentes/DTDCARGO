/**
 * Largo mínimo de un motivo para que cuente como motivo. Por debajo de esto
 * `d1Reason` cae al texto por defecto.
 *
 * Este módulo es deliberadamente puro y compartido entre servidor y cliente.
 * No debe importar el adapter D1 ni APIs de Node: hacerlo volvería a meter
 * `node:crypto` en el grafo del navegador sólo para transportar este número.
 */
export const D1_REASON_MIN_LENGTH = 8;
