import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CANONICAL = "lib/studio/export/csv.ts";
const LOCAL_CSV_CELL = /\b(?:export\s+)?function\s+csvCell\b|\bconst\s+csvCell\s*=/;

function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      result.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    result.push(full);
  }
  return result;
}

describe("contrato de implementación CSV", () => {
  it("csvCell sólo se implementa en la primitiva canónica", () => {
    const copies = [resolve(ROOT, "app"), resolve(ROOT, "lib")]
      .flatMap(sourceFiles)
      .map((file) => ({
        file: relative(ROOT, file).replaceAll("\\", "/"),
        source: readFileSync(file, "utf8"),
      }))
      .filter(({ file, source }) => file !== CANONICAL && LOCAL_CSV_CELL.test(source))
      .map(({ file }) => file);

    expect(copies, "reutiliza lib/studio/export/csv.ts; no copies csvCell").toEqual([]);
  });
});
