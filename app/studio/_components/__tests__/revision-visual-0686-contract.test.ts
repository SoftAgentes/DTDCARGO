/**
 * SDD-0686 · revisión visual de main (d590ea3f3), con capturas en claro y oscuro.
 * Fija lo que se corrigió para que no vuelva:
 * - el login y la recuperación tienen el fondo navy fijo, sin vino;
 * - el brillo de fondo no es rojo;
 * - un rol no lleva tono de estado;
 * - el título de una pestaña no repite «DTD Studio», que lo pone la plantilla.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { roleBadgeTone, STUDIO_USER_ROLES } from "@/lib/studio/user-types";
import { fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

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

  it("el brillo de fondo no es rojo, en los dos temas y en el menú", () => {
    const rojos = /rgba\((168,\s*50,\s*62|158,\s*21,\s*34)/;
    const tokens = leer("app/studio/tokens.css");
    for (const linea of tokens.split("\n").filter((l) => l.includes("--grad-page:"))) {
      expect(linea).not.toMatch(rojos);
    }
    expect(leer("app/studio/(app)/_components/StudioSidebar.tsx")).not.toMatch(rojos);
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
