/**
 * Tests de la validación de la config de referidos (SDD-0159). Espeja los CHECKs
 * de la migración 0250 (montos finitos y ≥ 0).
 */
import { describe, it, expect } from "vitest";
import {
  validateReferralSettingsInput,
  DEFAULT_REFERRAL_SETTINGS,
} from "../referral-settings-types";

describe("validateReferralSettingsInput", () => {
  it("acepta montos válidos", () => {
    const { input, fieldErrors } = validateReferralSettingsInput({
      referrerRewardUsd: 100,
      referredRewardUsd: 50,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({ referrerRewardUsd: 100, referredRewardUsd: 50 });
  });

  it("acepta cero (montos ≥ 0)", () => {
    const { input, fieldErrors } = validateReferralSettingsInput({
      referrerRewardUsd: 0,
      referredRewardUsd: 0,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.referrerRewardUsd).toBe(0);
  });

  it("rechaza un monto negativo (solo el que falla)", () => {
    const { input, fieldErrors } = validateReferralSettingsInput({
      referrerRewardUsd: -1,
      referredRewardUsd: 10,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.referrerRewardUsd).toBeTruthy();
    expect(fieldErrors?.referredRewardUsd).toBeUndefined();
  });

  it("rechaza no-numéricos y faltantes", () => {
    const { fieldErrors } = validateReferralSettingsInput({
      referrerRewardUsd: Number.NaN,
      // referredRewardUsd ausente
    });
    expect(fieldErrors?.referrerRewardUsd).toBeTruthy();
    expect(fieldErrors?.referredRewardUsd).toBeTruthy();
  });

  it("los defaults son $80 / $60", () => {
    expect(DEFAULT_REFERRAL_SETTINGS).toEqual({
      referrerRewardUsd: 80,
      referredRewardUsd: 60,
    });
  });
});
