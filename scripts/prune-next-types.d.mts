/**
 * SDD-0281 · Tipos de `prune-next-types.mjs`.
 *
 * El script es `.mjs` porque lo invocan `verify.mjs`, `check-build.mjs` y
 * `package.json` sin pasar por el transpilador — pero su test corre en Vitest y
 * `tsc` no infiere tipos de un `.mjs` suelto (TS7016). Mismo patrón que los
 * `build-sdd-*.d.mts` del resto de `scripts/`.
 */

export interface HallazgoDePoda {
  /** Ruta relativa del árbol de tipos, p.ej. `.next/types`. */
  arbol: string;
  /** La primera referencia muerta que se encontró en ese árbol. */
  apuntaA: string;
}

export interface ResultadoDePoda {
  /** Árboles efectivamente borrados. Vacío con `soloReportar`. */
  podados: string[];
  hallazgos: HallazgoDePoda[];
}

export function podarTiposDeRuta(opciones?: {
  raiz?: string;
  soloReportar?: boolean;
}): ResultadoDePoda;

/** Una línea para el gate, o `null` si no hubo nada que podar. */
export function notaDePoda(resultado: ResultadoDePoda): string | null;
