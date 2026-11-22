/**
 * SDD-0626 Paso 3b · hallazgo de la prueba F (17/11): en tema oscuro el texto del borrador casi no se leía, porque el
 * recuadro usaba `var(--paper-2, #f6f5f2)`, un token que el Studio no define (caía en el gris claro de respaldo), con la
 * letra `var(--ink)`, que en oscuro es clara. Esta prueba fija que la página de revisión use SOLO tokens del Studio,
 * definidos en los dos temas, y que el texto contra su fondo pase WCAG AA (4,5:1) en claro y en oscuro.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..");
const TOKENS = readFileSync(join(RAIZ, "app/studio/tokens.css"), "utf8");
const ARCHIVOS = [
  "app/studio/(app)/admin/oficina-virtual/_components/TarjetaBorrador.tsx",
  "app/studio/(app)/admin/oficina-virtual/page.tsx",
  "app/studio/(app)/admin/oficina-virtual/_components/TarjetaCierre.tsx",
  "app/studio/(app)/admin/oficina-virtual/vista/page.tsx",
  "app/studio/(app)/admin/oficina-virtual/_components/TarjetaPausa.tsx",
];

function bloque(selector: string): Record<string, string> {
  const ini = TOKENS.indexOf(`${selector} {`);
  if (ini < 0) throw new Error(`no está el bloque ${selector} en tokens.css`);
  const fin = TOKENS.indexOf("\n}", ini);
  const vars: Record<string, string> = {};
  for (const m of TOKENS.slice(ini, fin).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const CLARO = bloque(":root");
const OSCURO = { ...CLARO, ...bloque('[data-theme="dark"]') };

function rgb(valor: string, tema: Record<string, string>): [number, number, number] {
  const v = valor.startsWith("var(--") ? tema[valor.slice(6, -1)] : valor;
  const hex = /^#([0-9a-f]{6})$/i.exec(v ?? "");
  if (!hex) throw new Error(`valor no resoluble a un color opaco: ${valor} → ${v}`);
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const c = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function contraste(a: string, b: string, tema: Record<string, string>): number {
  const [l1, l2] = [luminancia(rgb(a, tema)), luminancia(rgb(b, tema))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("revisión de la oficina · contraste con los tokens del Studio", () => {
  it("todo var(--…) sin respaldo de la página existe en tokens.css, en claro y en oscuro", () => {
    for (const rel of ARCHIVOS) {
      const src = readFileSync(join(RAIZ, rel), "utf8");
      for (const m of src.matchAll(/var\(--([a-z0-9-]+)\s*(,[^)]*)?\)/g)) {
        const [, nombre, respaldo] = m;
        if (respaldo) continue; // con respaldo explícito (espaciados)
        expect(CLARO[nombre], `${rel}: --${nombre} no está en :root`).toBeDefined();
        expect(OSCURO[nombre], `${rel}: --${nombre} no está en el tema oscuro`).toBeDefined();
      }
    }
  });

  it("ningún color de respaldo fijo en la página (un hex de respaldo ignora el tema)", () => {
    for (const rel of ARCHIVOS) {
      const src = readFileSync(join(RAIZ, rel), "utf8");
      expect(src, rel).not.toMatch(/var\(--[a-z0-9-]+\s*,\s*#[0-9a-f]{3,8}\s*\)/i);
      expect(src, rel).not.toMatch(/paper-2|--line\b/);
    }
  });

  it("el recuadro del borrador es --bg-elevated con letra --ink, y la tarjeta --bg-surface", () => {
    const src = readFileSync(join(RAIZ, ARCHIVOS[0]), "utf8");
    expect(src).toMatch(/color:\s*"var\(--ink\)",\s*\n\s*background:\s*"var\(--bg-elevated\)"/);
    expect(src).toMatch(/background:\s*"var\(--bg-surface\)",\s*color:\s*"var\(--ink\)"/);
  });

  for (const [nombre, tema] of [
    ["claro", CLARO],
    ["oscuro", OSCURO],
  ] as const) {
    it(`tema ${nombre}: --ink sobre --bg-elevated y sobre --bg-surface pasan 4,5:1`, () => {
      expect(contraste("var(--ink)", "var(--bg-elevated)", tema)).toBeGreaterThanOrEqual(4.5);
      expect(contraste("var(--ink)", "var(--bg-surface)", tema)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("control rojo: el estilo viejo (respaldo #f6f5f2 con --ink oscuro) NO pasa en oscuro", () => {
    expect(contraste("var(--ink)", "#f6f5f2", OSCURO)).toBeLessThan(1.5);
  });
});
