import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Tipografía SDD-0505 (decisión de Sam 2026-10-13): el sitio usa solo Archivo,
 * Archivo Black y JetBrains Mono, servidas desde `lib/font-files/` con
 * `next/font/local`. Motivo operativo: `next/font/google` baja las fuentes en
 * cada `next build` y ese día el build falló 5 veces entre GitHub y Vercel
 * justo antes del corte al servidor propio.
 *
 * Esta prueba es el candado: si alguien vuelve a importar `next/font/google`
 * (o agrega una familia fuera de las tres), falla.
 */

const ROOT = process.cwd();

function fuentesDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "__tests__") return [];
      return fuentesDeCodigo(p);
    }
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const ARCHIVOS = ["archivo-latin-wght.woff2", "archivo-black-latin-400.woff2", "jetbrains-mono-latin-wght.woff2"];

describe("Tipografía SDD-0505 · fuentes servidas desde el repositorio", () => {
  it("ningún archivo de app/, lib/ ni components/ importa next/font/google", () => {
    const culpables = ["app", "lib", "components"]
      .flatMap((d) => fuentesDeCodigo(join(ROOT, d)))
      .filter((f) => /from\s+["']next\/font\/google["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(culpables).toEqual([]);
  });

  it("lib/fonts.ts carga solo las tres fuentes locales, con los nombres de variable de siempre", () => {
    const fonts = readFileSync(join(ROOT, "lib/fonts.ts"), "utf8");
    const srcs = [...fonts.matchAll(/src:\s*"\.\/font-files\/([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(srcs)].sort()).toEqual([...ARCHIVOS].sort());
    for (const v of ["--font-archivo", "--font-archivo-black", "--font-mono", "--font-jetbrains-mono"]) {
      expect(fonts).toContain(`variable: "${v}"`);
    }
  });

  it("los tres woff2 existen, son woff2 de verdad y coinciden con la huella del README", () => {
    const readme = readFileSync(join(ROOT, "lib/font-files/README.md"), "utf8");
    for (const nombre of ARCHIVOS) {
      const ruta = join(ROOT, "lib/font-files", nombre);
      const bytes = readFileSync(ruta);
      expect(bytes.subarray(0, 4).toString("latin1"), nombre).toBe("wOF2");
      expect(statSync(ruta).size, nombre).toBeLessThan(80_000);
      const huella = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      expect(readme, `${nombre} sin su huella ${huella} en el README`).toContain(huella);
    }
  });

  it("Studio, Portal y calculadora ya no remapean la tipografía a Sora/Nunito", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    const bloque = css.match(/\.portal-sys,\s*\.calc-sys,\s*\.studio-sys\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(bloque).not.toBe("");
    expect(bloque).not.toMatch(/--font-sora|--font-nunito|Nunito|Sora/);
    expect(bloque).not.toMatch(/--font-archivo(-black)?\s*:/);
  });
});
