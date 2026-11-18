import "server-only";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { pareceSecreto, rutaExcluida, type ArchivoFuente } from "./analisis";

/**
 * La superficie propia de DTD que viaja en el paquete de «Analizar con IA»
 * (SDD-0588, paso 3.4). Se lee del disco en cada análisis, así sigue al código.
 *
 * Solo estas fuentes, sin recorrer subcarpetas: nada de `infra/chatwoot/.env*`,
 * `secretos/`, `pruebas/` ni de los `__tests__`. Cada archivo pasa además por
 * `rutaExcluida` y `pareceSecreto`. En producción los archivos viajan en el bundle
 * por `outputFileTracingIncludes` de `next.config.ts` (ruta de Actualizaciones).
 *
 * De `lib/studio/chatwoot` no se manda el código entero: solo un índice de las
 * rutas de la API de Chatwoot que usa Studio (`archivo:línea` y la línea).
 */
export const FUENTES_SUPERFICIE: readonly { carpeta: string; extensiones: readonly string[]; modo: "entero" | "indice" }[] = [
  { carpeta: "infra/chatwoot/rails", extensiones: [".rb"], modo: "entero" },
  { carpeta: "infra/chatwoot", extensiones: ["compose.yml"], modo: "entero" },
  { carpeta: "infra/chatwoot/panel", extensiones: [".html"], modo: "entero" },
  { carpeta: "lib/studio/chatwoot", extensiones: [".ts"], modo: "indice" },
];

const RUTA_API = /["'`][^"'`]*\/(?:platform\/)?api\/v1\/[^"'`]*["'`]/;
export const RUTA_INDICE = "lib/studio/chatwoot (índice de rutas de Chatwoot)";

function archivosDe(raiz: string, carpeta: string, extensiones: readonly string[]): string[] {
  let nombres: string[];
  try {
    nombres = readdirSync(join(raiz, carpeta));
  } catch {
    return [];
  }
  return nombres
    .filter((n) => extensiones.some((e) => n.endsWith(e)))
    .map((n) => `${carpeta}/${n}`)
    .filter((ruta) => {
      try {
        return statSync(join(raiz, ruta)).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Lee la superficie. `excluidos` dice qué se dejó afuera y por qué; un archivo que no
 * se puede leer simplemente no está (en un bundle sin el trazado, la lista sale vacía).
 */
export function leerSuperficieDtd(raiz: string = process.cwd()): { archivos: ArchivoFuente[]; excluidos: { ruta: string; motivo: "ruta" | "secreto" }[] } {
  const archivos: ArchivoFuente[] = [];
  const excluidos: { ruta: string; motivo: "ruta" | "secreto" }[] = [];
  const indice: string[] = [];

  for (const fuente of FUENTES_SUPERFICIE) {
    for (const ruta of archivosDe(raiz, fuente.carpeta, fuente.extensiones)) {
      if (rutaExcluida(ruta)) {
        excluidos.push({ ruta, motivo: "ruta" });
        continue;
      }
      let contenido: string;
      try {
        contenido = readFileSync(join(raiz, ruta), "utf8").replace(/\r\n/g, "\n");
      } catch {
        continue;
      }
      if (pareceSecreto(contenido)) {
        excluidos.push({ ruta, motivo: "secreto" });
        continue;
      }
      if (fuente.modo === "entero") {
        archivos.push({ ruta, contenido });
        continue;
      }
      contenido.split("\n").forEach((linea, i) => {
        if (RUTA_API.test(linea)) indice.push(`${ruta}:${i + 1}  ${linea.trim()}`);
      });
    }
  }
  if (indice.length) archivos.push({ ruta: RUTA_INDICE, contenido: indice.join("\n") });
  return { archivos, excluidos };
}
