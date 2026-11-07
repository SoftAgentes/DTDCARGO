/** Tipos de `smoke-guia-nucleo.mjs` (SDD-0589, 9.4), para las pruebas en TypeScript. */

export interface ResultadoAncla {
  ancla: string;
  obligatoria: boolean;
  condicion: string;
  encontrada: boolean;
  selector: string | null;
}

export interface ArchivoSelectoresSmoke {
  version: string;
  anclas: Record<string, { css: readonly string[]; cerca?: string; obligatoria: boolean; condicion: string }>;
}

export function resolverAnclas(archivo: ArchivoSelectoresSmoke, doc?: Document): ResultadoAncla[];

export function resumir(resultados: ResultadoAncla[]): {
  ok: boolean;
  faltanObligatorias: string[];
  faltanCondicionales: string[];
};

export function formatear(resultados: ResultadoAncla[], version: string): string;
