import { describe, expect, it } from "vitest";
import {
  isBillingOutcome,
  parseBillingProfile,
  secondaryKindFor,
  validateBillingIdentity,
} from "@/lib/portal/billing-identity";

describe("secondaryKindFor", () => {
  it("la secundaria es siempre el tipo opuesto; sin tipo se asume persona", () => {
    expect(secondaryKindFor("persona")).toBe("empresa");
    expect(secondaryKindFor("empresa")).toBe("persona");
    expect(secondaryKindFor(null)).toBe("empresa");
  });
});

describe("validateBillingIdentity (SDD-0487)", () => {
  it("empresa: razón social limpia, RIF canónico y domicilio opcional", () => {
    expect(
      validateBillingIdentity("empresa", {
        legalName: "  Importadora   Pérez C.A. ",
        doc: "j123456789",
        fiscalAddress: "",
      }),
    ).toEqual({
      ok: true,
      values: { legalName: "Importadora Pérez C.A.", doc: "J-12345678-9", fiscalAddress: null },
    });
  });

  it("persona: cédula canónica y nunca domicilio fiscal", () => {
    expect(
      validateBillingIdentity("persona", { legalName: "Juan Gómez", doc: "v 20.000.000", fiscalAddress: "x" }),
    ).toMatchObject({ ok: false });
    expect(
      validateBillingIdentity("persona", { legalName: "Juan Gómez", doc: "v-20000000", fiscalAddress: "Av. X 123" }),
    ).toEqual({ ok: true, values: { legalName: "Juan Gómez", doc: "V-20000000", fiscalAddress: null } });
  });

  it("marca cada campo con su mensaje", () => {
    const out = validateBillingIdentity("empresa", { legalName: "A", doc: "V-123", fiscalAddress: "Av" });
    expect(out).toEqual({
      ok: false,
      fieldErrors: {
        legalName: "Escribe la razón social tal como aparece en el RIF.",
        doc: "RIF inválido. Formato J-12345678-9.",
        fiscalAddress: "El domicilio fiscal debe tener entre 5 y 300 caracteres.",
      },
    });
  });

  it("control: una C como prefijo no es un RIF válido en el repo", () => {
    expect(validateBillingIdentity("empresa", { legalName: "Consejo", doc: "C-12345678-9", fiscalAddress: "" }))
      .toMatchObject({ ok: false });
  });
});

describe("parseBillingProfile", () => {
  const raw = {
    principal_kind: "persona",
    principal_name: "Carlos Pérez",
    principal_doc: "V-12345678",
    secondary: { kind: "empresa", legal_name: "Importadora Pérez C.A.", doc: "J-12345678-9", fiscal_address: null },
    billing_kind: "empresa",
  };

  it("lee la respuesta de la RPC", () => {
    expect(parseBillingProfile(raw)).toEqual({
      principalKind: "persona",
      principalName: "Carlos Pérez",
      principalDoc: "V-12345678",
      secondary: { kind: "empresa", legalName: "Importadora Pérez C.A.", doc: "J-12345678-9", fiscalAddress: null },
      billingKind: "empresa",
    });
    expect(parseBillingProfile({ ...raw, secondary: null, billing_kind: "persona" })?.secondary).toBeNull();
  });

  it.each([
    ["null", null],
    ["un tipo inventado", { ...raw, billing_kind: "tercero" }],
    ["una secundaria sin documento", { ...raw, secondary: { kind: "empresa", legal_name: "X" } }],
  ])("devuelve null ante %s", (_label, value) => {
    expect(parseBillingProfile(value)).toBeNull();
  });

  it("reconoce sólo los resultados de 0466", () => {
    expect(["applied", "no_changes", "blocked", "rate_limited", "missing_identity"].every(isBillingOutcome)).toBe(true);
    expect(isBillingOutcome("ok")).toBe(false);
  });
});
