// @vitest-environment node
/**
 * SDD-0654 fase 2 · AC-17 y EXC-0654-01: el color de la Vista simple.
 *
 *   · El vino claro (`--vs-principal-bg`) solo pinta sus tres usos: botón
 *     principal, avatar y parte «proveedor» del código. Su texto es siempre
 *     `--on-warning` (#0F1E3D) y pasa AA en claro y en noche.
 *   · Ningún archivo de la Vista simple usa `--color-wine)` ni el rojo de error
 *     (`--color-status-danger`), ni hex sueltos.
 *   · El dorado (`--color-status-warning`) no aparece en los componentes: solo
 *     llega por la franja «Atención» de `.portal-aviso`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");
const globals = leer("app/globals.css");

function hex(valor: string): [number, number, number] {
  const h = valor.replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function luminancia([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(hex(a)), luminancia(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** El valor de un token dentro del primer bloque cuya cabecera es exacta. */
function token(cabecera: string, nombre: string): string {
  const i = globals.indexOf(`${cabecera} {`);
  expect(i, `falta el bloque ${cabecera}`).toBeGreaterThanOrEqual(0);
  const bloque = globals.slice(i, globals.indexOf("}", i));
  const m = new RegExp(`${nombre}:\\s*([^;]+);`).exec(bloque);
  expect(m, `falta ${nombre} en ${cabecera}`).not.toBeNull();
  return m![1].trim();
}

/** El bloque CSS de la Vista simple (desde su cabecera hasta el final del archivo). */
const bloqueVs = globals.slice(globals.indexOf("SDD-0654 fase 2 · Vista simple del portal"));

describe("EXC-0654-01 · vino claro con texto navy", () => {
  it("los tokens de la Vista simple apuntan a los de la marca", () => {
    expect(token(".vs", "--vs-principal-bg")).toBe("var(--color-wine-soft)");
    expect(token(".vs", "--vs-principal-ink")).toBe("var(--on-warning)");
    expect(token('[data-portal-theme="dark"] .vs', "--vs-principal-bg")).toBe("var(--color-wine-text)");
  });

  it("pasa AA en claro (4,79:1) y en noche (7,13:1)", () => {
    const navy = token(":root", "--on-warning");
    const vinoClaro = token("@theme", "--color-wine-soft");
    const vinoNoche = token('[data-portal-theme="dark"]', "--color-wine-text");
    expect(navy.toLowerCase()).toBe("#0f1e3d");
    expect(contraste(vinoClaro, navy)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(vinoNoche, navy)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(vinoClaro, navy)).toBeCloseTo(4.79, 1);
    expect(contraste(vinoNoche, navy)).toBeCloseTo(7.13, 1);
    // Por qué no `--color-ink`: en noche es crema y no llega.
    expect(contraste(vinoNoche, token('[data-portal-theme="dark"]', "--color-ink"))).toBeLessThan(4.5);
  });

  it("el vino claro solo pinta sus tres usos", () => {
    const selectores = [...bloqueVs.matchAll(/([^{}]+)\{([^}]*var\(--vs-principal-bg\)[^}]*)\}/g)]
      .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim())
      .filter((sel) => !/^\.vs$|^\[data-portal-theme="dark"\] \.vs$/.test(sel));
    const usos = selectores.flatMap((s) => s.split(",").map((x) => x.trim()));
    expect(usos.sort()).toEqual(
      [".vs .vs-avatar", ".vs .vs-btn-principal", ".vs .vs-codigo-parte.vs-codigo-proveedor", ".vs .vs-codigo-proveedor"].sort(),
    );
    // Y donde pinta, el texto es el navy fijo.
    for (const m of bloqueVs.matchAll(/\{([^}]*background:\s*var\(--vs-principal-bg\)[^}]*)\}/g)) {
      expect(m[1]).toMatch(/color:\s*var\(--vs-principal-ink\)/);
    }
  });

  it("la selección va en tinta, nunca en vino claro", () => {
    for (const sel of [".vs .vs-codigo-parte[aria-pressed=\"true\"]", ".vs .vs-proveedor.vs-proveedor-activo"]) {
      const i = bloqueVs.indexOf(`${sel} {`);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      const regla = bloqueVs.slice(i, bloqueVs.indexOf("}", i));
      expect(regla).toMatch(/var\(--color-ink\)/);
      expect(regla).not.toMatch(/wine/);
    }
  });
});

describe("AC-17 · los componentes de la Vista simple", () => {
  const dir = "app/portal/(app)/_simple";
  const archivos = readdirSync(join(raiz, dir)).filter((f) => f.endsWith(".tsx"));

  it("hay componentes que revisar", () => {
    expect(archivos.length).toBeGreaterThanOrEqual(6);
  });

  it.each(archivos)("%s no usa vino de acción, rojo de error, dorado ni hex sueltos", (archivo) => {
    const codigo = leer(`${dir}/${archivo}`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/--color-wine\)/);
    expect(codigo).not.toMatch(/--color-wine-deep/);
    expect(codigo).not.toMatch(/--color-status-danger|--danger/);
    expect(codigo).not.toMatch(/--color-status-warning|--warning/);
    expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo).not.toMatch(/\bbg-wine\b|\btext-wine\b|btn-primary/);
  });
});
