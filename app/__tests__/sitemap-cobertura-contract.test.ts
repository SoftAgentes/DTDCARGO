/**
 * Contrato de cobertura del sitemap.
 *
 * Una página pública indexable que no está en `app/sitemap.ts` es una página
 * que Google puede tardar meses en descubrir, o no descubrir nunca. Pasó con
 * `/servicios/{puerta-a-puerta,fcl,lcl}` y `/llenado`: existen, tienen
 * metadata y OpenGraph, ningún `noindex`… y no estaban. `/servicios/inspeccion`
 * sí estaba, lo que hacía el hueco todavía más fácil de no ver.
 *
 * La regla: toda `page.tsx` pública sin `noindex` y sin `Disallow` en
 * `robots.ts` tiene que aparecer en el sitemap.
 *
 * NO cubre rutas dinámicas (`[slug]`): el sitemap las genera desde la base
 * (posts, geo-zonas) y eso no se puede verificar leyendo archivos.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const APP = join(RAIZ, "app");

/** Segmentos raíz que NO son el sitio público. */
const PRIVADAS = new Set([
  "studio",
  "api",
  "portal",
  "m",
  "back",
  "invitar",
  "interno",
  "p", // packing list por token
  "track", // noindex deliberado (ver robots.ts)
]);

function paginas(dir: string, base = ""): { ruta: string; abs: string }[] {
  const out: { ruta: string; abs: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const abs = join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...paginas(abs, rel));
    else if (e.name === "page.tsx") out.push({ ruta: `/${base}`, abs });
  }
  return out;
}

describe("Cobertura del sitemap", () => {
  const sitemap = readFileSync(join(APP, "sitemap.ts"), "utf8");
  const robots = readFileSync(join(APP, "robots.ts"), "utf8");

  // Prefijos bloqueados en robots.txt (match por prefijo, como el estándar).
  const bloqueados = [...robots.matchAll(/"(\/[a-z0-9/-]*)"/g)]
    .map((m) => m[1])
    .filter((p) => p !== "/");

  const publicas = paginas(APP)
    .filter((p) => {
      const raiz = p.ruta.replace(/^\//, "").split("/")[0];
      return raiz !== "" && !PRIVADAS.has(raiz);
    })
    // Dinámicas: el sitemap las genera desde la base, no desde el disco.
    .filter((p) => !p.ruta.includes("["))
    // Bloqueadas en robots: no deben estar en el sitemap.
    .filter((p) => !bloqueados.some((b) => p.ruta.startsWith(b)));

  it("hay páginas públicas que auditar (sanity)", () => {
    expect(publicas.length).toBeGreaterThan(10);
  });

  it("toda página pública indexable está en el sitemap", () => {
    const faltan: string[] = [];
    for (const p of publicas) {
      const src = readFileSync(p.abs, "utf8");
      // `noindex` explícito = exclusión deliberada, no hueco.
      if (/noindex|index:\s*false/.test(src)) continue;
      if (!sitemap.includes(`${p.ruta}\``) && !sitemap.includes(`${p.ruta}"`)) {
        faltan.push(p.ruta);
      }
    }
    expect(
      faltan,
      `Estas páginas son públicas, no tienen noindex y no están en ` +
        `app/sitemap.ts: ${faltan.join(", ")}. O las agregás al sitemap, o ` +
        `les ponés \`robots: { index: false }\` si no querés que se indexen. ` +
        `Quedar afuera de las dos listas es el estado que nadie eligió.`,
    ).toEqual([]);
  });

  it("ninguna página con noindex está en el sitemap", () => {
    // El error espejo: pedirle a Google que rastree algo que le decimos que
    // no indexe. Señal contradictoria.
    const contradictorias: string[] = [];
    for (const p of publicas) {
      const src = readFileSync(p.abs, "utf8");
      if (!/noindex|index:\s*false/.test(src)) continue;
      if (sitemap.includes(`${p.ruta}\``) || sitemap.includes(`${p.ruta}"`)) {
        contradictorias.push(p.ruta);
      }
    }
    expect(
      contradictorias,
      `Están en el sitemap Y marcadas noindex: ${contradictorias.join(", ")}.`,
    ).toEqual([]);
  });
});
