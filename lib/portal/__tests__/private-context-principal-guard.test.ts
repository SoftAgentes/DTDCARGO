// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contexts = [
  "portal-shell-private-context.ts",
  "portal-acceptance-private-context.ts",
  "support-private-context.ts",
  "portal-home-private-context.ts",
  "shipment-private-context.ts",
  "shipments-hub-private-context.ts",
  "purchase-operational-detail.ts",
] as const;

function source(file: string) {
  return readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

describe("SDD0398 · principal canónico en contextos privados", () => {
  it.each(contexts)("%s deriva el principal completo", (file) => {
    const text = source(file);
    expect(text).toContain("getPortalClientPrincipal");
    expect(text).not.toMatch(/\bgetPortalClient\s*\(/);
  });

  it.each([
    "portal-shell-private-context.ts",
    "portal-acceptance-private-context.ts",
    "portal-home-private-context.ts",
    "shipment-private-context.ts",
    "shipments-hub-private-context.ts",
  ])("%s no relee tenant desde clients con service_role", (file) => {
    expect(source(file)).not.toContain('.from("clients")');
  });
});
