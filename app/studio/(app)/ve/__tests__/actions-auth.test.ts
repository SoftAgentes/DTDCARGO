// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("acciones Studio VE", () => {
  it("aplica el guard de edición del módulo", () => {
    const source = readFileSync(resolve(__dirname, "../actions.ts"), "utf8");
    expect(source).toContain("moduleEditDenial");
    expect(source).toContain('moduleEditDenial(supabase, "ve")');
  });
});
