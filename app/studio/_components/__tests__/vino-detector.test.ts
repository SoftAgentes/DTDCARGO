import { describe, expect, it } from "vitest";
import { cuentaVino } from "./vino-detector";

describe("detector de clases de vino", () => {
  it("conserva clases, variantes encadenadas y selectores arbitrarios", () => {
    for (const clase of ["bg-wine", "hover:focus-within:border-wine-deep", "group-[[open]]:text-wine", "[&>svg]:text-wine", "hover:[&>svg]:fill-wine"]) {
      expect(cuentaVino(`className="${clase}"`), clase).toBe(1);
    }
    expect(cuentaVino('className="bg-winery text-wine-500"')).toBe(0);
  });

  it("descarta una variante larga sin dos puntos y sigue contando la clase siguiente", () => {
    expect(cuentaVino(`className="${"a".repeat(20000)} bg-wine"`)).toBe(1);
  });
});
