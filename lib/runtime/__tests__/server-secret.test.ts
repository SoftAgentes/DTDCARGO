// @vitest-environment node
import { describe, expect, it } from "vitest";
import { firstConfiguredSecret } from "../server-secret";

describe("firstConfiguredSecret (SDD-0523)", () => {
  it("salta la cadena vacía y usa el respaldo", () => {
    expect(firstConfiguredSecret("", "respaldo")).toBe("respaldo");
  });

  it("salta la cadena con sólo espacios, tabuladores o saltos de línea", () => {
    expect(firstConfiguredSecret("   ", "respaldo")).toBe("respaldo");
    expect(firstConfiguredSecret(" \t\n ", "respaldo")).toBe("respaldo");
  });

  it("salta undefined y null", () => {
    expect(firstConfiguredSecret(undefined, "respaldo")).toBe("respaldo");
    expect(firstConfiguredSecret(null, "respaldo")).toBe("respaldo");
  });

  it("usa el primero configurado aunque haya otros después", () => {
    expect(firstConfiguredSecret("dedicado", "respaldo")).toBe("dedicado");
    expect(firstConfiguredSecret("", undefined, " ", "tercero", "cuarto")).toBe("tercero");
  });

  it("devuelve el valor sin recortar: los espacios forman parte de la clave", () => {
    expect(firstConfiguredSecret("  clave con bordes \n", "respaldo")).toBe(
      "  clave con bordes \n",
    );
  });

  it("falla cerrado con null si ninguno está configurado", () => {
    expect(firstConfiguredSecret()).toBeNull();
    expect(firstConfiguredSecret(undefined, null)).toBeNull();
    expect(firstConfiguredSecret("", "  ", "\t")).toBeNull();
  });
});
