import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("validación alojada de Cloudflare R2", () => {
  it("es sintética, fail-closed y exige borrado denegado + restore SHA-256", async () => {
    const source = await readFile(resolve("scripts/attachments-r2-live-validation.mjs"), "utf8");

    expect(source).toContain('DTD_ATTACHMENTS_R2_VALIDATION_ALLOW !== "1"');
    expect(source).toContain('NODE_ENV === "production"');
    expect(source).toContain("DeleteObjectCommand");
    expect(source).toContain("if (!deleteDenied)");
    expect(source).toContain("restoredSha256 !== sha256");
    expect(source).toContain('flag: "wx"');
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
