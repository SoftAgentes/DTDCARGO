import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de SDD-0628: el aviso es una franja plana, legible y con icono visible.
 *
 * Lee las reglas reales `.studio-aviso*` de `studio.css` y los tokens de
 * `tokens.css`, en claro y en oscuro, y mide:
 *   - texto (`color` de `.studio-aviso`) ≥ 4,5:1 sobre la franja de cada tono;
 *   - icono (`color` de `> svg`, con la excepción oscura de atención) ≥ 3:1;
 *   - la franja sin contorno ni sombra, y sin colores literales.
 * La franja es translúcida: se mide compuesta sobre las tres superficies donde
 * vive un aviso (`--bg-base`, `--bg-surface`, `--bg-elevated`).
 *
 * Cada medición se cuenta (piso) y hay mutantes que deben romperla: un
 * contrato que no mira nada no puede dar verde.
 */

const tokensCss = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");
const studioCss = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8");

const corte = tokensCss.indexOf('[data-theme="dark"] {');
const bloqueClaro = tokensCss.slice(0, corte);
const bloqueOscuro = tokensCss.slice(corte, tokensCss.indexOf('[data-density="compact"]'));

type Tema = "claro" | "oscuro";
type Rgb = { r: number; g: number; b: number; a: number };

const TEMAS: readonly Tema[] = ["claro", "oscuro"];
const TONOS = ["info", "atencion", "exito", "error"] as const;
type Tono = (typeof TONOS)[number];
const SUPERFICIES = ["--bg-base", "--bg-surface", "--bg-elevated"] as const;

function valor(bloque: string, nombre: string): string | null {
  const m = bloque.match(new RegExp(`\\n\\s*${nombre}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

/** Valor de un token siguiendo `var(--otro[, respaldo])` como el navegador. */
function color(tema: Tema, expr: string): string {
  const ref = expr.match(/^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/);
  if (!ref) return expr;
  const crudo =
    (tema === "oscuro" ? valor(bloqueOscuro, ref[1]) : null) ?? valor(bloqueClaro, ref[1]);
  if (crudo) return color(tema, crudo);
  if (ref[2]) return color(tema, ref[2].trim()); // token de globals.css: vale su respaldo
  throw new Error(`token sin declarar: ${ref[1]}`);
}

function aRgb(c: string): Rgb {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const n = c.match(/[\d.]+/g);
  if (!n || n.length < 3) throw new Error(`color no reconocido: ${c}`);
  const v = n.map(Number);
  return { r: v[0], g: v[1], b: v[2], a: v[3] ?? 1 };
}

const sobre = (a: Rgb, f: Rgb): Rgb => ({
  r: a.r * a.a + f.r * (1 - a.a),
  g: a.g * a.a + f.g * (1 - a.a),
  b: a.b * a.a + f.b * (1 - a.a),
  a: 1,
});

const luz = ({ r, g, b }: Rgb) => {
  const [x, y, z] = [r, g, b].map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * x + 0.7152 * y + 0.0722 * z;
};

const razon = (a: Rgb, b: Rgb) => {
  const [l1, l2] = [luz(a), luz(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Reglas `.studio-aviso*` de una hoja: selector → cuerpo. Las de `@media screen` llevan prefijo. */
function reglasDeAviso(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!selector.includes(".studio-aviso")) continue;
    const previo = css.slice(0, m.index);
    const media = previo.lastIndexOf("@media");
    const cierre = previo.lastIndexOf("}\n}");
    const enScreen = media >= 0 && previo.slice(media).startsWith("@media screen") && cierre < media;
    out.set(enScreen ? `@screen ${selector}` : selector, m[2]);
  }
  return out;
}

function prop(cuerpo: string | undefined, nombre: string): string | null {
  if (!cuerpo) return null;
  const m = cuerpo.match(new RegExp(`(?:^|[;\\s])${nombre}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

const selTono = (t: Tono) => (t === "info" ? ".studio-aviso" : `.studio-aviso[data-tono="${t}"]`);

/** Fondo, color de texto e icono efectivos de un tono en un tema, leídos de la hoja. */
function pintura(css: string, tema: Tema, tono: Tono) {
  const r = reglasDeAviso(css);
  const base = r.get(".studio-aviso");
  const fondo = prop(r.get(selTono(tono)), "background") ?? prop(base, "background");
  const texto = prop(base, "color");
  let icono = prop(r.get(`${selTono(tono)} > svg`), "color") ?? prop(r.get(".studio-aviso > svg"), "color");
  if (tema === "oscuro") {
    const oscuro = prop(r.get(`@screen [data-theme="dark"] ${selTono(tono)} > svg`), "color");
    if (oscuro) icono = oscuro;
  }
  if (!fondo || !texto || !icono) throw new Error(`falta pintura para ${tono} en ${tema}`);
  return { fondo, texto, icono };
}

type Medida = { tema: Tema; tono: Tono; superficie: string; texto: number; icono: number };

function medir(css: string): Medida[] {
  const medidas: Medida[] = [];
  for (const tema of TEMAS) {
    for (const tono of TONOS) {
      const p = pintura(css, tema, tono);
      for (const superficie of SUPERFICIES) {
        const franja = sobre(aRgb(color(tema, p.fondo)), aRgb(color(tema, `var(${superficie})`)));
        medidas.push({
          tema,
          tono,
          superficie,
          texto: razon(sobre(aRgb(color(tema, p.texto)), franja), franja),
          icono: razon(sobre(aRgb(color(tema, p.icono)), franja), franja),
        });
      }
    }
  }
  return medidas;
}

const fallas = (ms: Medida[]) =>
  ms.filter((m) => m.texto < 4.5 || m.icono < 3).map((m) => `${m.tema}/${m.tono}/${m.superficie}`);

/** Problemas de forma: contorno, sombra o color literal en cualquier regla del aviso. */
function problemasDeForma(css: string): string[] {
  const out: string[] = [];
  const r = reglasDeAviso(css);
  const base = r.get(".studio-aviso");
  if (!/^(0|none)$/.test(prop(base, "border") ?? "")) out.push("la franja declara contorno");
  if (prop(base, "box-shadow") !== "none") out.push("la franja declara sombra");
  for (const [sel, cuerpo] of r) {
    if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(cuerpo)) out.push(`color literal en ${sel}`);
    if (/(^|[;\s])(border(?!-radius)(-[a-z]+)?|outline|box-shadow)\s*:(?!\s*(0|none)\s*;)/.test(cuerpo)) {
      out.push(`contorno o sombra en ${sel}`);
    }
  }
  return out;
}

const MEDIDAS_ESPERADAS = TEMAS.length * TONOS.length * SUPERFICIES.length; // 24

describe("avisos · SDD-0628", () => {
  const medidas = medir(studioCss);

  it(`mide las ${MEDIDAS_ESPERADAS} combinaciones de tema, tono y superficie (piso)`, () => {
    expect(medidas).toHaveLength(MEDIDAS_ESPERADAS);
    expect(reglasDeAviso(studioCss).size).toBeGreaterThanOrEqual(13);
  });

  it.each(TEMAS.flatMap((t) => TONOS.map((o) => [t, o] as const)))(
    "%s / %s: texto ≥ 4,5:1 e icono ≥ 3:1 sobre las tres superficies",
    (tema, tono) => {
      for (const m of medidas.filter((x) => x.tema === tema && x.tono === tono)) {
        expect(m.texto, `texto ${m.superficie}`).toBeGreaterThanOrEqual(4.5);
        expect(m.icono, `icono ${m.superficie}`).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("el texto de la franja es tinta neutra (BRAND §Estados)", () => {
    expect(prop(reglasDeAviso(studioCss).get(".studio-aviso"), "color")).toBe("var(--ink)");
  });

  it("cada tono tiene su fondo de estado y los cuatro son distintos", () => {
    const fondos = TONOS.map((t) => pintura(studioCss, "claro", t).fondo);
    expect(fondos).toEqual(["var(--info-bg)", "var(--warning-bg)", "var(--success-bg)", "var(--danger-bg)"]);
  });

  it("la franja es plana: sin contorno, sin sombra y sin colores literales", () => {
    expect(problemasDeForma(studioCss)).toEqual([]);
  });

  it("el dorado del icono de atención vive solo en pantalla oscura (al imprimir vuelve a claro)", () => {
    const r = reglasDeAviso(studioCss);
    expect(prop(r.get('@screen [data-theme="dark"] .studio-aviso[data-tono="atencion"] > svg'), "color")).toBe(
      "var(--warning)",
    );
    expect(r.has('[data-theme="dark"] .studio-aviso[data-tono="atencion"] > svg')).toBe(false);
  });

  it("Aviso y ErrorAlert no pintan color en línea", () => {
    for (const archivo of ["Aviso.tsx", "ErrorAlert.tsx"]) {
      const src = readFileSync(join(process.cwd(), "app/studio/_components/ui", archivo), "utf8");
      expect(src, archivo).not.toMatch(/style=\{\{/);
      expect(src, archivo).not.toMatch(/var\(--(danger|warning|success|info)/);
    }
    const errorAlert = readFileSync(join(process.cwd(), "app/studio/_components/ui/ErrorAlert.tsx"), "utf8");
    expect(errorAlert).toMatch(/<Aviso tono="error"/);
  });

  describe("mutantes: el contrato tiene que romperse", () => {
    it("M1 · el icono de atención en claro vuelve al dorado → falla el icono en claro", () => {
      const mutada = studioCss.replace(
        /(\.studio-aviso\[data-tono="atencion"\] > svg \{\s*color: )var\(--ink\)/,
        "$1var(--warning)",
      );
      expect(mutada).not.toBe(studioCss);
      const f = fallas(medir(mutada));
      expect(f).toContain("claro/atencion/--bg-surface");
      expect(f.every((x) => x.startsWith("claro/atencion/"))).toBe(true);
    });

    it("M2 · el texto de la franja pasa a tinta suave → falla el texto", () => {
      const mutada = studioCss.replace(
        /(\n\.studio-aviso \{[^}]*?color: )var\(--ink\)/,
        "$1var(--ink-mute)",
      );
      expect(mutada).not.toBe(studioCss);
      expect(fallas(medir(mutada)).length).toBeGreaterThan(0);
    });

    it("M3 · la franja gana contorno y sombra → falla la forma", () => {
      const mutada = studioCss
        .replace(/(\n\.studio-aviso \{[^}]*?)border: 0;/, "$1border: 1px solid var(--danger);")
        .replace(/(\n\.studio-aviso \{[^}]*?)box-shadow: none;/, "$1box-shadow: var(--shadow-sm);");
      expect(mutada).not.toBe(studioCss);
      expect(problemasDeForma(mutada)).toEqual(
        expect.arrayContaining(["la franja declara contorno", "la franja declara sombra"]),
      );
    });

    it("M4 · un color literal en un tono → falla la forma", () => {
      const mutada = studioCss.replace(
        /(\.studio-aviso\[data-tono="exito"\] \{\s*background: )var\(--success-bg\)/,
        "$1#E6F4EC",
      );
      expect(mutada).not.toBe(studioCss);
      expect(problemasDeForma(mutada)).toContain('color literal en .studio-aviso[data-tono="exito"]');
    });

    it("M5 · la excepción oscura de atención sale de @media screen → se detecta", () => {
      const mutada = studioCss.replace(/@media screen \{\s*(\[data-theme="dark"\] \.studio-aviso)/, "$1");
      expect(mutada).not.toBe(studioCss);
      expect(reglasDeAviso(mutada).has('[data-theme="dark"] .studio-aviso[data-tono="atencion"] > svg')).toBe(true);
    });
  });
});
