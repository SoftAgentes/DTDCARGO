/**
 * Anti-drift de RBAC · SUB-RUTAS (complemento de `rbac-view-guard.test.ts`).
 *
 * El test hermano verifica que cada módulo de `MODULES` tenga gate de vista, y
 * acepta que lo tenga en su `page.tsx`. Pero **un `page.tsx` no envuelve a sus
 * hijos**: sólo un `layout.tsx` cubre el subtree. Así quedaron abiertas
 * `clientes/[markbox]` (PII del cliente), `tracking/nuevo` (alta de embarques),
 * `tracking/[id]`, `cotizador/[code]` y `cola-qr/[id]/imprimir` mientras sus
 * páginas raíz sí estaban gateadas — el sidebar escondía el link, pero tipear la
 * URL entraba.
 *
 * Este test cierra ese hueco: toda `page.tsx` MÁS PROFUNDA que la raíz de su
 * módulo tiene que estar cubierta por un `layout.tsx` con gate en algún
 * ancestro, o llamar ella misma a `requireModuleView`.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STUDIO_APP = join(process.cwd(), "app", "studio", "(app)");

/** Rutas sin nada que proteger: redirects puros. */
const SIN_CONTENIDO = new Set(["page.tsx", "resumen/page.tsx"]);

function paginas(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(STUDIO_APP, dir || "."), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...paginas(join(dir, e.name), rel));
    else if (e.name === "page.tsx") out.push(rel);
  }
  return out;
}

/** ¿Algún layout.tsx ancestro (o la propia página) tiene gate? */
function cubierta(relPage: string): boolean {
  const segs = relPage.split("/").slice(0, -1); // sin "page.tsx"
  const propia = join(STUDIO_APP, ...segs, "page.tsx");
  if (existsSync(propia) && readFileSync(propia, "utf8").includes("requireModuleView(")) {
    return true;
  }
  for (let d = segs.length; d >= 0; d--) {
    const lay = join(STUDIO_APP, ...segs.slice(0, d), "layout.tsx");
    if (existsSync(lay) && readFileSync(lay, "utf8").includes("requireModuleView(")) return true;
  }
  return false;
}

describe("RBAC anti-drift · sub-rutas cubiertas por un layout (SDD-0085)", () => {
  const subrutas = paginas("").filter((p) => {
    if (SIN_CONTENIDO.has(p)) return false;
    return p.split("/").length > 2; // más profunda que "<modulo>/page.tsx"
  });

  it("hay sub-rutas que auditar (sanity)", () => {
    expect(subrutas.length).toBeGreaterThan(5);
  });

  for (const p of subrutas) {
    it(`${p} está cubierta por un gate`, () => {
      if (!cubierta(p)) {
        const modulo = p.split("/")[0];
        throw new Error(
          `La sub-ruta "${p}" no tiene gate de vista. Su módulo puede estar gateado ` +
            `en page.tsx, pero un page.tsx NO envuelve a sus hijos: cualquier rol ` +
            `entra tipeando la URL. Creá app/studio/(app)/${modulo}/layout.tsx con ` +
            `requireModuleView("<id>") — patrón cobranzas/layout.tsx.`,
        );
      }
    });
  }
});
