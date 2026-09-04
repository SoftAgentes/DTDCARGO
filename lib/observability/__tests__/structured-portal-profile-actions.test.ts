import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profileActionFiles = [
  "app/portal/(app)/perfil/address-actions.ts",
  "app/portal/(app)/perfil/avatar-actions.ts",
  "app/portal/(app)/perfil/actions.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de acciones de Perfil Portal", () => {
  it.each(profileActionFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(profileActionFiles)("adopta el logger canónico en %s", (path) => {
    expect(source(path)).toContain("createComponentLogger");
  });

  it("deriva del logger el correlador del borrado", () => {
    const content = source(profileActionFiles[0]);
    expect(content).toContain("const correlationId = logger.requestId");
    expect(content).not.toContain('from "node:crypto"');
  });
});
