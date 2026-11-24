/**
 * Vista y tema de la cuenta (SDD-0714).
 *
 * Forma de `user_metadata.studio_apariencia` y su lectura defensiva. Sin
 * dependencias de navegador: la usan el layout (servidor), la acción que guarda y
 * los controles del cliente.
 */

import { isDensity, isThemePref, type StudioDensity, type StudioThemePref } from "./appearance-prefs";

export const APARIENCIA_METADATA_KEY = "studio_apariencia";

export interface AparienciaGuardada {
  vista: StudioDensity;
  tema: StudioThemePref;
}

/** Lee lo guardado; si falta un campo o no está en el catálogo, devuelve null. */
export function parseAparienciaGuardada(v: unknown): AparienciaGuardada | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isDensity(o.vista) || !isThemePref(o.tema)) return null;
  return { vista: o.vista, tema: o.tema };
}

/** Lo guardado en el `user_metadata` de la cuenta, o null si no hay nada válido. */
export function aparienciaDeMetadata(metadata: unknown): AparienciaGuardada | null {
  if (!metadata || typeof metadata !== "object") return null;
  return parseAparienciaGuardada((metadata as Record<string, unknown>)[APARIENCIA_METADATA_KEY]);
}
