/**
 * Resolver de pestañas del Tablero CRM (SDD-0078). **Server-safe (sin
 * "use client")**: el `page.tsx` (server) resuelve la pestaña activa durante el
 * render y el `KommoClient` (client) reusa estos tipos/helpers — igual que
 * `debug-tabs.shared.ts` de la Torre de control (SDD-0050).
 */

export type KommoTabKey = "direccion" | "tablero" | "asesor";

export function isKommoTab(v: string | undefined | null): v is KommoTabKey {
  return v === "direccion" || v === "tablero" || v === "asesor";
}

/** Pestaña por defecto = Dirección (la foto del founder). */
export function resolveKommoTab(raw: string | undefined | null): KommoTabKey {
  return isKommoTab(raw) ? raw : "direccion";
}

export const KOMMO_TABS: ReadonlyArray<{ key: KommoTabKey; label: string }> = [
  { key: "direccion", label: "Dirección" },
  { key: "tablero", label: "Tablero" },
  { key: "asesor", label: "Asesor" },
];
