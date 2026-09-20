// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateAuditReason } from "../reason";

describe("validateAuditReason", () => {
  it("recorta y acepta un motivo humano válido", () => {
    expect(validateAuditReason("  Error de período  ")).toEqual({
      ok: true,
      reason: "Error de período",
    });
  });

  it.each([undefined, null, "", "   ", "abc"])(
    "rechaza un motivo ausente o demasiado corto: %s",
    (value) => {
      expect(validateAuditReason(value)).toEqual({
        ok: false,
        error: "Indica un motivo de al menos 4 caracteres.",
      });
    },
  );

  it("rechaza motivos mayores a 1000 caracteres", () => {
    expect(validateAuditReason("x".repeat(1001))).toEqual({
      ok: false,
      error: "El motivo no puede superar 1000 caracteres.",
    });
  });
});
