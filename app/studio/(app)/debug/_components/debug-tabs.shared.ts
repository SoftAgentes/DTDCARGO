/**
 * Helpers puros + tipos de las pestañas de la Torre de control (SDD-0050).
 *
 * **Server-safe: SIN `"use client"`.** El `page.tsx` (server component) resuelve
 * la pestaña activa (`resolveDebugTab`) durante el render del server, y el
 * `DebugTabs.tsx` (client) reusa estos mismos tipos/const/helpers. Mantenerlos
 * acá —y no dentro del módulo `"use client"`— evita el error de Next
 * "Attempted to call a client function from the server".
 */

export type DebugTabKey = "estado" | "bugs" | "norte" | "radar" | "searates";

export type DebugTabMode = "vivo" | "snapshot" | "local";

export const DEBUG_TABS: ReadonlyArray<{
  key: DebugTabKey;
  label: string;
  /** Modo de la pestaña — declara qué tan "vivo" está su contenido en la web. */
  mode: DebugTabMode;
  modeLabel: string;
}> = [
  { key: "estado", label: "Estado", mode: "vivo", modeLabel: "vivo" },
  { key: "bugs", label: "Bugs", mode: "vivo", modeLabel: "vivo" },
  { key: "norte", label: "Norte", mode: "snapshot", modeLabel: "snapshot" },
  { key: "radar", label: "Radar", mode: "local", modeLabel: "solo local" },
  // SDD-0092 · panel de prueba de SeaRates (fletes · benchmark interno).
  // Pega al endpoint admin /api/studio/searates/probe en vivo.
  { key: "searates", label: "SeaRates", mode: "vivo", modeLabel: "vivo" },
];

/**
 * Color del dot que indica el modo de la pestaña. Reemplaza al glyph de emoji
 * (🟢/🟡/⚪) que usa la spec para describir los modos: el sistema del Studio usa
 * dots de color tokenizados, no emojis decorativos (regla de marca C5). El
 * mapping semántico se mantiene: vivo→verde, snapshot→ámbar, local→neutral.
 */
export function modeDotColor(mode: DebugTabMode): string {
  if (mode === "vivo") return "var(--success)";
  if (mode === "snapshot") return "var(--warning)";
  return "var(--ink-mute)";
}

export function isDebugTab(v: string | undefined | null): v is DebugTabKey {
  return (
    v === "estado" ||
    v === "bugs" ||
    v === "norte" ||
    v === "radar" ||
    v === "searates"
  );
}

export function resolveDebugTab(raw: string | undefined | null): DebugTabKey {
  return isDebugTab(raw) ? raw : "estado";
}
