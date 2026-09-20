// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extensionForMime, validateAttachmentCandidate } from "../policy";

describe("policy de adjuntos", () => {
  it("acepta los límites exactos", () => {
    expect(validateAttachmentCandidate({ name: "foto.jpg", mime: "image/jpeg", size: 8 * 1024 * 1024 })).toBeNull();
    expect(validateAttachmentCandidate({ name: "factura.pdf", mime: "application/pdf", size: 25 * 1024 * 1024 })).toBeNull();
  });
  it("rechaza un byte sobre el límite y MIME no aprobado", () => {
    expect(validateAttachmentCandidate({ name: "foto.jpg", mime: "image/jpeg", size: 8 * 1024 * 1024 + 1 })).toContain("8 MB");
    expect(validateAttachmentCandidate({ name: "x.svg", mime: "image/svg+xml", size: 20 })).toContain("Formato");
  });
  it("deriva extensiones sin confiar en el nombre", () => expect(extensionForMime("application/pdf")).toBe("pdf"));
});

