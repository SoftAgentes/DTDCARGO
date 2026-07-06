import { describe, it, expect } from "vitest";
import { identityResetOnChange } from "../reset-on-change";

const RESET = {
  doc_verify_status: null,
  doc_verify_source: null,
  doc_registry_name: null,
  doc_verified_at: null,
  doc_verified_by: null,
};

describe("identityResetOnChange", () => {
  it("resetea cuando cambia el RIF/cédula", () => {
    expect(
      identityResetOnChange(
        { name: "Juan Pérez", rif: "V-12345678" },
        { name: "Juan Pérez", rif: "V-87654321" },
      ),
    ).toEqual(RESET);
  });

  it("resetea cuando cambia el nombre", () => {
    expect(
      identityResetOnChange(
        { name: "Juan Perez", rif: "V-12345678" },
        { name: "Juan Carlos Pérez", rif: "V-12345678" },
      ),
    ).toEqual(RESET);
  });

  it("NO resetea si solo cambió el teléfono (name/rif no vienen en next)", () => {
    expect(
      identityResetOnChange(
        { name: "Juan Pérez", rif: "V-12345678" },
        {},
      ),
    ).toBeNull();
  });

  it("NO resetea si el valor es igual salvo espacios/mayúsculas", () => {
    expect(
      identityResetOnChange(
        { name: "Juan  Pérez", rif: "V-12345678" },
        { name: "juan pérez", rif: "V-12345678" },
      ),
    ).toBeNull();
  });

  it("resetea si cambia el rif aunque el nombre no venga en next", () => {
    expect(
      identityResetOnChange(
        { name: "Juan Pérez", rif: "V-12345678" },
        { rif: "V-99999999" },
      ),
    ).toEqual(RESET);
  });

  it("trata null y string vacío como equivalentes (no resetea)", () => {
    expect(
      identityResetOnChange({ name: "Juan", rif: null }, { rif: "" }),
    ).toBeNull();
  });
});
