import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Tipografía SDD-0505 (2026-10-13): las familias del Brand Book v5.0 —Archivo y
 * Archivo Black (marca), Sora y Nunito Sans (Studio/Portal, BD-035) y JetBrains
 * Mono (códigos)— se sirven desde `lib/font-files/` con `next/font/local`.
 * Motivo operativo: `next/font/google` baja las fuentes en cada `next build` y
 * ese día el build falló 5 veces entre GitHub y Vercel justo antes del corte al
 * servidor propio.
 *
 * Esta prueba es el candado: si alguien vuelve a importar `next/font/google`,
 * agrega una familia fuera de las cinco o desconecta Sora/Nunito del Studio y
 * el Portal, falla.
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

const ARCHIVOS = [
  "archivo-latin-wght.woff2",
  "archivo-black-latin-400.woff2",
  "sora-latin-wght.woff2",
  "nunito-sans-latin-wght.woff2",
  "jetbrains-mono-latin-wght.woff2",
];

describe("Tipografía SDD-0505 · fuentes servidas desde el repositorio", () => {
  it("ningún archivo de app/, lib/ ni components/ importa next/font/google", () => {
    const culpables = ["app", "lib", "components"]
      .flatMap((d) => fuentesDeCodigo(join(ROOT, d)))
      .filter((f) => /from\s+["']next\/font\/google["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(culpables).toEqual([]);
  });

  it("lib/fonts.ts carga solo las cinco fuentes locales, con los nombres de variable de siempre", () => {
    const fonts = readFileSync(join(ROOT, "lib/fonts.ts"), "utf8");
    const srcs = [...fonts.matchAll(/src:\s*"\.\/font-files\/([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(srcs)].sort()).toEqual([...ARCHIVOS].sort());
    for (const v of [
      "--font-archivo",
      "--font-archivo-black",
      "--font-sora",
      "--font-nunito",
      "--font-mono",
      "--font-jetbrains-mono",
    ]) {
      expect(fonts).toContain(`variable: "${v}"`);
    }
  });

  it("los cinco woff2 existen, son woff2 de verdad y su fila del README lleva su huella", () => {
    const filas = readFileSync(join(ROOT, "lib/font-files/README.md"), "utf8").split("\n");
    for (const nombre of ARCHIVOS) {
      const ruta = join(ROOT, "lib/font-files", nombre);
      const bytes = readFileSync(ruta);
      expect(bytes.subarray(0, 4).toString("latin1"), nombre).toBe("wOF2");
      expect(statSync(ruta).size, nombre).toBeLessThan(80_000);
      const huella = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const fila = filas.find((l) => l.startsWith(`| \`${nombre}\``)) ?? "";
      expect(fila, `${nombre} sin fila en la tabla del README`).not.toBe("");
      expect(fila, `la fila de ${nombre} no lleva su huella ${huella}`).toContain(huella);
    }
  });

  it("Studio y Portal montan Sora y Nunito Sans desde lib/fonts.ts", () => {
    for (const [layout, wrapper] of [
      ["app/studio/layout.tsx", "studio-sys"],
      ["app/portal/layout.tsx", "portal-sys"],
    ]) {
      const src = readFileSync(join(ROOT, layout), "utf8");
      expect(src, layout).toMatch(/import\s*\{\s*sora,\s*nunitoSans\s*\}\s*from\s*"@\/lib\/fonts"/);
      expect(src, layout).toContain(`\${sora.variable} \${nunitoSans.variable} ${wrapper}`);
    }
  });

  it("Studio, Portal y calculadora remapean la tipografía a Nunito Sans (cuerpo) y Sora (títulos)", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    const bloque = css.match(/\.portal-sys,\s*\.calc-sys,\s*\.studio-sys\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(bloque).not.toBe("");
    expect(bloque).toMatch(/--font-archivo:\s*var\(--font-nunito\)/);
    expect(bloque).toMatch(/--font-archivo-black:\s*var\(--font-sora\)/);
    expect(bloque).toMatch(/--font-sans:\s*var\(--font-nunito\)/);
    expect(bloque).toMatch(/font-family:\s*var\(--font-nunito\)/);
  });
});
