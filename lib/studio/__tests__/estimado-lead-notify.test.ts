/**
 * buildProspectWaLink — normalización conservadora del WhatsApp del prospecto
 * hacia un deep-link wa.me (el CTA "escríbele tú" del aviso al equipo).
 */
import { describe, it, expect } from "vitest";
import { buildProspectWaLink } from "@/lib/studio/estimado-lead-notify";

describe("buildProspectWaLink", () => {
  it("número internacional con + y espacios → solo dígitos", () => {
    expect(buildProspectWaLink("+58 412 1234567")).toBe("https://wa.me/584121234567");
  });

  it("formato local venezolano 04xx → 58 + resto", () => {
    expect(buildProspectWaLink("0412-123.45.67")).toBe("https://wa.me/584121234567");
  });

  it("ya en formato 58… → se respeta tal cual", () => {
    expect(buildProspectWaLink("584121234567")).toBe("https://wa.me/584121234567");
  });

  it("muy corto para ser un número usable → null (sin link)", () => {
    expect(buildProspectWaLink("12345")).toBeNull();
    expect(buildProspectWaLink("no tengo")).toBeNull();
  });
});
