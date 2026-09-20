// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertAttachmentTransition, canTransitionAttachment } from "../state-machine";

describe("máquina de estados", () => {
  it("permite verificar y proteger en orden", () => {
    expect(canTransitionAttachment("guardado", "verificando")).toBe(true);
    expect(canTransitionAttachment("disponible", "protegido")).toBe(true);
  });
  it("impide declarar protegido desde reservado", () => {
    expect(() => assertAttachmentTransition("reservado", "protegido")).toThrow("inválida");
  });
});

