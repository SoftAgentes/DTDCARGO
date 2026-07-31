import { describe, expect, it } from "vitest";
import {
  D3_COMMERCIAL_TABLES,
  D3_FORBIDDEN_AUDIT_KEYS,
} from "../commercial-domain-contract";

describe("contrato de auditoría D3", () => {
  it("limita la frontera a las tablas del ciclo comercial", () => {
    expect(D3_COMMERCIAL_TABLES).toEqual([
      "renditions",
      "purchase_orders",
      "sales_orders",
      "prealertas",
    ]);
  });

  it("excluye nombres, notas y montos", () => {
    expect(D3_FORBIDDEN_AUDIT_KEYS).toContain("client_name");
    expect(D3_FORBIDDEN_AUDIT_KEYS).toContain("total_usd");
  });
});
