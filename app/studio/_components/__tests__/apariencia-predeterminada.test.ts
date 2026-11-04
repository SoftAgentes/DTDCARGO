// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DENSITY_KEY, THEME_KEY, readDensity, readTheme } from "../appearance-prefs";

/**
 * SDD-0603 · oscuro y compacto por defecto. El script corre antes del primer paint y
 * no puede importar `appearance-prefs`, así que aquí se ejecuta el texto real de
 * `layout.tsx` y se compara con lo que esas funciones dicen.
 */
const layout = readFileSync(join(process.cwd(), "app/studio/layout.tsx"), "utf8");
const script = layout.match(/const THEME_FOUC_SCRIPT = `([\s\S]*?)`\.trim\(\);/)?.[1] ?? "";

function correr(pathname = "/studio/dashboard") {
  const oyentes: Record<string, () => void> = {};
  const ventana = { addEventListener: (nombre: string, f: () => void) => (oyentes[nombre] = f) };
  new Function("location", "window", script)({ pathname }, ventana);
  return oyentes;
}

const html = document.documentElement;

describe("apariencia predeterminada del Studio · SDD-0603", () => {
  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute("data-theme");
    html.removeAttribute("data-density");
    vi.restoreAllMocks();
  });

  it("existe el script que se va a ejecutar", () => {
    expect(script).toContain("studio_theme");
  });

  it("sin elección previa: oscuro y compacto, igual que appearance-prefs", () => {
    correr();
    expect(html.getAttribute("data-theme")).toBe("dark");
    expect(html.getAttribute("data-density")).toBe("compact");
    expect(readTheme()).toBe("dark");
    expect(readDensity()).toBe("compact");
  });

  it("quien eligió claro y normal los conserva", () => {
    localStorage.setItem(THEME_KEY, "light");
    localStorage.setItem(DENSITY_KEY, "normal");
    correr();
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
    expect(readTheme()).toBe("light");
    expect(readDensity()).toBe("normal");
  });

  it("quien eligió espacioso lo conserva", () => {
    localStorage.setItem(DENSITY_KEY, "spacious");
    correr();
    expect(html.getAttribute("data-density")).toBe("spacious");
    expect(readDensity()).toBe("spacious");
  });

  it.each(["/studio/ficha-chat", "/studio/cerrar-chat"])("%s sigue el tema de Chatwoot, no el predeterminado", (ruta) => {
    correr(ruta);
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("al imprimir pasa a claro y al terminar vuelve al tema que había", () => {
    const oyentes = correr();
    oyentes.beforeprint();
    expect(html.hasAttribute("data-theme")).toBe(false);
    oyentes.afterprint();
    expect(html.getAttribute("data-theme")).toBe("dark");
  });

  it("al imprimir en claro no inventa un tema al terminar", () => {
    localStorage.setItem(THEME_KEY, "light");
    const oyentes = correr();
    oyentes.beforeprint();
    oyentes.afterprint();
    expect(html.hasAttribute("data-theme")).toBe(false);
  });
});
