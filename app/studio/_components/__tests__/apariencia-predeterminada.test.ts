// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DENSITY_KEY, THEME_KEY, readDensity, readTheme } from "../appearance-prefs";

/**
 * SDD-0603 · oscuro y compacto por defecto. El script corre antes del primer paint y
 * no puede importar `appearance-prefs`, así que aquí se ejecuta el texto real de
 * `layout.tsx` y se compara con lo que esas funciones dicen.
 */
const layout = readFileSync(join(process.cwd(), "app/studio/layout.tsx"), "utf8");
const script = layout.match(/const THEME_FOUC_SCRIPT = `([\s\S]*?)`\.trim\(\);/)?.[1] ?? "";

function correr(pathname = "/studio/dashboard") {
  new Function("location", script)({ pathname });
}

/** Tokens de un bloque de CSS, sin comentarios: nombre → valor. */
function tokensDe(bloque: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of bloque.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!m.has(r[1])) m.set(r[1], r[2].trim().replace(/\s+/g, " "));
  }
  return m;
}

const html = document.documentElement;

describe("apariencia predeterminada del Studio · SDD-0603", () => {
  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute("data-theme");
    html.removeAttribute("data-density");
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

  it.each(["/studio/ficha-chat", "/studio/cerrar-chat"])("%s sigue a Chatwoot: ni tema ni densidad", (ruta) => {
    correr(ruta);
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(html.hasAttribute("data-density")).toBe(false);
  });

  it("al imprimir, cada token que el oscuro sobrescribe vuelve a su valor claro", () => {
    const css = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");
    const iOscuro = css.indexOf('[data-theme="dark"] {');
    const iImpresion = css.indexOf("@media print {");
    expect(iImpresion).toBeGreaterThan(iOscuro);
    const claro = tokensDe(css.slice(0, iOscuro));
    const oscuro = tokensDe(css.slice(iOscuro, iImpresion));
    const impresion = tokensDe(css.slice(iImpresion, css.indexOf('[data-density="compact"]')));
    expect(oscuro.size).toBeGreaterThan(20);
    expect([...impresion.keys()].sort()).toEqual([...oscuro.keys()].sort());
    for (const [nombre, valor] of impresion) expect([nombre, valor]).toEqual([nombre, claro.get(nombre)]);
  });
});
