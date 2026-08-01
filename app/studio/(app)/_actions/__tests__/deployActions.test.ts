import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy actions · gate server-side", () => {
  it("exige sesión y rol admin además de entorno local", () => {
    const source = readFileSync(resolve(__dirname, "../deployActions.ts"), "utf8");
    expect(source).toContain("auth.getUser()");
    expect(source).toContain("getStudioRole");
    expect(source).toContain('role !== "admin"');
  });
});
