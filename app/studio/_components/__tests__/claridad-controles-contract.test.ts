import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0603: lo que se oprime se distingue de lo que no.
 *
 * Mide los pares de tokens que usan las reglas reales de `studio.css`, en claro y en
 * oscuro. Un cambio de token o de regla que vuelva a dejar pálido un control rompe
 * aquí, sin esperar a que alguien lo note en pantalla.
 */

const tokensCss = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");
const studioCss = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8");

const corte = tokensCss.indexOf('[data-theme="dark"] {');
const bloqueClaro = tokensCss.slice(0, corte);
const bloqueOscuro = tokensCss.slice(corte, tokensCss.indexOf('[data-density="compact"]'));

type Rgb = { r: number; g: number; b: number; a: number };

function valor(bloque: string, nombre: string): string {
  const m = bloque.match(new RegExp(`${nombre}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`no hay ${nombre}`);
  return m[1].trim();
}

function color(tema: "claro" | "oscuro", nombre: string): string {
  const b = tema === "claro" ? bloqueClaro : bloqueOscuro;
  try {
    return valor(b, nombre);
  } catch {
    return valor(bloqueClaro, nombre); // el token no se sobrescribe en oscuro
  }
}

function aRgb(c: string): Rgb {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const n = c.match(/[\d.]+/g)!.map(Number);
  return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
}

const luz = ({ r, g, b }: Rgb) => {
  const [x, y, z] = [r, g, b].map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * x + 0.7152 * y + 0.0722 * z;
};

function contraste(tema: "claro" | "oscuro", frente: string, fondo: string): number {
  const f = aRgb(color(tema, fondo));
  const a = aRgb(color(tema, frente));
  const mezcla = { r: a.r * a.a + f.r * (1 - a.a), g: a.g * a.a + f.g * (1 - a.a), b: a.b * a.a + f.b * (1 - a.a), a: 1 };
  const [l1, l2] = [luz(mezcla), luz(f)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Cuerpo de la primera regla con ese selector exacto. */
function regla(selector: string): string {
  const i = studioCss.indexOf(`\n${selector} {`);
  if (i < 0) throw new Error(`no hay regla ${selector}`);
  return studioCss.slice(i, studioCss.indexOf("}", i));
}

const TEMAS = ["claro", "oscuro"] as const;

describe("claridad de controles · SDD-0603", () => {
  describe.each(TEMAS)("tema %s", (tema) => {
    it("el contorno del botón secundario se ve contra la tarjeta (mínimo 3:1)", () => {
      expect(regla(".studio-btn-ghost")).toContain("border-color: var(--ink)");
      expect(contraste(tema, "--ink", "--bg-surface")).toBeGreaterThanOrEqual(3);
    });

    it("el contorno de un campo se ve contra la tarjeta (mínimo 3:1)", () => {
      expect(regla(".studio-input")).toContain("border: 1px solid var(--ink-soft)");
      expect(contraste(tema, "--ink-soft", "--bg-surface")).toBeGreaterThanOrEqual(3);
    });

    it("el texto de cada botón con relleno se lee (mínimo 4,5:1)", () => {
      expect(regla(".studio-btn-primary")).toContain("color: var(--ink-side-strong)");
      expect(contraste(tema, "--ink-side-strong", "--wine")).toBeGreaterThanOrEqual(4.5);
      expect(regla(".studio-btn-dark")).toContain("color: var(--ink-inv)");
      expect(contraste(tema, "--ink-inv", "--ink")).toBeGreaterThanOrEqual(4.5);
      expect(regla(".studio-btn-warning")).toContain("color: var(--on-warning)");
      expect(contraste(tema, "--on-warning", "--warning")).toBeGreaterThanOrEqual(4.5);
      expect(regla(".studio-btn-danger")).toContain("color: var(--ink-inv)");
      expect(contraste(tema, "--ink-inv", "--danger")).toBeGreaterThanOrEqual(4.5);
    });

    it("el texto de un botón deshabilitado se sigue leyendo", () => {
      expect(regla(".studio-btn:disabled")).toContain("color: var(--ink-soft)");
      expect(regla(".studio-btn:disabled")).not.toContain("opacity");
      expect(contraste(tema, "--ink-soft", "--bg-elevated")).toBeGreaterThanOrEqual(4.5);
    });

    it("el activo del menú lateral resalta sobre el navy", () => {
      expect(contraste(tema, "--on-warning", "--ink-side-strong")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(tema, "--ink-side-strong", "--bg-sidebar")).toBeGreaterThanOrEqual(3);
    });
  });

  it("nada que se oprime baja de 32 px, tampoco en la vista compacta", () => {
    const alturas = [...studioCss.matchAll(/\.studio-(?:btn|tab|densidad|cerrar-panel|icono-btn)[^{]*\{[^}]*?(?:min-height|\bheight): (\d+)px/g)].map(
      (m) => Number(m[1]),
    );
    expect(alturas.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(32);
  });

  it("el secundario tiene una sola regla de hover: otra lo dejaba ilegible", () => {
    expect(studioCss.match(/\.studio-btn-ghost:hover/g)).toHaveLength(1);
  });

  it("los botones no traen colores inventados", () => {
    const inicio = studioCss.indexOf("\n.studio-btn {");
    const fin = studioCss.indexOf("/* Spinner inline", inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);
    expect(studioCss.slice(inicio, fin)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("la vista compacta conserva el mínimo táctil en sus tokens", () => {
    const compacto = tokensCss.slice(tokensCss.indexOf('[data-density="compact"]'));
    expect(valor(compacto, "--sb-item-y")).toBe("7px");
    expect(valor(bloqueClaro, "--sb-item-y")).toBe("11px");
  });
});
