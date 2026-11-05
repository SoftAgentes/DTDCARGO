/**
 * lib/studio/guia/motor.ts · Navegación de la guía sin DOM (SDD-0589).
 *
 * El motor no guarda qué anclas existen: las consulta en cada movimiento con
 * `existe(ancla)`, porque la pantalla cambia (un KPI apagado, un panel que
 * carga tarde). Un paso cuya ancla no está se salta; si no queda ninguno, el
 * recorrido no abre. Nada de esto lanza errores.
 */

import type { GuiaPaso } from "./tipos";

export type ExisteAncla = (ancla: string) => boolean;

/** Índice del primer paso con ancla presente, o `null`. */
export function primerPaso(
  pasos: readonly GuiaPaso[],
  existe: ExisteAncla,
): number | null {
  return pasoSiguiente(pasos, -1, existe);
}

/** Índice del próximo paso con ancla presente después de `desde`, o `null`. */
export function pasoSiguiente(
  pasos: readonly GuiaPaso[],
  desde: number,
  existe: ExisteAncla,
): number | null {
  for (let i = Math.max(-1, desde) + 1; i < pasos.length; i++) {
    if (existe(pasos[i].ancla)) return i;
  }
  return null;
}

/** Índice del paso anterior con ancla presente antes de `desde`, o `null`. */
export function pasoAnterior(
  pasos: readonly GuiaPaso[],
  desde: number,
  existe: ExisteAncla,
): number | null {
  for (let i = Math.min(pasos.length, desde) - 1; i >= 0; i--) {
    if (existe(pasos[i].ancla)) return i;
  }
  return null;
}

/**
 * Posición visible del paso actual: `n` de `total`, contando solo los pasos
 * con ancla presente. Si el ancla del actual desapareció, el actual se cuenta
 * igual para que el contador no salte mientras la tarjeta sigue abierta.
 */
export function contador(
  pasos: readonly GuiaPaso[],
  actual: number,
  existe: ExisteAncla,
): { n: number; total: number } {
  let n = 0;
  let total = 0;
  pasos.forEach((paso, i) => {
    const cuenta = i === actual || existe(paso.ancla);
    if (!cuenta) return;
    total += 1;
    if (i <= actual) n += 1;
  });
  return { n, total };
}
