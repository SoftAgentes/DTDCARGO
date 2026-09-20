// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateContractorInput,
  validateContractorPaymentInput,
  computeContractorKpis,
  contractorStatusLabel,
  contractorStatusTone,
  isContractorStatus,
  type ContractorStatus,
} from "./contractor-types";

describe("validateContractorInput", () => {
  const base = { full_name: "Jesús Marcano", service: "Plomería" };

  it("acepta input válido", () => {
    const { input, fieldErrors } = validateContractorInput({
      ...base,
      default_rate_usd: "30",
      status: "activo",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.default_rate_usd).toBe(30);
    expect(input!.service).toBe("Plomería");
  });

  it("exige nombre y servicio", () => {
    expect(validateContractorInput({ ...base, full_name: "" }).fieldErrors?.full_name).toBeTruthy();
    expect(validateContractorInput({ ...base, service: "  " }).fieldErrors?.service).toBeTruthy();
  });

  it("rechaza tarifa negativa", () => {
    expect(
      validateContractorInput({ ...base, default_rate_usd: "-5" }).fieldErrors?.default_rate_usd,
    ).toBeTruthy();
  });

  it("tarifa 0 por defecto es válida", () => {
    const { input, fieldErrors } = validateContractorInput(base);
    expect(fieldErrors).toBeUndefined();
    expect(input!.default_rate_usd).toBe(0);
    expect(input!.status).toBe("activo");
  });
});

describe("validateContractorPaymentInput", () => {
  const base = { contractor_id: "c-1", concept: "Reparación", amount_usd: "30", paid_on: "2026-05-12" };

  it("acepta pago válido", () => {
    const { input, fieldErrors } = validateContractorPaymentInput(base);
    expect(fieldErrors).toBeUndefined();
    expect(input!.amount_usd).toBe(30);
    expect(input!.paid_on).toBe("2026-05-12");
  });

  it("exige prestador y concepto", () => {
    expect(validateContractorPaymentInput({ ...base, contractor_id: "" }).fieldErrors?.contractor_id).toBeTruthy();
    expect(validateContractorPaymentInput({ ...base, concept: "" }).fieldErrors?.concept).toBeTruthy();
  });

  it("exige monto > 0", () => {
    expect(validateContractorPaymentInput({ ...base, amount_usd: "0" }).fieldErrors?.amount_usd).toBeTruthy();
    expect(validateContractorPaymentInput({ ...base, amount_usd: "-1" }).fieldErrors?.amount_usd).toBeTruthy();
  });

  it("rechaza fecha inválida pero default a hoy si falta", () => {
    expect(validateContractorPaymentInput({ ...base, paid_on: "12-05-2026" }).fieldErrors?.paid_on).toBeTruthy();
    const { input } = validateContractorPaymentInput({ ...base, paid_on: "" });
    expect(input!.paid_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("computeContractorKpis", () => {
  it("cuenta activos y suma todos los pagos", () => {
    const contractors: { status: ContractorStatus }[] = [
      { status: "activo" },
      { status: "activo" },
      { status: "inactivo" },
    ];
    const payments = [{ amount_usd: "15" }, { amount_usd: 30 }];
    const k = computeContractorKpis(contractors, payments);
    expect(k.active_count).toBe(2);
    expect(k.total_count).toBe(3);
    expect(k.payments_count).toBe(2);
    expect(k.total_paid_usd).toBe(45);
  });
});

describe("helpers de estado del prestador", () => {
  it("label/tone/guard", () => {
    expect(contractorStatusLabel("activo")).toBe("Activo");
    expect(contractorStatusTone("inactivo")).toBe("neutral");
    expect(isContractorStatus("activo")).toBe(true);
    expect(isContractorStatus("egresado")).toBe(false);
  });
});
