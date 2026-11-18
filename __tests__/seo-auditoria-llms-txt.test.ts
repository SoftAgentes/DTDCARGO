// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auditoría SEO, GEO y AEO del 2026-11-07.
 *
 * Lighthouse 13.6 (PageSpeed Insights, categoría «Navegación con agentes») marcó
 * `llms.txt` como «no sigue las recomendaciones: el archivo no contiene ningún
 * vínculo». El estándar llms.txt pide un H1 y enlaces en formato Markdown
 * (`- [nombre](url)`); el archivo traía las URL sueltas.
 *
 * Además, cada enlace tiene que llevar a una ruta que exista en `app/` o en
 * `public/`: un llms.txt con enlaces rotos manda a los motores de IA a un 404.
 */

const root = process.cwd();
const llms = readFileSync(join(root, "public", "llms.txt"), "utf8");
const lineas = llms.split(/\r?\n/);
const LINK = /\[([^\]]+)\]\((https:\/\/dtdcargo\.com[^)\s]*)\)/g;

/** Rutas públicas de `app/`, sin grupos `(x)` ni rutas dinámicas. */
function rutasApp(): Set<string> {
  const rutas = new Set<string>();
  const walk = (dir: string, ruta: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name.startsWith("_") || e.name === "__tests__" || e.name.startsWith("[")) continue;
        const seg = e.name.startsWith("(") ? "" : `/${e.name}`;
        walk(`${dir}/${e.name}`, ruta + seg);
      } else if (/^(page\.tsx|route\.ts)$/.test(e.name)) {
        rutas.add(ruta || "/");
      }
    }
  };
  walk("app", "");
  return rutas;
}

describe("public/llms.txt sigue el formato del estándar", () => {
  it("empieza con un H1", () => {
    expect(lineas[0]).toMatch(/^# \S/);
  });

  it("los enlaces van en formato Markdown, no como URL sueltas", () => {
    const links = [...llms.matchAll(LINK)];
    // Piso: con cero coincidencias esta prueba no puede salir verde.
    expect(links.length).toBeGreaterThanOrEqual(10);
    const sinLinks = llms.replace(LINK, "");
    expect(sinLinks).not.toMatch(/https?:\/\/\S+/);
  });

  it("cada enlace lleva a una ruta que existe", () => {
    const rutas = rutasApp();
    const rotos = [...llms.matchAll(LINK)]
      .map((m) => new URL(m[2]).pathname)
      .filter((p) => !rutas.has(p) && !existsSync(join(root, "public", p)));
    expect(rutas.size).toBeGreaterThan(20);
    expect(rotos).toEqual([]);
  });
});
