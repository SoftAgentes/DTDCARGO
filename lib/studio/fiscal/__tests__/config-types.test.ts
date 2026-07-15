/**
 * Tests de la configuración fiscal (SDD-0073 §8 · config-types).
 *
 * Cubre la estructura canónica §8:
 *  - DEFAULT_FISCAL_SETTINGS = caso DTD hoy (módulo OFF · sin_iva · 16/8/0/15 ·
 *    sin retención · sin IGTF · sin facturación digital · mensual).
 *  - validateFiscalSettingsInput acepta cada InvoiceIvaMode válido.
 *  - rechaza alícuotas/porcentajes fuera de rango y enums/booleans inválidos.
 *  - isFiscalModuleEnabled refleja el master toggle.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FISCAL_SETTINGS,
  INVOICE_IVA_MODES,
  invoiceIvaModeLabel,
  isFiscalModuleEnabled,
  validateFiscalSettingsInput,
  type FiscalSettings,
  type FiscalSettingsInput,
  type InvoiceIvaMode,
} from "../config-types";

const VALID: FiscalSettingsInput = {
  fiscal_module_enabled: false,
  is_special_taxpayer: false,
  iva_rate_general: 16,
  iva_rate_reduced: 8,
  iva_rate_export: 0,
  iva_rate_luxury_surcharge: 15,
  default_invoice_iva_mode: "sin_iva",
  igtf_enabled: false,
  igtf_rate_fx: 3,
  igtf_is_perception_agent: false,
  iva_withholding_agent: false,
  iva_withholding_pct: 75,
  digital_invoicing_enabled: false,
  homologated_provider: null,
  declaration_period: "mensual",
  purchase_iva_mode: "derivado",
};

describe("DEFAULT_FISCAL_SETTINGS (caso DTD, spec §8.2)", () => {
  it("arranca con el módulo APAGADO (principio #1)", () => {
    expect(DEFAULT_FISCAL_SETTINGS.fiscal_module_enabled).toBe(false);
  });

  it("default sin_iva, alícuotas 16/8/0/15, sin retención/IGTF/digital, mensual", () => {
    expect(DEFAULT_FISCAL_SETTINGS.default_invoice_iva_mode).toBe("sin_iva");
    expect(DEFAULT_FISCAL_SETTINGS.iva_rate_general).toBe(16);
    expect(DEFAULT_FISCAL_SETTINGS.iva_rate_reduced).toBe(8);
    expect(DEFAULT_FISCAL_SETTINGS.iva_rate_export).toBe(0);
    expect(DEFAULT_FISCAL_SETTINGS.iva_rate_luxury_surcharge).toBe(15);
    expect(DEFAULT_FISCAL_SETTINGS.igtf_enabled).toBe(false);
    expect(DEFAULT_FISCAL_SETTINGS.igtf_rate_fx).toBe(3);
    expect(DEFAULT_FISCAL_SETTINGS.iva_withholding_agent).toBe(false);
    expect(DEFAULT_FISCAL_SETTINGS.iva_withholding_pct).toBe(75);
    expect(DEFAULT_FISCAL_SETTINGS.digital_invoicing_enabled).toBe(false);
    expect(DEFAULT_FISCAL_SETTINGS.homologated_provider).toBeNull();
    expect(DEFAULT_FISCAL_SETTINGS.declaration_period).toBe("mensual");
    expect(DEFAULT_FISCAL_SETTINGS.purchase_iva_mode).toBe("derivado");
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

describe("isFiscalModuleEnabled (principio #1)", () => {
  const base: FiscalSettings = {
    ...DEFAULT_FISCAL_SETTINGS,
    tenant_id: "t1",
    updated_at: null,
    updated_by: null,
  };
  it("false con el toggle OFF", () => {
    expect(isFiscalModuleEnabled({ ...base, fiscal_module_enabled: false })).toBe(false);
  });
  it("true con el toggle ON", () => {
    expect(isFiscalModuleEnabled({ ...base, fiscal_module_enabled: true })).toBe(true);
  });
});

describe("validateFiscalSettingsInput · cada modo de IVA", () => {
  it.each(INVOICE_IVA_MODES)("acepta default_invoice_iva_mode = %s", (mode) => {
    const { input, fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      default_invoice_iva_mode: mode as InvoiceIvaMode,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.default_invoice_iva_mode).toBe(mode);
  });

  it("cada modo tiene label legible", () => {
    for (const m of INVOICE_IVA_MODES) {
      expect(invoiceIvaModeLabel(m).length).toBeGreaterThan(0);
    }
  });
});

describe("validateFiscalSettingsInput · acepta y normaliza", () => {
  it("recorta homologated_provider y vacío → null", () => {
    const { input } = validateFiscalSettingsInput({
      ...VALID,
      digital_invoicing_enabled: true,
      homologated_provider: "  ProveedorX  ",
    });
    expect(input?.homologated_provider).toBe("ProveedorX");

    const { input: input2 } = validateFiscalSettingsInput({
      ...VALID,
      homologated_provider: "   ",
    });
    expect(input2?.homologated_provider).toBeNull();
  });
});

describe("validateFiscalSettingsInput · rechazos", () => {
  it("rechaza modo de IVA inválido", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      default_invoice_iva_mode: "fantasma" as InvoiceIvaMode,
    });
    expect(fieldErrors?.default_invoice_iva_mode).toBeTruthy();
  });

  it.each([
    "iva_rate_general",
    "iva_rate_reduced",
    "iva_rate_export",
    "iva_rate_luxury_surcharge",
    "igtf_rate_fx",
    "iva_withholding_pct",
  ] as const)("rechaza %s > 100", (key) => {
    const { fieldErrors } = validateFiscalSettingsInput({ ...VALID, [key]: 120 });
    expect(fieldErrors?.[key]).toBeTruthy();
  });

  it("rechaza alícuota general negativa", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_rate_general: -1,
    });
    expect(fieldErrors?.iva_rate_general).toBeTruthy();
  });

  it("rechaza alícuota general no numérica", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      iva_rate_general: NaN,
    });
    expect(fieldErrors?.iva_rate_general).toBeTruthy();
  });

  it("rechaza purchase_iva_mode inválido", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      // @ts-expect-error — valor crudo inválido a propósito
      purchase_iva_mode: "magia",
    });
    expect(fieldErrors?.purchase_iva_mode).toBeTruthy();
  });

  it("rechaza el master toggle faltante (boolean)", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      fiscal_module_enabled: undefined,
    });
    expect(fieldErrors?.fiscal_module_enabled).toBeTruthy();
  });

  it("rechaza booleanos faltantes", () => {
    const { fieldErrors } = validateFiscalSettingsInput({
      ...VALID,
      is_special_taxpayer: undefined,
    });
    expect(fieldErrors?.is_special_taxpayer).toBeTruthy();
  });
});
