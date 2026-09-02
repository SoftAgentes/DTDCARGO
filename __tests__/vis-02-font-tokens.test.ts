import { readdirSync, readFileSync } from "node:fs";
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
 * El timeout se sube ACÁ y no en `vitest.config.mts` a propósito: subirlo global
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

function appSourceFiles(directory = join(ROOT, "app")): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(path);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("SDD-0175 Gate V1 · fuentes chinas", () => {
  it("carga Noto Serif SC sin bloquear el render ni precargarla globalmente", () => {
    const layout = read("app/layout.tsx");
    const config = layout.match(
      /const notoSerifSc = Noto_Serif_SC\(\{([\s\S]*?)\}\);/,
    )?.[1];

    expect(layout).toContain("Noto_Serif_SC");
    expect(config).toContain('variable: "--font-noto-serif-sc"');
    expect(config).toContain('display: "swap"');
    expect(config).toContain("preload: false");
    expect(config).toContain('fallback: ["Noto Sans SC", "sans-serif"]');
    expect(layout).toContain("${notoSerifSc.variable}");
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

  it("mantiene la UI china en Noto Sans SC fuera de consumidores formales", () => {
    const allowedDefinitions = new Set([
      "app/globals.css",
      "app/layout.tsx",
      "app/studio/tokens.css",
    ]);
    const formalDocumentConsumers = new Set([
      "app/p/[token]/PackingListFormSection.tsx",
    ]);
    const uiSources = appSourceFiles()
      .map((path) => ({
        path: relative(ROOT, path).replaceAll("\\", "/"),
        source: readFileSync(path, "utf8"),
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
