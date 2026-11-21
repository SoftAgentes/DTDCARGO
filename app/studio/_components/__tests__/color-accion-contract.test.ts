import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0686 (BD-076): azul = acción, rojo = peligro, vino = identidad.
 *
 * Lee los valores reales de `tokens.css` y las reglas reales de `studio.css`. Si alguien
 * devuelve el botón principal al vino, acerca el azul al rojo de peligro o deja un token
 * de acción sin contraste, se rompe aquí. Cada regla tiene piso (lo que mide no puede
 * quedar vacío) y un mutante que demuestra que la regla mira algo.
 */

const tokensCss = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");
const studioCss = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8");

const iOscuro = tokensCss.indexOf('[data-theme="dark"] {');
const iCompacto = tokensCss.indexOf('[data-density="compact"]');
const iImpresion = tokensCss.indexOf("@media print {");
const bloqueClaro = tokensCss.slice(0, iOscuro);
const bloqueOscuro = tokensCss.slice(iOscuro, iCompacto);
const bloqueImpresion = tokensCss.slice(iImpresion, iCompacto);

type Tema = "claro" | "oscuro";
const TEMAS: readonly Tema[] = ["claro", "oscuro"];

const ACCION = ["--accion", "--accion-hover", "--on-accion", "--accion-text", "--accion-tint", "--accion-soft"] as const;

function valor(bloque: string, nombre: string): string {
  // El borde izquierdo evita que «--accion» encuentre «--on-accion».
  const m = bloque.match(new RegExp(`(?<![\\w-])${nombre}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`no hay ${nombre}`);
  return m[1].trim();
}

function crudo(tema: Tema, nombre: string, claro = bloqueClaro, oscuro = bloqueOscuro): string {
  if (tema === "oscuro") {
    try {
      return valor(oscuro, nombre);
    } catch {
      // el token no se sobrescribe en oscuro: hereda el claro
    }
  }
  return valor(claro, nombre);
}

function color(tema: Tema, nombre: string, claro = bloqueClaro, oscuro = bloqueOscuro): string {
  const v = crudo(tema, nombre, claro, oscuro);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? color(tema, ref[1], claro, oscuro) : v;
}

type Rgb = { r: number; g: number; b: number; a: number };

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

function sobre(frente: Rgb, fondo: Rgb): Rgb {
  return {
    r: frente.r * frente.a + fondo.r * (1 - frente.a),
    g: frente.g * frente.a + fondo.g * (1 - frente.a),
    b: frente.b * frente.a + fondo.b * (1 - frente.a),
    a: 1,
  };
}

function ratio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luz(a), luz(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function contraste(tema: Tema, frente: string, fondo: string, claro = bloqueClaro, oscuro = bloqueOscuro): number {
  const f = aRgb(color(tema, fondo, claro, oscuro));
  return ratio(sobre(aRgb(color(tema, frente, claro, oscuro)), f), f);
}

/** Tono en grados (0-360) de un color sólido. */
function tono(c: string): number {
  const { r, g, b } = aRgb(c);
  const [x, y, z] = [r / 255, g / 255, b / 255];
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const d = max - min;
  if (d === 0) return 0;
  let h = max === x ? ((y - z) / d) % 6 : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function distanciaDeTono(a: string, b: string): number {
  const d = Math.abs(tono(a) - tono(b));
  return Math.min(d, 360 - d);
}

/** Cuerpo de la primera regla con ese selector exacto. */
function regla(css: string, selector: string): string {
  const i = css.indexOf(`\n${selector} {`);
  if (i < 0) throw new Error(`no hay regla ${selector}`);
  return css.slice(i, css.indexOf("}", i));
}

describe("color de acción · SDD-0686 (BD-076)", () => {
  it("los seis tokens de acción existen en claro y en oscuro", () => {
    for (const t of ACCION) {
      expect([t, valor(bloqueClaro, t)]).toEqual([t, expect.any(String)]);
      expect([t, valor(bloqueOscuro, t)]).toEqual([t, expect.any(String)]);
    }
  });

  describe.each(TEMAS)("tema %s", (tema) => {
    it("el texto sobre el relleno se lee, también al pasar el cursor (mínimo 4,5:1)", () => {
      expect(contraste(tema, "--on-accion", "--accion")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(tema, "--on-accion", "--accion-hover")).toBeGreaterThanOrEqual(4.5);
    });

    it("el relleno se separa de la tarjeta y del panel elevado (mínimo 3:1)", () => {
      expect(contraste(tema, "--accion", "--bg-surface")).toBeGreaterThanOrEqual(3);
      expect(contraste(tema, "--accion", "--bg-elevated")).toBeGreaterThanOrEqual(3);
    });

    it("la acción como texto se lee sobre cada fondo (mínimo 4,5:1)", () => {
      const fondos = ["--bg-base", "--bg-surface", "--bg-elevated"];
      expect(fondos).toHaveLength(3);
      for (const fondo of fondos) {
        expect([fondo, contraste(tema, "--accion-text", fondo) >= 4.5]).toEqual([fondo, true]);
      }
    });

    it("la acción como texto se lee sobre su propio fondo suave (mínimo 4,5:1)", () => {
      const tarjeta = aRgb(color(tema, "--bg-surface"));
      const tinte = sobre(aRgb(color(tema, "--accion-tint")), tarjeta);
      expect(ratio(aRgb(color(tema, "--accion-text")), tinte)).toBeGreaterThanOrEqual(4.5);
    });

    it("el foco sobre el menú lateral se ve (mínimo 3:1)", () => {
      expect(contraste(tema, "--accion-soft", "--bg-sidebar")).toBeGreaterThanOrEqual(3);
    });

    it("la acción y el peligro no comparten tono (al menos 90°)", () => {
      expect(distanciaDeTono(color(tema, "--accion"), color(tema, "--danger"))).toBeGreaterThanOrEqual(90);
    });
  });

  it("mutante: devolver la acción al vino de peligro rompe la distancia de tono", () => {
    const mutado = bloqueClaro.replace(/--accion:\s*[^;]+;/, "--accion: #A8323E;");
    expect(mutado).not.toBe(bloqueClaro);
    expect(distanciaDeTono(color("claro", "--accion", mutado), color("claro", "--danger", mutado))).toBeLessThan(90);
  });

  it("mutante: texto blanco sobre el azul claro del tema oscuro no alcanza 4,5:1", () => {
    const mutado = bloqueOscuro.replace(/--on-accion:\s*[^;]+;/, "--on-accion: #FFFFFF;");
    expect(mutado).not.toBe(bloqueOscuro);
    expect(contraste("oscuro", "--on-accion", "--accion", bloqueClaro, mutado)).toBeLessThan(4.5);
  });

  it("los tokens de acción no dependen del vino", () => {
    const valores = [...tokensCss.matchAll(/--(?:on-)?accion(?:-[\w]+)?\s*:\s*([^;]+);/g)].map((m) => m[1]);
    expect(valores.length).toBeGreaterThanOrEqual(ACCION.length * 3); // claro, oscuro e impresión
    for (const v of valores) expect(v).not.toMatch(/--wine/);
  });

  it("al imprimir, cada token de acción vuelve a su valor claro", () => {
    expect(bloqueImpresion.length).toBeGreaterThan(0);
    for (const t of ACCION) expect([t, valor(bloqueImpresion, t)]).toEqual([t, valor(bloqueClaro, t)]);
  });

  describe("reglas de studio.css", () => {
    const PRINCIPAL = [
      ".studio-btn-primary",
      ".studio-btn-primary:hover:not(:disabled)",
      ".studio-btn-primary:focus-visible",
    ];

    it("el botón principal usa los tokens de acción y ninguno del vino", () => {
      expect(regla(studioCss, ".studio-btn-primary")).toContain("background: var(--accion)");
      expect(regla(studioCss, ".studio-btn-primary")).toContain("color: var(--on-accion)");
      expect(regla(studioCss, ".studio-btn-primary:hover:not(:disabled)")).toContain("background: var(--accion-hover)");
      for (const sel of PRINCIPAL) expect([sel, regla(studioCss, sel)]).toEqual([sel, expect.not.stringMatching(/wine/)]);
    });

    it("mutante: un principal en vino rompe la regla", () => {
      const mutado = studioCss.replace(
        /(\n\.studio-btn-primary \{[^}]*?)background: var\(--accion\)/,
        "$1background: var(--wine)",
      );
      expect(mutado).not.toBe(studioCss);
      expect(regla(mutado, ".studio-btn-primary")).toMatch(/wine/);
    });

    it("el foco global usa el color de acción", () => {
      const global = tokensCss.match(/\n:focus-visible \{([^}]*)\}/);
      expect(global).not.toBeNull();
      expect(global![1]).toContain("var(--accion)");
      expect(global![1]).not.toMatch(/wine/);
    });

    it("ningún anillo de foco de studio.css sale del vino", () => {
      const sinComentarios = studioCss.replace(/\/\*[\s\S]*?\*\//g, "");
      const focos = [...sinComentarios.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^{}]*)\}/g)];
      expect(focos.length).toBeGreaterThanOrEqual(20);
      const enVino = focos.filter((m) => /wine/.test(m[2])).map((m) => m[1].trim());
      expect(enVino).toEqual([]);
    });

    it("los alias retirados del vino no vuelven", () => {
      expect(studioCss).not.toMatch(/--studio-wine:\s/);
      expect(studioCss).not.toMatch(/--studio-wine-deep:\s/);
    });
  });
});
