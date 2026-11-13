import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/** Recorre app/studio entero: bajo carga, la lectura supera el límite global de 20 s. */
vi.setConfig({ testTimeout: 120_000 });

/**
 * Contrato de SDD-0603, tramo de pestañas: una sola forma visual en el Studio.
 * El CRM queda fuera hasta que terminen las tandas de Chatwoot; se quita de esta lista
 * al migrarlo.
 *
 * Cada comprobación mira etiqueta por etiqueta, no archivo por archivo: un archivo con
 * dos `tablist` no pasa porque solo uno tenga la clase. Cada una lleva un piso, porque
 * una búsqueda que no encuentra nada también daría verde.
 */
const PENDIENTES = ["app/studio/(app)/crm/"];

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") fuentes(rel, acc);
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      acc.push(rel);
    }
  }
  return acc;
}

/** La etiqueta JSX de apertura que contiene la posición `i`, respetando llaves y comillas. */
function etiquetaEn(s: string, i: number): string {
  const inicio = s.lastIndexOf("<", i);
  let llaves = 0;
  let comilla: string | null = null;
  for (let k = inicio + 1; k < s.length; k++) {
    const c = s[k];
    if (comilla) {
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") comilla = c;
    else if (c === "{") llaves++;
    else if (c === "}") llaves--;
    else if (c === ">" && llaves === 0) return s.slice(inicio, k + 1);
  }
  return s.slice(inicio);
}

interface Etiqueta {
  archivo: string;
  texto: string;
}

function etiquetasCon(archivo: string, s: string, marca: string): Etiqueta[] {
  const out: Etiqueta[] = [];
  for (let i = s.indexOf(marca); i !== -1; i = s.indexOf(marca, i + 1)) {
    out.push({ archivo, texto: etiquetaEn(s, i) });
  }
  return out;
}

const archivos = fuentes("app/studio").filter((f) => !PENDIENTES.some((p) => f.startsWith(p)));
const tablists: Etiqueta[] = [];
const contenedores: Etiqueta[] = [];
const pestanasFormales: Etiqueta[] = [];
const pestanas: Etiqueta[] = [];
for (const archivo of archivos) {
  const s = readFileSync(join(process.cwd(), archivo), "utf8");
  tablists.push(...etiquetasCon(archivo, s, 'role="tablist"'));
  contenedores.push(...etiquetasCon(archivo, s, 'className="studio-tabs"'));
  pestanasFormales.push(...etiquetasCon(archivo, s, 'role="tab"'));
  pestanas.push(...etiquetasCon(archivo, s, 'className="studio-tab"'));
}

describe("pestañas · SDD-0603", () => {
  it("cada tablist del Studio usa la clase única", () => {
    expect(tablists.length).toBeGreaterThanOrEqual(25);
    const sinClase = tablists.filter((e) => !e.texto.includes('className="studio-tabs"')).map((e) => e.archivo);
    expect(sinClase).toEqual([]);
  });

  it("cada pestaña formal usa su clase, sin estilo en línea", () => {
    expect(pestanasFormales.length).toBeGreaterThanOrEqual(25);
    const sueltas = pestanasFormales
      .filter((e) => !e.texto.includes('className="studio-tab"') || /\bstyle=/.test(e.texto))
      .map((e) => e.archivo);
    expect(sueltas).toEqual([]);
  });

  it("los grupos hechos a mano son role=group con nombre, y sus botones llevan aria-pressed", () => {
    const grupos = contenedores.filter((e) => e.texto.includes('role="group"'));
    expect(grupos.length).toBeGreaterThanOrEqual(12);
    // Todo contenedor declara qué es y cómo se llama.
    const sinRol = contenedores
      .filter((e) => !/role="(tablist|group)"/.test(e.texto) && !e.texto.startsWith("<nav"))
      .map((e) => e.archivo);
    expect(sinRol).toEqual([]);
    const sinNombre = contenedores.filter((e) => !/aria-label(ledby)?=/.test(e.texto)).map((e) => e.archivo);
    expect(sinNombre).toEqual([]);
    // Toda pestaña anuncia su estado: tab, botón presionado o enlace actual.
    const presionadas = pestanas.filter((e) => e.texto.includes("aria-pressed="));
    expect(presionadas.length).toBeGreaterThanOrEqual(12);
    const sinEstado = pestanas
      .filter((e) => !/role="tab"|aria-pressed=|aria-current=/.test(e.texto))
      .map((e) => e.archivo);
    expect(sinEstado).toEqual([]);
    const conEstilo = pestanas.filter((e) => /\bstyle=/.test(e.texto)).map((e) => e.archivo);
    expect(conEstilo).toEqual([]);
  });

  it("el foco se ve también en la pestaña activa (WCAG 2.4.7)", () => {
    const css = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8");
    const regla = /\.studio-tab:focus-visible\s*\{([^}]*)\}/.exec(css);
    expect(regla).not.toBeNull();
    const cuerpo = regla![1];
    // La activa va rellena con --ink, y el anillo es --info (= --ink): tiene que ir por
    // fuera del relleno, separado, para que se vea.
    const offset = /outline-offset:\s*(-?\d+(?:\.\d+)?)px/.exec(cuerpo);
    expect(offset).not.toBeNull();
    expect(Number(offset![1])).toBeGreaterThanOrEqual(2);
    expect(cuerpo).toMatch(/outline:\s*2px solid var\(--/);
    // Nada lo apaga en la activa.
    expect(css).not.toMatch(/\.studio-tab\[data-activa="true"\][^{]*:focus-visible\s*\{[^}]*outline:\s*(none|0)/);
  });
});

describe("etiquetaEn", () => {
  it("cierra la etiqueta después de las llaves y comillas", () => {
    const s = `<div role="group" style={{ a: x > 1 ? "b>" : 2 }} className="studio-tabs">hijo</div>`;
    expect(etiquetaEn(s, s.indexOf("role"))).toBe(s.slice(0, s.indexOf("hijo")));
  });

  it("dos tablist en un archivo se miran por separado", () => {
    const s = `<div role="tablist" className="studio-tabs"></div>\n<div role="tablist" className="x"></div>`;
    const ts = etiquetasCon("f.tsx", s, 'role="tablist"');
    expect(ts.map((t) => t.texto.includes('className="studio-tabs"'))).toEqual([true, false]);
  });
});
