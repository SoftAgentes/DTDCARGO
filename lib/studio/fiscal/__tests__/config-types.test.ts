/**
 * Tests de la configuración fiscal (SDD-0073 · config-types).
 *
 * Cubre Acceptance §5:
 *  - DEFAULT_FISCAL_SETTINGS = el caso DTD hoy (exento · retiene · 16% · mensual).
 *  - validateFiscalSettingsInput acepta cada service_iva_treatment válido.
 *  - rechaza alícuotas/porcentajes fuera de rango y enums inválidos.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FISCAL_SETTINGS,
  SERVICE_IVA_TREATMENTS,
  serviceIvaTreatmentLabel,
  validateFiscalSettingsInput,
  type FiscalSettingsInput,
  type ServiceIvaTreatment,
} from "../config-types";

const VALID: FiscalSettingsInput = {
  service_iva_treatment: "exento",
  iva_rate: 16,
  is_special_taxpayer: false,
  is_iva_withholding_agent: true,
  iva_withholding_pct: 75,
  purchase_iva_mode: "derivado",
  declaration_period: "mensual",
};

describe("DEFAULT_FISCAL_SETTINGS (caso DTD, spec §5)", () => {
  it("arranca exento, agente de retención, 16%, mensual", () => {
    expect(DEFAULT_FISCAL_SETTINGS.service_iva_treatment).toBe("exento");
    expect(DEFAULT_FISCAL_SETTINGS.is_iva_withholding_agent).toBe(true);
    expect(DEFAULT_FISCAL_SETTINGS.iva_rate).toBe(16);
    expect(DEFAULT_FISCAL_SETTINGS.iva_withholding_pct).toBe(75);
    expect(DEFAULT_FISCAL_SETTINGS.purchase_iva_mode).toBe("derivado");
    expect(DEFAULT_FISCAL_SETTINGS.declaration_period).toBe("mensual");
    expect(DEFAULT_FISCAL_SETTINGS.is_special_taxpayer).toBe(false);
  });

  it("los defaults pasan su propia validación", () => {
    const { input, fieldErrors } = validateFiscalSettingsInput(
      DEFAULT_FISCAL_SETTINGS,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual(DEFAULT_FISCAL_SETTINGS);
  });
});

describe("validateFiscalSettingsInput · cada calificación", () => {
  it.each(SERVICE_IVA_TREATMENTS)(
    "acepta service_iva_treatment = %s",
    (treatment) => {
      const { input, fieldErrors } = validateFiscalSettingsInput({
        ...VALID,
        service_iva_treatment: treatment as ServiceIvaTreatment,
      });
      expect(fieldErrors).toBeUndefined();
      expect(input?.service_iva_treatment).toBe(treatment);
    },
  );

  it("cada calificación tiene label legible", () => {
    for (const t of SERVICE_IVA_TREATMENTS) {
      expect(serviceIvaTreatmentLabel(t).length).toBeGreaterThan(0);
    }
  });
});

describe("validateFiscalSettingsInput · rechazos", () => {
  it("rechaza calificación inválida", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      service_iva_treatment: "fantasma" as ServiceIvaTreatment,
    });
    expect(fieldErrors?.service_iva_treatment).toBeTruthy();
  });

  it("rechaza alícuota > 100", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_rate: 120,
    });
    expect(fieldErrors?.iva_rate).toBeTruthy();
  });

  it("rechaza alícuota negativa", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_rate: -1,
    });
    expect(fieldErrors?.iva_rate).toBeTruthy();
  });

  it("rechaza alícuota no numérica", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_rate: NaN,
    });
    expect(fieldErrors?.iva_rate).toBeTruthy();
  });

  it("rechaza % de retención fuera de rango", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_withholding_pct: 150,
    });
    expect(fieldErrors?.iva_withholding_pct).toBeTruthy();
  });

  it("rechaza purchase_iva_mode inválido", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      // @ts-expect-error — probamos un valor crudo inválido a propósito
      purchase_iva_mode: "magia",
    });
    expect(fieldErrors?.purchase_iva_mode).toBeTruthy();
  });

  it("rechaza booleanos faltantes", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      is_special_taxpayer: undefined,
    });
    expect(fieldErrors?.is_special_taxpayer).toBeTruthy();
  });
});
