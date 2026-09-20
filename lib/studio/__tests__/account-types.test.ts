// @vitest-environment node
/**
 * Tests del plan de cuentas (SDD-0040) — capa pura `account-types`.
 *
 * Cubre criterios de aceptación §6 (Lib):
 *  - normalSide por tipo
 *  - buildAccountTree anida por code/parent
 *  - compareCodes ordena jerárquico natural
 *  - validateAccountInput (manual, sin zod)
 */

import { describe, it, expect } from "vitest";
import {
  acctTypeBadgeTone,
  acctTypeLabel,
  accountDepth,
  buildAccountTree,
  compareCodes,
  flattenTree,
  normalSide,
  parentCode,
  validateAccountInput,
  type Account,
} from "../account-types";

function acct(code: string, type: Account["type"], postable = true): Account {
  return {
    id: `id-${code}`,
    tenant_id: "t1",
    code,
    name: `Cuenta ${code}`,
    type,
    parent_id: null,
    qbo_type: null,
    subtype: null,
    is_postable: postable,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("normalSide", () => {
  it("A/CGS/G son debe-normal", () => {
    expect(normalSide("A")).toBe("debit");
    expect(normalSide("CGS")).toBe("debit");
    expect(normalSide("G")).toBe("debit");
  });
  it("P/PT/I son haber-normal", () => {
    expect(normalSide("P")).toBe("credit");
    expect(normalSide("PT")).toBe("credit");
    expect(normalSide("I")).toBe("credit");
  });
});

describe("parentCode / accountDepth", () => {
  it("parentCode quita el último segmento", () => {
    expect(parentCode("1.1.2")).toBe("1.1");
    expect(parentCode("6.10")).toBe("6");
    expect(parentCode("4")).toBeNull();
  });
  it("accountDepth cuenta los puntos", () => {
    expect(accountDepth("1")).toBe(0);
    expect(accountDepth("1.1")).toBe(1);
    expect(accountDepth("1.1.2")).toBe(2);
    expect(accountDepth("1.1.1.1")).toBe(3);
  });
});

describe("compareCodes (orden jerárquico natural)", () => {
  it("ordena segmentos como números, no como texto", () => {
    const codes = ["1.10", "1.2", "1.1", "10", "2", "1"];
    const sorted = [...codes].sort(compareCodes);
    expect(sorted).toEqual(["1", "1.1", "1.2", "1.10", "2", "10"]);
  });
});

describe("buildAccountTree", () => {
  it("anida por prefijo de code y ordena", () => {
    const accounts = [
      acct("1", "A", false),
      acct("1.2", "A", false),
      acct("1.1", "A", false),
      acct("1.1.2", "A"),
      acct("1.1.1", "A"),
      acct("2", "P", false),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree.map((n) => n.code)).toEqual(["1", "2"]);
    const root1 = tree[0];
    expect(root1.children.map((c) => c.code)).toEqual(["1.1", "1.2"]);
    expect(root1.children[0].children.map((c) => c.code)).toEqual([
      "1.1.1",
      "1.1.2",
    ]);
  });

  it("flattenTree devuelve orden de despliegue DFS", () => {
    const accounts = [
      acct("1", "A", false),
      acct("1.1", "A"),
      acct("2", "P", false),
      acct("2.1", "P"),
    ];
    const flat = flattenTree(buildAccountTree(accounts));
    expect(flat.map((n) => n.code)).toEqual(["1", "1.1", "2", "2.1"]);
  });

  it("una cuenta huérfana (sin padre presente) sube a la raíz", () => {
    const accounts = [acct("5.3", "CGS")];
    const tree = buildAccountTree(accounts);
    expect(tree.map((n) => n.code)).toEqual(["5.3"]);
  });
});

describe("validateAccountInput", () => {
  it("acepta input válido", () => {
    const r = validateAccountInput({
      code: " 6.20 ",
      name: " Gastos varios ",
      type: "G",
      is_postable: true,
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.code).toBe("6.20");
    expect(r.input?.name).toBe("Gastos varios");
    expect(r.input?.type).toBe("G");
  });

  it("exige código y nombre", () => {
    const r = validateAccountInput({ code: "", name: "", type: "G" });
    expect(r.fieldErrors?.code).toBeDefined();
    expect(r.fieldErrors?.name).toBeDefined();
  });

  it("rechaza código no numérico jerárquico", () => {
    const r = validateAccountInput({ code: "6-20", name: "X", type: "G" });
    expect(r.fieldErrors?.code).toBeDefined();
  });

  it("exige un tipo válido", () => {
    const r = validateAccountInput({
      code: "6.20",
      name: "X",
      type: "ZZ" as Account["type"],
    });
    expect(r.fieldErrors?.type).toBeDefined();
  });
});

describe("labels / tones", () => {
  it("acctTypeLabel mapea los 6 tipos", () => {
    expect(acctTypeLabel("A")).toBe("Activo");
    expect(acctTypeLabel("CGS")).toBe("Costo de ventas");
  });
  it("acctTypeBadgeTone devuelve un tono por tipo", () => {
    expect(acctTypeBadgeTone("I")).toBe("success");
    expect(acctTypeBadgeTone("CGS")).toBe("danger");
  });
});
