import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actionsPath = "app/portal/(app)/proveedores/actions.ts";

function source() {
  return readFileSync(resolve(process.cwd(), actionsPath), "utf8");
}

describe("observabilidad de Proveedores y Prealertas Portal", () => {
  it("elimina los quince console libres", () => {
    expect(source()).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it("adopta el logger canónico", () => {
    const content = source();
    expect(content).toContain("createComponentLogger");
    expect(content).toContain("type StructuredLogger");
  });

  it.each([
    "uploadPrealertaDocsFromForm",
    "insertPrealertaServiceRequestsFromForm",
    "firePrealertaServiceEvent",
  ])("propaga el logger por %s", (helper) => {
    const content = source();
    expect(content).toMatch(new RegExp(`${helper}\\([\\s\\S]{0,260}logger`));
  });
});
