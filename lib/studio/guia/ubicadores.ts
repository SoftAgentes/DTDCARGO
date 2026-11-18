/**
 * lib/studio/guia/ubicadores.ts · Anclas fuera del DOM de Studio (SDD-0589, 9.4, D10).
 *
 * El motor busca cada ancla en su propio DOM (`data-guia`). Las que viven en otro
 * documento, como el panel de Chatwoot dentro del marco de la Bandeja, las responde
 * un *ubicador*: quien tiene el marco lo registra y avisa cuando sus cajas cambian.
 * El motor no sabe de Chatwoot; solo pregunta.
 *
 * Es un almacén mínimo fuera de React, como el de «guía abierta» del motor.
 */

import type { Caja } from "./posicion";

export interface GuiaUbicador {
  /**
   * Caja del ancla en coordenadas de la página de Studio. `null`: la tiene, pero
   * fuera de la vista (el motor le pide `mostrar`). `undefined`: no la tiene.
   */
  caja(ancla: string): Caja | null | undefined;
  /** Lleva el ancla a la vista dentro de su documento. */
  mostrar?(ancla: string, opciones: { suave: boolean }): void;
}

const ubicadores = new Set<GuiaUbicador>();
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const fn of oyentes) fn();
}

/** Registra un ubicador; devuelve la función que lo quita. */
export function registrarUbicador(ubicador: GuiaUbicador): () => void {
  ubicadores.add(ubicador);
  avisar();
  return () => {
    if (ubicadores.delete(ubicador)) avisar();
  };
}

/** El ubicador avisa que sus cajas cambiaron: el motor vuelve a medir. */
export function avisarCambioUbicadores(): void {
  avisar();
}

/** El motor se suscribe a los cambios; devuelve la función que lo da de baja. */
export function suscribirUbicadores(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * Primer ubicador que tiene el ancla, con su caja (`null` si está fuera de la
 * vista). `null` si ninguno la tiene. Nunca lanza.
 */
export function ubicarRemota(ancla: string): { caja: Caja | null; ubicador: GuiaUbicador } | null {
  for (const ubicador of ubicadores) {
    let caja: Caja | null | undefined;
    try {
      caja = ubicador.caja(ancla);
    } catch {
      caja = undefined;
    }
    if (caja !== undefined) return { caja, ubicador };
  }
  return null;
}
