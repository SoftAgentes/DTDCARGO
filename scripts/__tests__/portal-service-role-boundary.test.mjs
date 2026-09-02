import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0335 · inventario fail-closed de service_role en RSC del Portal.
 *
 * Esta lista NO aprueba los usos existentes. Congela la deuda medida para que
 * una feature nueva no pueda sumar otra elevación silenciosa. Cada slice que
 * retire un uso debe reducir esta lista en el mismo commit.
 */
const BASELINE = {
  "app/portal/(app)/facturas/[code]/aceptar/page.tsx": 1,
};

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function normalizedRepoPath(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function callCount(source) {
  return source.match(/\bcreateAdminClient\s*\(/g)?.length ?? 0;
}

describe("Portal RSC · frontera de service_role", () => {
  it("no permite que el inventario conocido crezca o se mueva sin un slice explícito", () => {
    const portalRoot = resolve("app/portal");
    const actual = {};

    for (const file of filesUnder(portalRoot)) {
      if (!file.endsWith("page.tsx")) continue;
      const source = readFileSync(file, "utf8");
      const calls = callCount(source);
      if (calls > 0 || source.includes("@/lib/db/admin")) {
        actual[normalizedRepoPath(file)] = calls;
      }
    }

    expect(actual).toEqual(BASELINE);
    expect(Object.values(actual).reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it("mantiene las elevaciones fuera de componentes cliente", () => {
    for (const path of Object.keys(BASELINE)) {
      const source = readFileSync(resolve(path), "utf8").trimStart();
      expect(source.startsWith('"use client"')).toBe(false);
    }
  });
});
