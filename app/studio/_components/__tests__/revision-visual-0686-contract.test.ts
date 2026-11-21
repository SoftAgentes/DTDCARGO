/**
 * SDD-0686 · revisión visual de main (d590ea3f3), con capturas en claro y oscuro.
 * Fija lo que se corrigió para que no vuelva:
 * - el login y la recuperación tienen el fondo navy fijo, sin vino;
 * - el brillo de fondo es azul de acción o navy neutro (lista blanca);
 * - un rol no lleva tono de estado;
 * - el título de una pestaña no repite «DTD Studio», que lo pone la plantilla.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { roleBadgeTone, STUDIO_USER_ROLES } from "@/lib/studio/user-types";
import { fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/**
 * Colores permitidos en el brillo de fondo: azul de acción (`--accion` claro
 * #1F4FA8 y oscuro #7FAAF0) y los navy neutros de la marca (#0F1E3D, #1F3055).
 */
const BRILLO_PERMITIDO = new Set(["31,79,168", "127,170,240", "15,30,61", "31,48,85"]);

/** Líneas del brillo: cada `--grad-page` de tokens.css y el del menú lateral. */
function fuentesDelBrillo(): string[] {
  const tokens = leer("app/studio/tokens.css").split("\n").filter((l) => l.includes("--grad-page:"));
  const menu = leer("app/studio/(app)/_components/StudioSidebar.tsx").split("\n").filter((l) => l.includes("radial-gradient("));
  expect(tokens.length).toBeGreaterThanOrEqual(3);
  expect(menu.length).toBeGreaterThanOrEqual(1);
  return [...tokens, ...menu];
}

function coloresFueraDelBrillo(lineas: string[]): string[] {
  const fuera: string[] = [];
  for (const linea of lineas) {
    for (const m of linea.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      if (!BRILLO_PERMITIDO.has(`${m[1]},${m[2]},${m[3]}`)) fuera.push(m[0]);
    }
    for (const m of linea.matchAll(/#[0-9a-f]{3,8}\b/gi)) fuera.push(m[0]);
  }
  return fuera;
}

describe("SDD-0686 · revisión visual", () => {
  it("el fondo del login es navy fijo, no el --studio-ink que se invierte", () => {
    const regla = /\.studio-dark \{[^}]*\}/.exec(leer("app/studio/studio.css"))?.[0] ?? "";
    expect(regla).toContain("background: var(--bg-sidebar);");
  });

  it("el login y la recuperación no usan el vino suave ni el pie al 45 %", () => {
    for (const f of ["app/studio/(auth)/login/LoginForm.tsx", "app/studio/(auth)/login/recuperar/RecoveryForm.tsx"]) {
      const fuente = leer(f);
      expect(fuente).not.toMatch(/#C2747F/i);
      expect(fuente).not.toContain("rgba(255, 255, 255, 0.45)");
      expect(fuente).toContain("var(--accion-soft)");
    }
  });

  it("el brillo de fondo es azul de acción o navy neutro, en los dos temas y en el menú", () => {
    // Lista blanca, no lista negra (revisión de la #747): cualquier otro color,
    // como un vino `rgba(127,15,26,…)` o un hex `#AE1A28`, rompe.
    expect(coloresFueraDelBrillo(fuentesDelBrillo())).toEqual([]);
  });

  it.each([
    ["un vino en rgba", "rgba(31,79,168,.05)", "rgba(127,15,26,.09)"],
    ["un hex rojo", "rgba(31,79,168,.05)", "#AE1A28"],
  ])("mutante: %s en el brillo se detecta", (_, de, a) => {
    const fuentes = fuentesDelBrillo();
    expect(fuentes[0]).toContain(de);
    expect(coloresFueraDelBrillo([fuentes[0].replace(de, a), ...fuentes.slice(1)])).toHaveLength(1);
  });

  it("ningún rol lleva tono de estado", () => {
    for (const r of STUDIO_USER_ROLES) expect(roleBadgeTone(r)).toBe("neutral");
  });

  it("ningún título de pestaña del Studio repite el sufijo de la plantilla", () => {
    const repetidos = fuentesDe(join(RAIZ, "app/studio"), /\.tsx?$/)
      .filter((ruta) => /title: ["'`][^"'`]*[·—]\s*DTD Studio["'`]/.test(readFileSync(ruta, "utf8")))
      .map(rel);
    expect(repetidos).toEqual([]);
    expect(leer("app/studio/layout.tsx")).toContain('template: "%s · DTD Studio"');
  });

  it("la banda de bienvenida del Dashboard es navy de marca, sin vino ni rojo (Sam, opción A)", () => {
    const pagina = leer("app/studio/(app)/dashboard/page.tsx");
    expect(pagina).toContain('background: "var(--grad-bienvenida)",');
    expect(pagina).not.toMatch(/wine|127,\s*15,\s*26|--danger/);
    const tokens = leer("app/studio/tokens.css");
    expect(tokens).not.toContain("--grad-wine-panel");
    for (const linea of tokens.split("\n").filter((l) => l.includes("--grad-bienvenida:"))) {
      expect(linea).toMatch(/#0F1E3D|#16264A/);
      expect(linea).not.toMatch(/#[AC][E0-9A-F]{5}|#7F0F1A/i);
    }
  });

  it("la leyenda de «Embarques y CBM por mes» cabe en el lienzo", () => {
    expect(leer("app/studio/(app)/reportes/_components/charts.tsx")).toContain("viewBox={`0 0 ${W} ${H + 48}`}");
  });
});
