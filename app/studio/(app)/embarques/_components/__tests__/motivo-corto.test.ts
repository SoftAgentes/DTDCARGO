import { describe, expect, it } from "vitest";
import { motivoCorto } from "../motivo-corto";

describe("motivoCorto (SDD-0710)", () => {
  it("quita el envoltorio y conserva el qué", () => {
    expect(
      motivoCorto(
        "No se puede eliminar: tiene 1 consolidación en Naviera y 1 recepción en Almacén CN. Primero anula, elimina o desvincula eso en su módulo.",
      ),
    ).toBe("No se elimina: tiene 1 consolidación en Naviera y 1 recepción en Almacén CN");
  });
  it("un texto que no sigue el molde queda como está", () => {
    expect(motivoCorto("Ya fue eliminado.")).toBe("Ya fue eliminado");
  });
});
