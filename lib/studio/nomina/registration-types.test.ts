// @vitest-environment node
/**
 * Tests de los validadores de onboarding (SDD-0113 Slice A). PUROS: cédula-aware
 * (paridad con el índice SQL), required, allowlist del sueldo (lo fija la empresa
 * al aprobar, NO el candidato), y la usabilidad de la invitación.
 */

import { describe, it, expect } from "vitest";
import {
  validateRegistrationInput,
  validateApproveRegistrationInput,
  normalizeCedula,
  isRegistrationStatus,
} from "./registration-types";
import { isInviteUsable, validateInviteInput } from "./invite-types";

describe("validateRegistrationInput", () => {
  const ok = {
    full_name: "Pedro Pérez",
    national_id: "V-12.345.678",
    email: "Pedro@Example.com",
  };

  it("acepta un registro válido y normaliza cédula + email", () => {
    const { input, fieldErrors } = validateRegistrationInput(ok);
    expect(fieldErrors).toBeUndefined();
    expect(input?.national_id).toBe("V12345678"); // normalizado igual que el índice SQL
    expect(input?.email).toBe("pedro@example.com"); // lowercased
  });

  it("paridad con normalizeCedula (SDD-0106)", () => {
    const { input } = validateRegistrationInput(ok);
    expect(input?.national_id).toBe(normalizeCedula("V-12.345.678"));
  });

  it("rechaza nombre/cédula/correo faltantes", () => {
    const { input, fieldErrors } = validateRegistrationInput({});
    expect(input).toBeNull();
    expect(fieldErrors?.full_name).toBeTruthy();
    expect(fieldErrors?.national_id).toBeTruthy();
    expect(fieldErrors?.email).toBeTruthy();
  });

  it("rechaza cédula con formato inválido", () => {
    const { fieldErrors } = validateRegistrationInput({ ...ok, national_id: "123" });
    expect(fieldErrors?.national_id).toBeTruthy();
  });

  it("rechaza correo inválido", () => {
    const { fieldErrors } = validateRegistrationInput({ ...ok, email: "no-arroba" });
    expect(fieldErrors?.email).toBeTruthy();
  });

  it("NO acepta sueldo del candidato (no es campo del input)", () => {
    const { input } = validateRegistrationInput({ ...ok, salary_usd: 9999 });
    // el tipo no tiene salary_usd: el candidato no propone sueldo.
    expect((input as Record<string, unknown>)?.salary_usd).toBeUndefined();
  });

  it("valida tipo de cuenta bancaria si viene", () => {
    expect(validateRegistrationInput({ ...ok, bank_account_type: "corriente" }).fieldErrors)
      .toBeUndefined();
    expect(validateRegistrationInput({ ...ok, bank_account_type: "cripto" }).fieldErrors
      ?.bank_account_type).toBeTruthy();
  });
});

describe("validateApproveRegistrationInput (sueldo lo fija la empresa)", () => {
  it("acepta sueldo ≥ 0", () => {
    const { input, fieldErrors } = validateApproveRegistrationInput({ salary_usd: "450.5" });
    expect(fieldErrors).toBeUndefined();
    expect(input?.salary_usd).toBe(450.5);
  });
  it("rechaza sueldo negativo", () => {
    const { input, fieldErrors } = validateApproveRegistrationInput({ salary_usd: -10 });
    expect(input).toBeNull();
    expect(fieldErrors?.salary_usd).toBeTruthy();
  });
});

describe("isInviteUsable", () => {
  const now = new Date("2026-06-27T12:00:00Z");
  it("activa y no vencida → usable", () => {
    expect(isInviteUsable({ status: "activa", expires_at: "2026-07-10T00:00:00Z" }, now)).toBe(true);
  });
  it("activa pero vencida → NO usable", () => {
    expect(isInviteUsable({ status: "activa", expires_at: "2026-06-01T00:00:00Z" }, now)).toBe(false);
  });
  it("revocada/usada → NO usable aunque no esté vencida", () => {
    expect(isInviteUsable({ status: "revocada", expires_at: "2026-07-10T00:00:00Z" }, now)).toBe(false);
    expect(isInviteUsable({ status: "usada", expires_at: null }, now)).toBe(false);
  });
});

describe("validateInviteInput", () => {
  it("acepta cargo/área opcionales (o vacíos)", () => {
    expect(validateInviteInput({}).input).toEqual({ cargo: null, department: null });
    expect(validateInviteInput({ cargo: "Operario" }).input?.cargo).toBe("Operario");
  });
  it("rechaza cargo demasiado largo", () => {
    expect(validateInviteInput({ cargo: "x".repeat(81) }).fieldErrors?.cargo).toBeTruthy();
  });
});

describe("isRegistrationStatus", () => {
  it("reconoce los estados válidos", () => {
    expect(isRegistrationStatus("pendiente")).toBe(true);
    expect(isRegistrationStatus("borrador")).toBe(false);
  });
});
