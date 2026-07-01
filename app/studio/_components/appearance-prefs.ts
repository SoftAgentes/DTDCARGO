/**
 * Preferencias de apariencia del Studio (SDD-0120, sección Apariencia).
 *
 * Fuente única de las claves + lógica de aplicar/leer theme y densidad, para
 * que el toggle del topbar (sol/luna) y la sección Apariencia del admin no
 * diverjan. Persistencia por-usuario en localStorage (mismo patrón que el
 * theme existente); se re-aplican en el primer paint vía el script anti-FOUC
 * del layout.
 *
 * `applyTheme`/`applyDensity` disparan un `CustomEvent` en `window` para que
 * cualquier control montado (topbar) refleje el cambio en vivo sin recargar.
 *
 * Client-only de facto (usa `localStorage` / `document` / `window`); llamar
 * solo desde componentes "use client" o dentro de effects/handlers.
 */

export const THEME_KEY = "studio_theme";
export const DENSITY_KEY = "studio_density";
export const APPEARANCE_EVENT = "studio:appearance";

export type StudioTheme = "light" | "dark";
export type StudioDensity = "compact" | "normal" | "spacious";

export interface AppearanceDetail {
  theme?: StudioTheme;
  density?: StudioDensity;
}

export function readTheme(): StudioTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function readDensity(): StudioDensity {
  try {
    const d = localStorage.getItem(DENSITY_KEY);
    return d === "compact" || d === "spacious" ? d : "normal";
  } catch {
    return "normal";
  }
}

export function applyTheme(next: StudioTheme): void {
  try {
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
    localStorage.setItem(THEME_KEY, next);
    window.dispatchEvent(
      new CustomEvent<AppearanceDetail>(APPEARANCE_EVENT, { detail: { theme: next } }),
    );
  } catch {
    // ignore (SSR / storage bloqueado)
  }
}

export function applyDensity(next: StudioDensity): void {
  try {
    if (next === "normal") delete document.documentElement.dataset.density;
    else document.documentElement.dataset.density = next;
    localStorage.setItem(DENSITY_KEY, next);
    window.dispatchEvent(
      new CustomEvent<AppearanceDetail>(APPEARANCE_EVENT, { detail: { density: next } }),
    );
  } catch {
    // ignore
  }
}
