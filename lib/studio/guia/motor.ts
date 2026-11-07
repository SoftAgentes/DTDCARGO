/**
 * lib/studio/guia/motor.ts · Navegación de la guía sin DOM (SDD-0589).
 *
 * El motor no guarda qué anclas existen: las consulta en cada movimiento con
 * `existe(ancla)`, porque la pantalla cambia (un KPI apagado, un panel que
 * carga tarde). Un paso cuya ancla no está se salta; si no queda ninguno, el
 * recorrido no abre. Nada de esto lanza errores.
 *
 * 9.4: un paso con `respaldo` sigue presente mientras esté su ancla o la de
 * respaldo (las anclas de Chatwoot caen al marco de la Bandeja).
 */

import type { GuiaPaso } from "./tipos";

export type ExisteAncla = (ancla: string) => boolean;

/** El paso tiene dónde ponerse: su ancla o, si falta, su respaldo. */
export function pasoPresente(paso: GuiaPaso, existe: ExisteAncla): boolean {
  return existe(paso.ancla) || (paso.respaldo !== undefined && existe(paso.respaldo));
}

/** Ancla donde va la tarjeta del paso: la suya, la de respaldo o `null`. */
export function anclaEfectiva(paso: GuiaPaso, existe: ExisteAncla): string | null {
  if (existe(paso.ancla)) return paso.ancla;
  if (paso.respaldo !== undefined && existe(paso.respaldo)) return paso.respaldo;
  return null;
}

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
    if (pasoPresente(pasos[i], existe)) return i;
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
    if (pasoPresente(pasos[i], existe)) return i;
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
    const cuenta = i === actual || pasoPresente(paso, existe);
    if (!cuenta) return;
    total += 1;
    if (i <= actual) n += 1;
  });
  return { n, total };
}
