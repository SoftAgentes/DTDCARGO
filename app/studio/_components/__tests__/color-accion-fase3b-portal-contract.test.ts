/**
 * SDD-0686 · fase 3b-1: el Portal del cliente (`app/portal`) sin vino de acción.
 *
 * - Botones, enlaces, foco y casillas en `--color-accion*`; selección, códigos,
 *   cifras, avatares y badges en tinta (`--color-ink`); eyebrows en tinta suave.
 * - En el portal oscuro los tokens `--color-accion*` toman los valores oscuros
 *   del Studio, con texto navy sobre el relleno.
 * - `.btn-primary` del portal (`#portal-shell`) es azul; la web pública lo
 *   conserva hasta la 3b-2.
 * - Decisiones de Sam del 2026-11-22, «Portal: Vista simple A, Próximo arribo B»:
 *   la Vista simple queda sin vino (EXC-0654-01 cerrada) y el acento de la
 *   tarjeta «Próximo arribo» es `--color-accion-on-dark`, con AA sobre el navy.
 * - Sin vino en `app/portal` (sin `(auth)`, que va en la fase 4). Solo baja.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of fuentesDe(join(RAIZ, "app/portal"), /\.(tsx?|css)$/)) {
    const r = rel(ruta);
    if (/\.test\.tsx?$/.test(r) || r.startsWith("app/portal/(auth)/")) continue;
    const n = cuentaVino(fuente(ruta));
    if (n) out[r] = n;
  }
  return out;
}

/** Bloque CSS de un selector exacto (primera aparición). */
function bloque(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return "";
  return css.slice(i, css.indexOf("}", i));
}
function valor(css: string, selector: string, nombre: string): string {
  return new RegExp(`${nombre}:\\s*([^;]+);`).exec(bloque(css, selector))?.[1].trim() ?? "";
}

function luminancia(h: string): number {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** El acento del héroe «Próximo arribo» es el token de acción sobre navy (Sam: B). */
function heroeEsAccion(css: string): boolean {
  return valor(css, "[data-portal-theme]", "--hero-accent") === "var(--color-accion-on-dark)";
}

const OSCURO = '[data-portal-theme="dark"]';

describe("SDD-0686 fase 3b-1 · Portal sin vino de acción", () => {
  it("app/portal no tiene vino (fuera del inicio de sesión)", () => {
    expect(cuentas((ruta) => readFileSync(ruta, "utf8"))).toEqual({});
  });

  it.each([
    ["un enlace en vino", "app/portal/_components/PortalFooter.tsx", "text-accion-text hover:underline", "text-wine-text hover:underline"],
    ["un foco en vino", "app/portal/_components/ReferralInviteForm.tsx", "focus-visible:ring-accion", "focus-visible:ring-wine"],
    ["un botón en vino", "app/portal/(app)/error.tsx", 'background: "var(--color-accion)"', 'background: "var(--color-wine)"'],
    ["un tono \"wine\" de KPI", "app/portal/(app)/_components/PortalDashboardNorte.tsx", 'tone="ink"', 'tone="wine"'],
    ["el Shipping Mark de la Vista simple en vino", "app/portal/(app)/_simple/InicioSimple.tsx", '<span className="font-mono font-bold text-ink">', '<span className="font-mono font-bold" style={{ color: "var(--color-wine-text)" }}>'],
  ])("mutante: %s se detecta", (_, objetivo, de, a) => {
    const original = leer(objetivo);
    expect(original).toContain(de);
    const mutado = original.replace(de, a);
    const c = cuentas((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(c[objetivo]).toBe(1);
  });

  it("el portal oscuro redefine el azul de acción con los valores oscuros del Studio", () => {
    const css = leer("app/globals.css");
    const studio = leer("app/studio/tokens.css");
    const oscuroStudio = studio.slice(studio.indexOf('[data-theme="dark"]'));
    const par: [string, string][] = [
      ["--color-accion", "--accion"],
      ["--color-accion-hover", "--accion-hover"],
      ["--color-on-accion", "--on-accion"],
      ["--color-accion-text", "--accion-text"],
    ];
    for (const [web, erp] of par) {
      const deStudio = new RegExp(`\\s${erp}:\\s*(#[0-9A-Fa-f]{6});`).exec(oscuroStudio)?.[1];
      expect(deStudio, erp).toBeTruthy();
      expect(valor(css, OSCURO, web).toLowerCase(), web).toBe(deStudio!.toLowerCase());
    }
  });

  it("el botón principal del portal es azul y la web pública conserva el suyo hasta la 3b-2", () => {
    const css = leer("app/globals.css");
    const portal = bloque(css, "#portal-shell .btn-primary");
    expect(portal).toContain("background: var(--color-accion);");
    expect(portal).toContain("color: var(--color-on-accion);");
    expect(portal).not.toMatch(/rgba\(/);
    expect(bloque(css, "#portal-shell .btn-primary:hover")).toContain("var(--color-accion-hover)");
    expect(bloque(css, ".btn-primary")).toContain("var(--color-wine)");
  });

  it("sobre un relleno de acción el texto es --color-on-accion, no --color-on-accent ni blanco", () => {
    const conPar: string[] = [];
    for (const ruta of fuentesDe(join(RAIZ, "app/portal"), /\.(tsx|css)$/)) {
      const r = rel(ruta);
      if (/\.test\.tsx?$/.test(r)) continue;
      const t = readFileSync(ruta, "utf8");
      for (const m of t.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (/background: "var\(--color-accion\)"/.test(m[1]) && /--color-on-accent|#fff/i.test(m[1])) conPar.push(r);
      }
      if (/bg-accion text-(?:\[color:var\(--color-on-accent\)\]|white)(?![\w-])/.test(t)) conPar.push(r);
    }
    expect(conPar).toEqual([]);
  });

  it("Vista simple A: el bloque .vs no nombra el vino (EXC-0654-01 cerrada)", () => {
    const css = leer("app/globals.css");
    const vs = css.slice(css.indexOf("SDD-0654 fase 2 · Vista simple del portal"));
    const reglas = vs.slice(vs.indexOf(".vs {"), vs.indexOf(".vs .vs-proveedor {")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(reglas).not.toMatch(/wine/);
    expect(reglas).toContain("background: var(--color-accion);");
  });

  it("Próximo arribo B: el acento del héroe es azul sobre navy y pasa AA en los dos temas", () => {
    const css = leer("app/globals.css");
    expect(heroeEsAccion(css)).toBe(true);
    // Mutante: devolverle el vino suave al héroe.
    expect(heroeEsAccion(css.replace("--hero-accent: var(--color-accion-on-dark);", "--hero-accent: #dd8088;"))).toBe(false);
    const claro = valor(css, "@theme", "--color-accion-on-dark");
    const noche = valor(css, OSCURO, "--color-accion-on-dark");
    expect(claro.toLowerCase()).toBe("#7faaf0");
    // Peor caso: el extremo claro del degradado del héroe en cada tema.
    for (const [acento, fondo] of [
      [claro, valor(css, "[data-portal-theme]", "--hero-from")],
      [claro, valor(css, "[data-portal-theme]", "--hero-to")],
      [noche, "#1b2e54"],
      [noche, valor(css, OSCURO, "--hero-to") || "#25406c"],
    ]) {
      expect(contraste(acento, fondo), `${acento} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
