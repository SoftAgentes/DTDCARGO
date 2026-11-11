/**
 * Resolver de pestañas del Tablero CRM (SDD-0078). **Server-safe (sin
 * "use client")**: el `page.tsx` (server) resuelve la pestaña activa durante el
 * render y el `KommoClient` (client) reusa estos tipos/helpers — igual que
 * `debug-tabs.shared.ts` de la Torre de control (SDD-0050).
 *
 * **SDD-0614 · S0 (D-6.6-1):** las pestañas que leen el espejo de Kommo están
 * ocultas del Studio hasta la migración completa. No se muestran en la barra y
 * su `?tab=` abre la pestaña por defecto. Ocultar no es borrar: su código sigue
 * y se retira en 8.7, con su OK aparte.
 */

/** `embudos` = tablero del CRM propio (SDD-0587 · 6.3); las demás leen el espejo de Kommo. */
export type KommoTabKey = "direccion" | "tablero" | "asesor" | "recuperacion" | "embudos";

export function isKommoTab(v: string | undefined | null): v is KommoTabKey {
  return (
    v === "direccion" ||
    v === "tablero" ||
    v === "asesor" ||
    v === "recuperacion" ||
    v === "embudos"
  );
}

/** Pestañas del espejo de Kommo, ocultas desde S0 (SDD-0614, D-6.6-1). */
export const KOMMO_TABS_OCULTAS: ReadonlySet<KommoTabKey> = new Set<KommoTabKey>([
  "direccion",
  "tablero",
  "asesor",
  "recuperacion",
]);

/**
 * Pestaña por defecto = Embudos mientras no exista Resumen (SDD-0614 S3). Es la
 * pestaña donde están las anclas `embudo.*` del recorrido de la guía (P-10).
 */
export const CRM_TAB_POR_DEFECTO: KommoTabKey = "embudos";

/** Una pestaña oculta, o un valor que no es pestaña, abre la pestaña por defecto. */
export function resolveKommoTab(raw: string | undefined | null): KommoTabKey {
  return isKommoTab(raw) && !KOMMO_TABS_OCULTAS.has(raw) ? raw : CRM_TAB_POR_DEFECTO;
}

const TODAS_LAS_PESTANAS: ReadonlyArray<{ key: KommoTabKey; label: string }> = [
  { key: "direccion", label: "Dirección" },
  { key: "tablero", label: "Tablero" },
  { key: "asesor", label: "Asesor" },
  { key: "recuperacion", label: "Recuperación" },
  { key: "embudos", label: "Embudos" },
];

/** Las pestañas que se ven en la barra: sin las de Kommo (SDD-0614 S0). */
export const KOMMO_TABS: ReadonlyArray<{ key: KommoTabKey; label: string }> =
  TODAS_LAS_PESTANAS.filter((t) => !KOMMO_TABS_OCULTAS.has(t.key));
