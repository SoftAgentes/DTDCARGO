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
 * SDD-0714: el tema admite Automático (sigue al sistema) y los dos valores se
 * guardan además en la cuenta (`user_metadata.studio_apariencia`); localStorage
 * queda como respaldo local para que no parpadee al cargar.
 *
 * Predeterminados: oscuro y compacto (BD-037, SDD-0603). Quien ya eligió otra cosa
 * la conserva. Tienen que coincidir con el script de `app/studio/layout.tsx`.
 *
 * Client-only de facto (usa `localStorage` / `document` / `window`); llamar
 * solo desde componentes "use client" o dentro de effects/handlers.
 */

export const THEME_KEY = "studio_theme";
export const DENSITY_KEY = "studio_density";
export const APPEARANCE_EVENT = "studio:appearance";

/** Tema que se pinta: el atributo `data-theme` solo conoce estos dos. */
export type StudioTheme = "light" | "dark";
/**
 * Lo que la persona elige (SDD-0714): Claro, Oscuro o Automático, que sigue al
 * sistema (`prefers-color-scheme`). Se guarda tal cual; se pinta con `resolveTheme`.
 */
export type StudioThemePref = StudioTheme | "auto";
/**
 * Las tres vistas (SDD-0688 §11.5): Normal, Compacta (la de por defecto) y Súper
 * compacta. «Amplia» (`spacious`) se retiró: quien la tenía guardada pasa a Normal.
 */
export type StudioDensity = "compact" | "normal" | "ultra";

export const DENSITY_LABEL: Record<StudioDensity, string> = {
  normal: "Normal",
  compact: "Compacta",
  ultra: "Súper compacta",
};

export const THEME_LABEL: Record<StudioThemePref, string> = {
  light: "Claro",
  dark: "Oscuro",
  auto: "Automático",
};

export const DEFAULT_THEME: StudioTheme = "dark";
export const DEFAULT_DENSITY: StudioDensity = "compact";

export interface AppearanceDetail {
  theme?: StudioThemePref;
  density?: StudioDensity;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePref(v: unknown): v is StudioThemePref {
  return v === "light" || v === "dark" || v === "auto";
}

export function isDensity(v: unknown): v is StudioDensity {
  return v === "normal" || v === "compact" || v === "ultra";
}

/** ¿El sistema pide oscuro? Sin `matchMedia` (pruebas, SSR) se toma el predeterminado. */
export function systemPrefersDark(): boolean {
  try {
    if (typeof window.matchMedia !== "function") return DEFAULT_THEME === "dark";
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return DEFAULT_THEME === "dark";
  }
}

export function resolveTheme(pref: StudioThemePref): StudioTheme {
  if (pref === "auto") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

/** Lo elegido (Claro, Oscuro o Automático). Sin elección: el predeterminado. */
export function readThemePref(): StudioThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "auto") return t;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Lo que se pinta ahora (Automático ya resuelto). */
export function readTheme(): StudioTheme {
  return resolveTheme(readThemePref());
}

/** ¿Este navegador tiene una elección explícita guardada? (para subirla a la cuenta, SDD-0714). */
export function hasStoredAppearance(): { theme: boolean; density: boolean } {
  try {
    return {
      theme: localStorage.getItem(THEME_KEY) !== null,
      density: localStorage.getItem(DENSITY_KEY) !== null,
    };
  } catch {
    return { theme: false, density: false };
  }
}

export function readDensity(): StudioDensity {
  try {
    const d = localStorage.getItem(DENSITY_KEY);
    if (d === "ultra") return "ultra";
    if (d === "normal" || d === "spacious") return "normal";
    return DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function applyTheme(next: StudioThemePref): void {
  try {
    document.documentElement.dataset.theme = resolveTheme(next) === "dark" ? "dark" : "";
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

/**
 * Mientras el tema elegido sea Automático, sigue al sistema en vivo. Devuelve la
 * función para dejar de escuchar.
 */
export function followSystemTheme(): () => void {
  try {
    if (typeof window.matchMedia !== "function") return () => {};
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (readThemePref() !== "auto") return;
      document.documentElement.dataset.theme = mq.matches ? "dark" : "";
      window.dispatchEvent(
        new CustomEvent<AppearanceDetail>(APPEARANCE_EVENT, { detail: { theme: "auto" } }),
      );
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}
