import { describe, it, expect } from "vitest";
import {
  canTransitionClaim,
  claimNextStatuses,
  claimStatusStep,
  computeClaimKpis,
  validateClaimInput,
  claimMatchesFilter,
  isClaimOpen,
  isClaimTerminal,
  isFaultParty,
  faultPartyLabel,
  validateClaimFinancialsInput,
  CLAIM_STATUSES,
  type ClaimStatus,
} from "../claims-types";

describe("máquina de estados del reclamo", () => {
  it("permite las transiciones del flujo", () => {
    expect(canTransitionClaim("reportado", "evaluacion")).toBe(true);
    expect(canTransitionClaim("reportado", "rechazado")).toBe(true);
    expect(canTransitionClaim("evaluacion", "aprobado")).toBe(true);
    expect(canTransitionClaim("evaluacion", "rechazado")).toBe(true);
    expect(canTransitionClaim("aprobado", "pagado")).toBe(true);
    expect(canTransitionClaim("aprobado", "resuelto")).toBe(true);
  });

  it("rechaza saltos y retrocesos inválidos", () => {
    expect(canTransitionClaim("reportado", "pagado")).toBe(false);
    expect(canTransitionClaim("reportado", "aprobado")).toBe(false);
    expect(canTransitionClaim("evaluacion", "pagado")).toBe(false);
    expect(canTransitionClaim("aprobado", "reportado")).toBe(false);
  });

  it("no permite auto-transición", () => {
    for (const s of CLAIM_STATUSES) {
      expect(canTransitionClaim(s, s)).toBe(false);
    }
  });

  it("los estados terminales no tienen salidas", () => {
    expect(claimNextStatuses("pagado")).toEqual([]);
    expect(claimNextStatuses("resuelto")).toEqual([]);
    expect(claimNextStatuses("rechazado")).toEqual([]);
  });

  it("clasifica abiertos vs terminales", () => {
    expect(isClaimOpen("reportado")).toBe(true);
    expect(isClaimOpen("evaluacion")).toBe(true);
    expect(isClaimOpen("aprobado")).toBe(true);
    expect(isClaimTerminal("pagado")).toBe(true);
    expect(isClaimTerminal("resuelto")).toBe(true);
    expect(isClaimTerminal("rechazado")).toBe(true);
  });
});

describe("stepper de 3 fases", () => {
  it("mapea cada estado a su fase", () => {
    expect(claimStatusStep("reportado")).toBe(1);
    expect(claimStatusStep("evaluacion")).toBe(2);
    expect(claimStatusStep("aprobado")).toBe(2);
    expect(claimStatusStep("pagado")).toBe(3);
    expect(claimStatusStep("resuelto")).toBe(3);
    expect(claimStatusStep("rechazado")).toBe(3);
  });
});

describe("computeClaimKpis", () => {
  const claims: { status: ClaimStatus; amount_usd: unknown; insured: boolean }[] = [
    { status: "evaluacion", amount_usd: "340", insured: true }, // abierto
    { status: "aprobado", amount_usd: 560, insured: true }, // abierto
    { status: "resuelto", amount_usd: 0, insured: false }, // terminal
    { status: "pagado", amount_usd: "210.50", insured: true }, // pagado
    { status: "rechazado", amount_usd: 95, insured: false }, // terminal
  ];

  it("cuenta abiertos y suma el monto expuesto (coerciona string)", () => {
    const k = computeClaimKpis(claims);
    expect(k.open_count).toBe(2);
    expect(k.exposed_usd).toBe(900); // 340 + 560
  });

  it("cuenta cobertura de seguro sobre el total", () => {
    const k = computeClaimKpis(claims);
    expect(k.insured_count).toBe(3);
    expect(k.total_count).toBe(5);
  });

  it("suma solo las indemnizaciones pagadas", () => {
    const k = computeClaimKpis(claims);
    expect(k.paid_usd).toBe(210.5);
  });

  it("no rompe con lista vacía", () => {
    expect(computeClaimKpis([])).toEqual({
      open_count: 0,
      exposed_usd: 0,
      insured_count: 0,
      total_count: 0,
      paid_usd: 0,
    });
  });
});

describe("claimMatchesFilter", () => {
  it("'todos' matchea cualquier estado", () => {
    for (const s of CLAIM_STATUSES) {
      expect(claimMatchesFilter({ status: s }, "todos")).toBe(true);
    }
  });
  it("'abiertos' matchea solo no-terminales", () => {
    expect(claimMatchesFilter({ status: "reportado" }, "abiertos")).toBe(true);
    expect(claimMatchesFilter({ status: "aprobado" }, "abiertos")).toBe(true);
    expect(claimMatchesFilter({ status: "pagado" }, "abiertos")).toBe(false);
  });
  it("un filtro de estado matchea exacto", () => {
    expect(claimMatchesFilter({ status: "pagado" }, "pagado")).toBe(true);
    expect(claimMatchesFilter({ status: "resuelto" }, "pagado")).toBe(false);
  });
});

describe("validateClaimInput", () => {
  it("acepta un reclamo válido", () => {
    const { input, fieldErrors } = validateClaimInput({
      client_id: "c-1",
      claim_type: "dano",
      description: "Caja rota",
      amount_usd: "340",
      insured: "on",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({
      client_id: "c-1",
      claim_type: "dano",
      description: "Caja rota",
      amount_usd: 340,
      insured: true,
    });
  });

  it("exige cliente, tipo y descripción", () => {
    const { input, fieldErrors } = validateClaimInput({});
    expect(input).toBeNull();
    expect(fieldErrors?.client_id).toBeTruthy();
    expect(fieldErrors?.claim_type).toBeTruthy();
    expect(fieldErrors?.description).toBeTruthy();
  });

  it("permite monto 0 (retraso sin indemnización) pero rechaza negativos", () => {
    const ok = validateClaimInput({
      client_id: "c-1",
      claim_type: "retraso",
      description: "Tarde",
      amount_usd: 0,
    });
    expect(ok.fieldErrors).toBeUndefined();
    expect(ok.input?.amount_usd).toBe(0);

    const bad = validateClaimInput({
      client_id: "c-1",
      claim_type: "retraso",
      description: "Tarde",
      amount_usd: -5,
    });
    expect(bad.fieldErrors?.amount_usd).toBeTruthy();
  });

  it("normaliza insured y campos opcionales vacíos a null", () => {
    const { input } = validateClaimInput({
      client_id: "c-1",
      claim_type: "otro",
      description: "x",
      amount_usd: 10,
      shipment_id: "",
      container_code: "  ",
      insured: false,
    });
    expect(input?.shipment_id).toBeNull();
    expect(input?.container_code).toBeNull();
    expect(input?.insured).toBe(false);
  });
});

describe("fault party (Slice C)", () => {
  it("valida la parte responsable", () => {
    expect(isFaultParty("proveedor")).toBe(true);
    expect(isFaultParty("transportista")).toBe(true);
    expect(isFaultParty("nope")).toBe(false);
    expect(faultPartyLabel("dtd")).toContain("DTD");
  });
});

describe("validateClaimFinancialsInput (Slice C)", () => {
  it("acepta todo vacío (campos opcionales → null)", () => {
    const { input, fieldErrors } = validateClaimFinancialsInput({});
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({
      fault_party: null,
      supplier_claim_offset_id: null,
      insured_amount_usd: null,
      policy_deductible_usd: null,
      insurer_claim_ref: null,
      payment_method: "transfer",
    });
  });

  it("acepta datos válidos (coerce montos)", () => {
    const { input, fieldErrors } = validateClaimFinancialsInput({
      fault_party: "proveedor",
      supplier_claim_offset_id: "off-1",
      insured_amount_usd: "300",
      policy_deductible_usd: 50,
      insurer_claim_ref: "CERT-1",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({
      fault_party: "proveedor",
      supplier_claim_offset_id: "off-1",
      insured_amount_usd: 300,
      policy_deductible_usd: 50,
      insurer_claim_ref: "CERT-1",
    });
  });

  it("rechaza parte responsable inválida y montos negativos", () => {
    expect(
      validateClaimFinancialsInput({ fault_party: "nope" }).fieldErrors?.fault_party,
    ).toBeTruthy();
    expect(
      validateClaimFinancialsInput({ insured_amount_usd: -5 }).fieldErrors
        ?.insured_amount_usd,
    ).toBeTruthy();
    expect(
      validateClaimFinancialsInput({ policy_deductible_usd: -1 }).fieldErrors
        ?.policy_deductible_usd,
    ).toBeTruthy();
  });

  it("payment_method default 'transfer'; valida el medio (Slice C2)", () => {
    expect(validateClaimFinancialsInput({}).input?.payment_method).toBe("transfer");
    expect(
      validateClaimFinancialsInput({ payment_method: "cash" }).input?.payment_method,
    ).toBe("cash");
    expect(
      validateClaimFinancialsInput({ payment_method: "tarjeta" }).fieldErrors
        ?.payment_method,
    ).toBeTruthy();
  });
});
