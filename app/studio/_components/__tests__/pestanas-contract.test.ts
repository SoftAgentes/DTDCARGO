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
    const sueltas: string[] = [];
    for (const f of archivos) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      for (const m of s.matchAll(/<button\b(?:(?!>\s*\n?\s*[{\w<]).)*?role="tab"[\s\S]*?>/g)) {
        if (!m[0].includes('className="studio-tab"') || /\bstyle=/.test(m[0])) sueltas.push(f);
      }
    }
    expect(sueltas).toEqual([]);
  });
});
