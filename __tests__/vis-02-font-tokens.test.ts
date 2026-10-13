import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


const ROOT = process.cwd();

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

function tokenValues(css: string, token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}:\\s*([^;]+);`, "g"))].map(
    (match) => match[1].trim(),
  );
}

/**
 * SDD-0486, seguimiento: lectura en paralelo con tope, como en
 * `invoice-read-boundary`. Acá no hay parseo, así que el ahorro es del
 * paralelismo: los ~700 archivos de `app/` se leían uno por uno.
 */
async function leerTodos(rutas: string[], tope = 32): Promise<string[]> {
  const textos = new Array<string>(rutas.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: tope }, async () => {
      while (siguiente < rutas.length) {
        const i = siguiente++;
        textos[i] = await readFile(rutas[i], "utf8");
      }
    }),
  );
  return textos;
}

function appSourceFiles(directory = join(ROOT, "app")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(path);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("SDD-0175 Gate V1 · fuentes chinas", () => {
  // Tipografía SDD-0505 (decisión de Sam 2026-10-13): el chino ya no descarga Noto
  // SC; las variables apuntan a las fuentes CJK del sistema. Se conservan los
  // nombres (--font-noto-sc / --font-noto-serif-sc) para no tocar consumidores.
  it("el chino usa fuentes del sistema: html.dtd-cjk-sistema define las dos variables", () => {
    const layout = read("app/layout.tsx");
    const css = read("app/globals.css");
    const bloque = css.match(/html\.dtd-cjk-sistema\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(layout).toContain("dtd-cjk-sistema");
    expect(layout).not.toMatch(/Noto_Sans_SC|Noto_Serif_SC/);

    const sans = tokenValues(bloque, "--font-noto-sc")[0] ?? "";
    const serif = tokenValues(bloque, "--font-noto-serif-sc")[0] ?? "";
    // Sistemas reales primero (macOS/iOS, Windows, Android) y un genérico al final.
    expect(sans).toMatch(/^"PingFang SC"/);
    expect(sans).toContain('"Microsoft YaHei"');
    expect(sans).toContain('"Noto Sans CJK SC"');
    expect(sans).toMatch(/sans-serif$/);
    expect(serif).toContain('"SimSun"');
    expect(serif).toContain('"Noto Serif CJK SC"');
    expect(serif).toMatch(/serif$/);
    // Sin autorreferencia: un var(--font-noto-sc) aquí sería un ciclo inválido.
    expect(bloque).not.toContain("var(");
  });

  it.each([
    "app/globals.css",
    "app/studio/tokens.css",
  ])("%s separa UI y documento con fallback seguro", (path) => {
    const css = read(path);
    const ui = tokenValues(css, "--f-cn-ui")[0];
    const document = tokenValues(css, "--f-cn-document")[0];

    expect(ui).toContain("var(--font-noto-sc)");
    expect(ui).toContain("Noto Sans SC");
    expect(document).toContain("var(--font-noto-serif-sc)");
    expect(document).toContain("Noto Serif SC");
    expect(document).toContain("var(--font-noto-sc)");
    expect(document).toContain("Noto Sans SC");
    expect(document.indexOf("Noto Serif SC")).toBeLessThan(
      document.indexOf("Noto Sans SC"),
    );
  });

  it.each([
    "app/globals.css",
    "app/studio/tokens.css",
    "app/prealertas.css",
    "app/recursos.css",
  ])("%s mantiene --f-cn como alias exclusivo de UI", (path) => {
    const aliases = tokenValues(read(path), "--f-cn");

    expect(aliases.length).toBeGreaterThan(0);
    expect(aliases).toEqual(aliases.map(() => "var(--f-cn-ui)"));
  });

  it("mantiene la UI china en Noto Sans SC fuera de consumidores formales", async () => {
    const allowedDefinitions = new Set([
      "app/globals.css",
      "app/layout.tsx",
      "app/studio/tokens.css",
    ]);
    const formalDocumentConsumers = new Set([
      "app/p/[token]/PackingListFormSection.tsx",
    ]);
    const rutas = appSourceFiles();
    const textos = await leerTodos(rutas);
    const uiSources = rutas
      .map((path, i) => ({
        path: relative(ROOT, path).replaceAll("\\", "/"),
        source: textos[i],
      }))
      .filter(
        ({ path }) =>
          !allowedDefinitions.has(path) && !formalDocumentConsumers.has(path),
      );
    const combinedUi = uiSources.map(({ source }) => source).join("\n");

    expect(combinedUi).toContain("var(--f-cn)");
    expect(combinedUi).not.toContain("--f-cn-document");
    expect(combinedUi).not.toContain("var(--font-noto-serif-sc)");
  });
});
