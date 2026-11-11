// @vitest-environment node
/**
 * Contrato SDD-0624: toda `page.tsx` de un módulo SENSIBLE (dinero, solo-admin
 * o gastos) llama ella misma a `requireModuleView` con el id de su módulo.
 *
 * Por qué no alcanza el layout: en el App Router un layout compartido no se
 * vuelve a ejecutar en la navegación parcial, así que una página que confía sólo
 * en el gate de su layout puede renderizarse sin pasarlo. Para los módulos
 * comunes queda la defensa de la RLS; para el dinero y la administración el
 * gate va pegado a la página.
 *
 * El módulo de cada página sale de la ruta (`moduleIdForPath`), no de una lista
 * a mano: una página nueva entra sola al contrato.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { LOCKED_MODULES, moduleIdForPath } from "@/lib/studio/rbac";

const RAIZ = join(process.cwd(), "app", "studio", "(app)");

/** Módulos cuyas páginas deben llevar el gate propio. */
const SENSIBLES: ReadonlySet<string> = new Set([...LOCKED_MODULES, "expenses"]);

/**
 * Páginas que NO llevan `requireModuleView` a propósito, con la razón
 * verificada. Mantenerla corta.
 */
const EXCEPCIONES: Record<string, string> = {
  "legal/expediente/[code]/page.tsx":
    "Usa su propio candado: la capability `view_defense_file` (commercial + support + admin), no la fila del módulo legal.",
};

function paginas(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__" || nombre === "node_modules") continue;
      out.push(...paginas(ruta));
    } else if (nombre === "page.tsx") {
      out.push(ruta);
    }
  }
  return out;
}

/** `app/studio/(app)/contabilidad/x/page.tsx` → `/studio/contabilidad/x`. */
function slugDe(rel: string): string {
  const partes = rel.split(sep).slice(0, -1).filter((p) => !/^\(.*\)$/.test(p));
  return "/studio" + (partes.length ? "/" + partes.join("/") : "");
}

describe("SDD-0624 · páginas sensibles con gate propio", () => {
  const todas = paginas(RAIZ).map((abs) => {
    const rel = relative(RAIZ, abs);
    return { abs, rel: rel.split(sep).join("/"), modulo: moduleIdForPath(slugDe(rel)) };
  });
  const sensibles = todas.filter((p) => p.modulo && SENSIBLES.has(p.modulo));

  it("encuentra páginas sensibles (piso: el contrato mira algo)", () => {
    // Al 2026-11-11 pasan de 25. Si baja de 20, el recorrido dejó de verlas.
    expect(sensibles.length).toBeGreaterThanOrEqual(20);
  });

  it("cada página sensible llama requireModuleView con su módulo", () => {
    const faltan = sensibles
      .filter((p) => !(p.rel in EXCEPCIONES))
      .filter((p) => {
        // Sin comentarios: un `// requireModuleView("x")` no es un gate.
        const src = readFileSync(p.abs, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        return !src.includes(`await requireModuleView("${p.modulo}")`);
      })
      .map((p) => `${p.rel} → requireModuleView("${p.modulo}")`);
    expect(faltan).toEqual([]);
  });

  it("las excepciones siguen existiendo (no quedan entradas muertas)", () => {
    const rels = new Set(todas.map((p) => p.rel));
    expect(Object.keys(EXCEPCIONES).filter((r) => !rels.has(r))).toEqual([]);
  });
});
