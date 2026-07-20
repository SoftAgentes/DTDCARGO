import { describe, it, expect } from "vitest";
import { validateRateInput, type RateInput } from "@/lib/studio/rate-types";

/**
 * Tests de validateRateInput (módulo Tarifas).
 *
 * Cubre el validador entero — hasta Fase 2 de la calculadora tenía CERO tests —
 * con foco en los campos nuevos `valid_from` + `is_public` y la invariante
 * valid_from <= valid_until.
 */

function baseInput(overrides: Partial<RateInput> = {}): Partial<RateInput> {
  return {
    service: "consolidado_lcl",
    origin: "Yiwu",
    destination: "Valencia",
    per_cbm: 480,
    flat_rate: null,
    min_charge: 380,
    transit_days: 38,
    valid_from: "2026-01-01",
    valid_until: "2026-12-31",
    is_public: false,
    notes: null,
    ...overrides,
  };
}

describe("validateRateInput", () => {
  it("acepta una tarifa per_cbm válida y preserva los campos nuevos", () => {
    const { input, fieldErrors } = validateRateInput(
      baseInput({ is_public: true }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
    expect(input!.per_cbm).toBe(480);
    expect(input!.is_public).toBe(true);
    expect(input!.valid_from).toBe("2026-01-01");
    expect(input!.valid_until).toBe("2026-12-31");
  });

  it("acepta una tarifa flat (FCL) válida", () => {
    const { input, fieldErrors } = validateRateInput(
      baseInput({
        service: "fcl_directo",
        origin: "Guangzhou",
        destination: "La Guaira",
        per_cbm: null,
        flat_rate: 8500,
        min_charge: null,
      }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input!.flat_rate).toBe(8500);
    expect(input!.per_cbm).toBeNull();
  });

  it("rechaza si falta el servicio", () => {
    const { fieldErrors } = validateRateInput(baseInput({ service: undefined }));
    expect(fieldErrors?.service).toBeDefined();
  });

  it("rechaza si falta el origen", () => {
    const { fieldErrors } = validateRateInput(baseInput({ origin: "  " }));
    expect(fieldErrors?.origin).toBeDefined();
  });

  it("rechaza si falta el destino", () => {
    const { fieldErrors } = validateRateInput(baseInput({ destination: "" }));
    expect(fieldErrors?.destination).toBeDefined();
  });

  it("rechaza si no hay ni per_cbm ni flat_rate", () => {
    const { fieldErrors } = validateRateInput(
      baseInput({ per_cbm: null, flat_rate: null }),
    );
    expect(fieldErrors?.per_cbm).toBeDefined();
  });

  it("rechaza per_cbm negativo", () => {
    const { fieldErrors } = validateRateInput(baseInput({ per_cbm: -5 }));
    expect(fieldErrors?.per_cbm).toBeDefined();
  });

  it("rechaza valid_from con fecha inválida", () => {
    const { fieldErrors } = validateRateInput(baseInput({ valid_from: "abc" }));
    expect(fieldErrors?.valid_from).toBeDefined();
  });

  it("rechaza valid_until con fecha inválida", () => {
    const { fieldErrors } = validateRateInput(baseInput({ valid_until: "xyz" }));
    expect(fieldErrors?.valid_until).toBeDefined();
  });

  it("rechaza valid_from posterior a valid_until (invariante)", () => {
    const { fieldErrors } = validateRateInput(
      baseInput({ valid_from: "2026-12-31", valid_until: "2026-01-01" }),
    );
    expect(fieldErrors?.valid_from).toBeDefined();
  });

  it("acepta valid_from <= valid_until", () => {
    const { input, fieldErrors } = validateRateInput(
      baseInput({ valid_from: "2026-01-01", valid_until: "2026-06-30" }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
  });

  it("acepta solo valid_until (sin valid_from) sin disparar la invariante", () => {
    const { input, fieldErrors } = validateRateInput(
      baseInput({ valid_from: null }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input!.valid_from).toBeNull();
  });

  it("is_public default false cuando se omite", () => {
    const { input } = validateRateInput(baseInput({ is_public: undefined }));
    expect(input!.is_public).toBe(false);
  });
});
