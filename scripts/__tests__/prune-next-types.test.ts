// @vitest-environment node
/**
 * SDD-0281 · El podador de tipos de ruta generados.
 *
 * Lo que se prueba de verdad es la DISCRIMINACIÓN, no el borrado: un podador
 * que arrasa siempre "arregla" el gate y de paso apaga la validación de params
 * de ruta que `tsconfig.json` compra al incluir `.next/**\/types`. Por eso cada
 * caso se monta con un árbol REAL en disco y se verifica la mutación: el árbol
 * enfermo desaparece, el sano sobrevive intacto.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { podarTiposDeRuta, notaDePoda } from "../prune-next-types.mjs";

let raiz: string;

/** Monta `<raiz>/<rel>` con un `validator.ts` que importa `apuntaA`. */
function montarArbolDeTipos(rel: string, apuntaA: string) {
  const dir = path.join(raiz, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "validator.ts"),
    `const handler = {} as typeof import("${apuntaA}.js")\nexport type X = typeof handler\n`,
    "utf8",
  );
  return dir;
}

/** Crea el fuente de una ruta real (`app/…/page.tsx`) bajo la raíz temporal. */
function montarPagina(rel: string) {
  const p = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "export default function P() { return null }\n", "utf8");
}

beforeEach(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), "dtd-poda-"));
});

afterEach(() => {
  fs.rmSync(raiz, { recursive: true, force: true });
});

describe("podarTiposDeRuta", () => {
  it("poda el árbol que importa una ruta que ya no existe en disco", () => {
    // El caso real: SDD-0276 borró app/portal/(auth)/login/page.tsx y el
    // validator.ts generado siguió importándola.
    const dir = montarArbolDeTipos(
      path.join(".next", "types"),
      "../../app/portal/(auth)/login/page",
    );

    const r = podarTiposDeRuta({ raiz });

    expect(r.podados).toEqual([path.join(".next", "types")]);
    expect(fs.existsSync(dir)).toBe(false);
    expect(notaDePoda(r)).toContain("app/portal/(auth)/login/page");
  });

  it("NO toca el árbol cuyas rutas siguen existiendo", () => {
    montarPagina(path.join("app", "portal", "envios", "page.tsx"));
    const dir = montarArbolDeTipos(
      path.join(".next", "types"),
      "../../app/portal/envios/page",
    );

    const r = podarTiposDeRuta({ raiz });

    expect(r.podados).toEqual([]);
    expect(r.hallazgos).toEqual([]);
    expect(notaDePoda(r)).toBeNull();
    // La mutación que importa: el archivo sigue ahí, byte por byte.
    expect(fs.existsSync(path.join(dir, "validator.ts"))).toBe(true);
  });

  it("distingue los dos árboles: poda el del build y deja el del dev", () => {
    montarPagina(path.join("app", "portal", "envios", "page.tsx"));
    const build = montarArbolDeTipos(
      path.join(".next", "types"),
      "../../app/portal/(auth)/login/page",
    );
    const dev = montarArbolDeTipos(
      path.join(".next", "dev", "types"),
      "../../../app/portal/envios/page",
    );

    const r = podarTiposDeRuta({ raiz });

    expect(r.podados).toEqual([path.join(".next", "types")]);
    expect(fs.existsSync(build)).toBe(false);
    expect(fs.existsSync(dev)).toBe(true);
  });

  it("acepta cualquier extensión con la que Next materialice el `.js`", () => {
    // Un `route.ts` (API) resuelve igual que un `page.tsx`.
    montarPagina(path.join("app", "api", "ping", "route.ts"));
    montarArbolDeTipos(path.join(".next", "types"), "../../app/api/ping/route");

    expect(podarTiposDeRuta({ raiz }).podados).toEqual([]);
  });

  it("con `soloReportar` denuncia sin borrar", () => {
    const dir = montarArbolDeTipos(
      path.join(".next", "types"),
      "../../app/portal/(auth)/login/page",
    );

    const r = podarTiposDeRuta({ raiz, soloReportar: true });

    expect(r.hallazgos).toHaveLength(1);
    expect(r.podados).toEqual([]);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("no explota si no hay árboles generados todavía", () => {
    expect(podarTiposDeRuta({ raiz })).toEqual({ podados: [], hallazgos: [] });
  });
});
