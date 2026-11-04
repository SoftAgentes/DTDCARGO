import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/** Recorre app/studio entero: bajo carga, la lectura supera el límite global de 20 s. */
vi.setConfig({ testTimeout: 120_000 });

/**
 * Contrato de SDD-0603, tramo de pestañas: una sola forma visual en el Studio.
 * El CRM queda fuera hasta que terminen las tandas de Chatwoot; se quita de esta lista
 * al migrarlo.
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

const archivos = fuentes("app/studio").filter((f) => !PENDIENTES.some((p) => f.startsWith(p)));

describe("pestañas · SDD-0603", () => {
  it("todo tablist del Studio usa la clase única", () => {
    const sinClase = archivos.filter((f) => {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      return s.includes('role="tablist"') && !s.includes('className="studio-tabs"');
    });
    expect(sinClase).toEqual([]);
  });

  it("toda pestaña formal usa su clase, sin estilo en línea", () => {
    const etiquetas: { archivo: string; texto: string }[] = [];
    for (const archivo of archivos) {
      const s = readFileSync(join(process.cwd(), archivo), "utf8");
      for (let i = s.indexOf('role="tab"'); i !== -1; i = s.indexOf('role="tab"', i + 1)) {
        const inicio = Math.max(s.lastIndexOf("<button", i), s.lastIndexOf("<Link", i), s.lastIndexOf("<a ", i));
        const cierre = s.slice(i).search(/\n\s*>/);
        etiquetas.push({ archivo, texto: s.slice(inicio, cierre < 0 ? i + 400 : i + cierre) });
      }
    }
    // Sin este piso, una búsqueda que no encuentra nada también daría verde.
    expect(etiquetas.length).toBeGreaterThanOrEqual(25);
    const sueltas = etiquetas
      .filter((e) => !e.texto.includes('className="studio-tab"') || /\bstyle=/.test(e.texto))
      .map((e) => e.archivo);
    expect(sueltas).toEqual([]);
  });
});
