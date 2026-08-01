import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("API Studio · sesión obligatoria", () => {
  for (const path of [
    "app/api/studio/shipments/[id]/route.ts",
    "app/api/studio/kpis/route.ts",
    "app/api/studio/conversaciones/[id]/route.ts",
  ]) {
    it(`${path} verifica auth antes de consultar`, () => {
      const source = read(path);
      expect(source).toContain("auth.getUser()");
      expect(source.indexOf("auth.getUser()")).toBeLessThan(source.indexOf('.from("'));
    });
  }

  it("las mutaciones de shipment requieren permiso de tracking", () => {
    const source = read("app/api/studio/shipments/[id]/route.ts");
    expect(source).toContain("moduleEditDenial");
    expect(source).toContain('moduleEditDenial(supabase, "tracking")');
  });
});
