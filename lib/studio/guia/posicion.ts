/**
 * lib/studio/guia/posicion.ts · Dónde va la tarjeta de la guía (SDD-0589).
 *
 * Cálculo puro: recibe el rectángulo del ancla, el tamaño de la tarjeta y el
 * del viewport, y devuelve `top`/`left` fijos. Prefiere debajo del ancla,
 * luego arriba, luego a la derecha y a la izquierda. Si no cabe en ningún
 * lado (o no hay ancla), queda «libre» en la esquina inferior derecha, sin
 * tapar el ancla más de lo inevitable. Nunca se sale del viewport.
 */

export interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type Lado = "abajo" | "arriba" | "derecha" | "izquierda" | "libre";

export interface Colocacion {
  top: number;
  left: number;
  lado: Lado;
}

/** Margen al borde del viewport (= --s-4). */
export const MARGEN = 16;
/** Separación entre el ancla y la tarjeta (= --s-3). */
export const SEPARACION = 12;

function acotar(valor: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(valor, min), max);
}

export function colocarTarjeta(
  ancla: Caja | null,
  tarjeta: { width: number; height: number },
  viewport: { width: number; height: number },
): Colocacion {
  const maxLeft = viewport.width - tarjeta.width - MARGEN;
  const maxTop = viewport.height - tarjeta.height - MARGEN;

  const libre: Colocacion = {
    top: acotar(maxTop, MARGEN, maxTop),
    left: acotar(maxLeft, MARGEN, maxLeft),
    lado: "libre",
  };
  if (!ancla) return libre;

  const abajo = ancla.top + ancla.height + SEPARACION;
  const arriba = ancla.top - SEPARACION - tarjeta.height;
  const derecha = ancla.left + ancla.width + SEPARACION;
  const izquierda = ancla.left - SEPARACION - tarjeta.width;
  const leftAlineado = acotar(ancla.left, MARGEN, maxLeft);
  const topAlineado = acotar(ancla.top, MARGEN, maxTop);

  if (abajo + tarjeta.height <= viewport.height - MARGEN) {
    return { top: abajo, left: leftAlineado, lado: "abajo" };
  }
  if (arriba >= MARGEN) {
    return { top: arriba, left: leftAlineado, lado: "arriba" };
  }
  if (derecha + tarjeta.width <= viewport.width - MARGEN) {
    return { top: topAlineado, left: derecha, lado: "derecha" };
  }
  if (izquierda >= MARGEN) {
    return { top: topAlineado, left: izquierda, lado: "izquierda" };
  }
  return libre;
}
