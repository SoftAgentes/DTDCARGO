import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const targetFiles = [
  "app/portal/(app)/academia/actions.ts",
  "app/portal/(app)/error.tsx",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function productionFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...productionFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("cierre de observabilidad del Portal", () => {
  it.each(targetFiles)("adopta el logger canónico en %s", (path) => {
    expect(source(path)).toContain("createComponentLogger");
  });

  it("mantiene la superficie de producción sin console libre", () => {
    const files = [
      ...productionFiles(resolve(process.cwd(), "app/portal")),
      ...productionFiles(resolve(process.cwd(), "app/api/portal")),
    ];
    const offenders = files.filter((path) =>
      /console\.(?:log|warn|error|info|debug)\s*\(/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("usa tuteo venezolano en el límite de error", () => {
    const content = source(targetFiles[1]);
    expect(content).toContain("Vuelve a intentar");
    expect(content).not.toContain("Volvé");
  });
});
