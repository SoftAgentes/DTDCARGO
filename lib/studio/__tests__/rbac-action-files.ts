/**
 * La superficie que el contrato de RBAC recorre — SDD-0500.
 *
 * Vive aparte del contrato para que el inventario de archivos se pueda medir
 * desde un script sin arrancar vitest, y para que «qué archivos» y «qué exige»
 * sean dos decisiones separadas.
 *
 * El escáner viejo abría sólo archivos llamados EXACTAMENTE `actions.ts`, así
 * que los `<algo>-actions.ts` del Studio no los miraba nadie: ahí se coló el
 * borrado sin gate de `tracking/[id]/document-actions.ts` y la variante sin
 * `disabled_at` de SDD-0498.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const STUDIO_APP = join(process.cwd(), "app", "studio", "(app)");

/** Carpetas que no contienen server actions: componentes y pruebas. */
const IGNORADAS: ReadonlySet<string> = new Set(["__tests__", "_components"]);

/** `actions.ts` exacto o `<algo>-actions.ts`. Ambas formas son server actions. */
export function esArchivoDeActions(nombre: string): boolean {
  return nombre === "actions.ts" || nombre.endsWith("-actions.ts");
}

/** Rutas absolutas, ordenadas, de los archivos de actions bajo `dir`. */
export function listarArchivosDeActions(dir: string = STUDIO_APP): string[] {
  const acc: string[] = [];
  const recorrer = (actual: string): void => {
    for (const entry of readdirSync(actual).sort()) {
      const full = join(actual, entry);
      if (statSync(full).isDirectory()) {
        if (IGNORADAS.has(entry)) continue;
        recorrer(full);
      } else if (esArchivoDeActions(entry)) {
        acc.push(full);
      }
    }
  };
  recorrer(dir);
  return acc.sort();
}

/** Ruta relativa a `app/studio/(app)` con "/" — la clave de la ALLOWLIST. */
export function rutaRelativa(file: string, base: string = STUDIO_APP): string {
  return relative(base, file).split(sep).join("/");
}
