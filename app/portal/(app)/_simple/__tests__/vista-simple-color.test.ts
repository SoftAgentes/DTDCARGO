// @vitest-environment node
/**
 * SDD-0654 fase 2 · AC-17 y el color de la Vista simple.
 *
 *   · EXC-0654-01 cerrada (SDD-0686, Sam: «Portal: Vista simple A»,
 *     2026-11-22): el botón principal es azul de acción; el avatar y la parte
 *     «proveedor» del código van en tinta. El bloque `.vs` no nombra el vino.
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

describe("EXC-0654-01 cerrada (SDD-0686, Sam: «Portal: Vista simple A»)", () => {
  it("el botón principal es azul de acción y el avatar y la parte «proveedor», tinta", () => {
    const regla = (sel: string) => {
      const i = bloqueVs.indexOf(`${sel} {`);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      return bloqueVs.slice(i, bloqueVs.indexOf("}", i));
    };
    expect(regla(".vs .vs-btn-principal")).toMatch(/background: var\(--color-accion\);\s*color: var\(--color-on-accion\);/);
    expect(regla(".vs .vs-btn-principal:hover")).toContain("var(--color-accion-hover)");
    expect(regla(".vs .vs-avatar,\n.vs .vs-codigo-proveedor")).toMatch(/background: var\(--color-ink\);\s*color: var\(--color-paper\);/);
    expect(regla(".vs .vs-codigo-parte.vs-codigo-proveedor")).toContain("background: var(--color-ink);");
  });

  it("el bloque de la Vista simple ya no nombra el vino", () => {
    const codigo = bloqueVs.slice(0, bloqueVs.indexOf(".vs .vs-proveedor {")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codigo).not.toMatch(/wine/);
    expect(codigo).not.toMatch(/--vs-principal|--tint-wine/);
  });

  it("los pares del botón pasan AA en claro y en noche", () => {
    const oscuro = '[data-portal-theme="dark"]';
    expect(contraste(token("@theme", "--color-accion"), token("@theme", "--color-on-accion"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(token(oscuro, "--color-accion"), token(oscuro, "--color-on-accion"))).toBeGreaterThanOrEqual(4.5);
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
