import { describe, it, expect } from "vitest";
import { normalizeCedula } from "./person-types";

/**
 * `normalizeCedula` debe coincidir EXACTO con el índice único de la DB
 * (migr 0095/0170: `upper(regexp_replace(doc,'[^A-Za-z0-9]','','g'))`), si no
 * la dedup en TS y la de la DB divergen.
 */
describe("normalizeCedula", () => {
  it("saca puntos/guiones/espacios y pasa a mayúsculas", () => {
    expect(normalizeCedula("v-12.345.678")).toBe("V12345678");
    expect(normalizeCedula("V-12345678")).toBe("V12345678");
    expect(normalizeCedula("J-12.345.678-9")).toBe("J123456789");
  });

  it("equivalencia de formatos (mismo valor normalizado)", () => {
    expect(normalizeCedula("V-12.345.678")).toBe(normalizeCedula("v12345678"));
    expect(normalizeCedula("J-31000000-1")).toBe(normalizeCedula("j 31000000 1"));
  });

  it("vacío / sin alfanuméricos → cadena vacía", () => {
    expect(normalizeCedula("")).toBe("");
    expect(normalizeCedula("---")).toBe("");
  });
});
