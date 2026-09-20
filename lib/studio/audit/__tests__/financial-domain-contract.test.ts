// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  D2_FINANCIAL_TABLES,
  D2_FORBIDDEN_AUDIT_KEYS,
  isD2FinancialTable,
} from "../financial-domain-contract";

describe("contrato de auditoría D2", () => {
  it("limita el trigger a las siete tablas financieras aprobadas", () => {
    expect(D2_FINANCIAL_TABLES).toHaveLength(7);
    expect(isD2FinancialTable("invoices")).toBe(true);
    expect(isD2FinancialTable("clients")).toBe(false);
  });

  it("prohíbe PII, referencias y montos en before/after", () => {
    expect(D2_FORBIDDEN_AUDIT_KEYS).toEqual(
      expect.arrayContaining([
        "client_name",
        "contact_email",
        "reference",
        "total_amount",
      ]),
    );
  });
});
