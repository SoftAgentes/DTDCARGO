/**
 * SDD-0603 · menores del Studio: la pista de `CapBar` (ocupación del camión).
 *
 * La barra vive sobre `--bg-sidebar`, que es oscuro en los DOS temas. La pista
 * usaba `--ink-inv-mute`, una tinta que voltea con el tema: en oscuro quedaba
 * navy sobre casi negro (1,07:1) y no se veía. `dark-theme-contrast-contract`
 * no la alcanza: salta los fondos pintados con un token de tinta, porque los
 * trata como divisores. Esta prueba mide lo que ese contrato no mira: el
 * contraste de la pista contra su superficie, en claro y en oscuro, con los
 * valores reales de `tokens.css`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const FUENTE = leer("app/studio/(app)/despacho/_components/CreateOdDrawer.tsx");
const CSS = leer("app/studio/tokens.css");

/** Bloque claro (`:root`) y bloque oscuro (`[data-theme="dark"]`) de tokens.css. */
const CORTE = CSS.indexOf('[data-theme="dark"]');
const FIN_OSCURO = CSS.indexOf("@media", CORTE);
const TEMAS = {
  claro: CSS.slice(CSS.indexOf(":root"), CORTE),
  oscuro: CSS.slice(CORTE, FIN_OSCURO === -1 ? undefined : FIN_OSCURO),
};

type Rgba = [number, number, number, number];

function valor(bloque: string, token: string): string {
  const m = bloque.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!m) throw new Error(`falta ${token}`);
  return m[1].trim();
}

function color(texto: string): Rgba {
  const hex = texto.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = texto.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) throw new Error(`color no medible: ${texto}`);
  const [r, g, b, a = "1"] = rgba[1].split(",").map((p) => p.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}

/** Compone un color translúcido sobre un fondo opaco. */
function sobre([r, g, b, a]: Rgba, [fr, fg, fb]: Rgba): Rgba {
  return [r * a + fr * (1 - a), g * a + fg * (1 - a), b * a + fb * (1 - a), 1];
}

function luminancia([r, g, b]: Rgba): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: Rgba, b: Rgba): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

/** Contraste de un token (translúcido o no) pintado sobre `--bg-sidebar`. */
function sobreBarraLateral(bloque: string, token: string): number {
  const fondo = color(valor(bloque, "--bg-sidebar"));
  return contraste(sobre(color(valor(bloque, token)), fondo), fondo);
}

/** El token con que `CapBar` pinta su pista: el primer `background` tras `height: 6`. */
function tokenDeLaPista(fuente: string): string {
  const capBar = fuente.slice(fuente.indexOf("function CapBar("));
  const m = capBar.match(/height: 6,[\s\S]*?background: "var\((--[\w-]+)\)"/);
  if (!m) throw new Error("no se encontró la pista de CapBar");
  return m[1];
}

describe("CreateOdDrawer · pista de CapBar visible en claro y oscuro", () => {
  it("CapBar no usa tinta invertida: vive sobre una superficie oscura en los dos temas", () => {
    const capBar = FUENTE.slice(FUENTE.indexOf("function CapBar("), FUENTE.indexOf("function matchHubCode("));
    expect(capBar.length).toBeGreaterThan(200);
    expect(capBar).not.toContain("--ink-inv");
  });

  it("la pista usa un token de tinta de barra lateral que ya existe", () => {
    const token = tokenDeLaPista(FUENTE);
    expect(token).toMatch(/^--ink-side/);
    expect(TEMAS.claro).toContain(`${token}:`);
    expect(TEMAS.oscuro).toContain(`${token}:`);
  });

  it.each(["claro", "oscuro"] as const)("en %s la pista llega a 3:1 contra --bg-sidebar", (tema) => {
    expect(sobreBarraLateral(TEMAS[tema], tokenDeLaPista(FUENTE))).toBeGreaterThanOrEqual(3);
  });

  it("mutante: con la tinta invertida de antes, la pista se pierde en oscuro", () => {
    const mutada = FUENTE.replace('background: "var(--ink-side-soft)"', 'background: "var(--ink-inv-mute)"');
    expect(mutada).not.toBe(FUENTE);
    const token = tokenDeLaPista(mutada);
    expect(token).toBe("--ink-inv-mute");
    expect(sobreBarraLateral(TEMAS.claro, token)).toBeGreaterThanOrEqual(3);
    expect(sobreBarraLateral(TEMAS.oscuro, token)).toBeLessThan(1.5);
  });
});
