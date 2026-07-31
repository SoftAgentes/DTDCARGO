// @vitest-environment node

import { describe, expect, it } from "vitest";
import { verifyAttachmentBytes } from "../verification";

describe("verificación por contenido", () => {
  it("detecta PDF por magic bytes y calcula SHA-256", async () => {
    const result = await verifyAttachmentBytes(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"));
    expect(result.canonicalMime).toBe("application/pdf");
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rechaza texto renombrado", async () => {
    await expect(verifyAttachmentBytes(new TextEncoder().encode("no es una imagen"))).rejects.toThrow("contenido real");
  });
});
