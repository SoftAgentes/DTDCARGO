import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0688 fase 2 · estilos de texto con nombre y tres vistas (VIS-02 §3, spec §11.5).
 *
 * Mide estructura, no valores: los tamaños exactos los aprobó Sam el 2026-11-23 y
 * se ajustan en tokens.css sin romper este contrato. Lo que no puede
 * romperse: los once roles existen y leen su token, ninguna vista baja del piso de
 * 12 px en lo que se lee y nada que se oprima mide menos de 32 px.
 */
const raiz = process.cwd();
const tokens = readFileSync(join(raiz, "app/studio/tokens.css"), "utf8");
const css = readFileSync(join(raiz, "app/studio/studio.css"), "utf8");

const ROLES = [
  "display", "pantalla", "seccion", "tarjeta", "cuerpo", "cuerpo-compacto",
  "label", "eyebrow", "caption", "dato", "feedback",
];
/** Roles de lectura: los que no pueden bajar del piso (display y títulos son más grandes). */
const LECTURA = ["cuerpo", "cuerpo-compacto", "label", "eyebrow", "caption", "dato", "feedback"];

/** Valores de :root hasta el tema oscuro: la vista Normal. */
const normal = tokens.slice(0, tokens.indexOf('[data-theme="dark"]'));

function bloque(selector: string): string {
  const i = tokens.indexOf(selector + " {");
  return i < 0 ? "" : tokens.slice(i, tokens.indexOf("\n}", i));
}
function px(b: string, nombre: string): number | undefined {
  const m = b.match(new RegExp("--" + nombre + ":\\s*(\\d+(?:\\.\\d+)?)px"));
  return m ? Number(m[1]) : undefined;
}
function regla(selector: string): string {
  const esc = selector.replace(/[.\-]/g, "\\$&");
  return css.match(new RegExp(esc + "\\s*\\{([^}]*)\\}"))?.[1] ?? "";
}

const VISTAS: [string, string][] = [
  ["normal", normal],
  ["compact", bloque('[data-density="compact"]')],
  ["ultra", bloque('[data-density="ultra"]')],
];

describe("estilos de texto con nombre · SDD-0688 fase 2", () => {
  it("los once roles tienen su clase y leen su variable --t-*", () => {
    for (const r of ROLES) {
      expect([r, regla(".t-" + r).includes(`var(--t-${r})`)]).toEqual([r, true]);
    }
  });

  it("ninguna clase nombrada escribe un tamaño en píxeles", () => {
    for (const r of ROLES) {
      const sinVars = regla(".t-" + r).replace(/var\([^)]*\)/g, "");
      expect([r, /\d\s*px/.test(sinVars)]).toEqual([r, false]);
    }
  });

  it("Normal define los once tamaños y las otras dos vistas existen", () => {
    for (const r of ROLES) expect([r, px(normal, "t-" + r) !== undefined]).toEqual([r, true]);
    expect(VISTAS[1][1].length).toBeGreaterThan(0);
    expect(VISTAS[2][1].length).toBeGreaterThan(0);
  });

  it("ninguna vista baja los textos de lectura del piso de 12 px", () => {
    expect(px(normal, "t-piso")).toBe(12);
    for (const [vista, b] of VISTAS) {
      for (const r of LECTURA) {
        const v = px(b, "t-" + r);
        if (v !== undefined) expect([vista, r, v >= 12]).toEqual([vista, r, true]);
      }
    }
  });

  it("al compactar, el título y la fila bajan: 44, 36 y 32 px de fila", () => {
    const t = VISTAS.map(([, b]) => px(b, "t-pantalla")!);
    expect(t[0]).toBeGreaterThan(t[1]);
    expect(t[1]).toBeGreaterThan(t[2]);
    expect(VISTAS.map(([, b]) => px(b, "fila-h"))).toEqual([44, 36, 32]);
  });

  it("nada que se oprima mide menos de 32 px: el piso es un token y el selector lo usa", () => {
    expect(px(normal, "objetivo-min")).toBe(32);
    const op = regla(".studio-vista__op");
    expect(op).toContain("height: var(--objetivo-min)");
    expect(op).toContain("min-width: var(--objetivo-min)");
  });

  it("el selector de vista no recorta el anillo de foco (WCAG 2.4.7)", () => {
    // Sin comentarios: el del CSS explica justo esta regla y nombra la propiedad.
    const cont = regla(".studio-vista").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cont.length).toBeGreaterThan(0);
    expect(cont).not.toMatch(/overflow\s*:\s*(hidden|clip)/);
    // Las esquinas las redondean los botones de los extremos.
    expect(regla(".studio-vista__op:first-child")).toContain("border-radius");
    expect(regla(".studio-vista__op:last-child")).toContain("border-radius");
  });

  it("mutante: devolver overflow: hidden al selector se detecta", () => {
    const mutado = css.replace(".studio-vista {", ".studio-vista {\n  overflow: hidden;");
    expect(mutado).not.toBe(css);
    const cont = mutado.match(/\.studio-vista\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(cont).toMatch(/overflow\s*:\s*(hidden|clip)/);
  });

  it("Amplia ya no existe", () => {
    expect(tokens).not.toContain('[data-density="spacious"]');
  });

  it("las pantallas de muestra usan EncabezadoPagina y no escriben su h1 a mano", () => {
    for (const p of ["calendario", "tracking", "dashboard"]) {
      const src = readFileSync(join(raiz, `app/studio/(app)/${p}/page.tsx`), "utf8");
      expect([p, src.includes("<EncabezadoPagina")]).toEqual([p, true]);
      expect([p, /<h1[\s>]/.test(src)]).toEqual([p, false]);
    }
  });
});
