import { describe, it, expect } from "vitest";
import {
  parsePsiPayload,
  parseFactoryPayload,
} from "@/lib/studio/inspecciones/validators";
import {
  PSI_CATEGORY_KEYS,
  ensurePsiPayload,
  ensureFactoryPayload,
} from "@/lib/studio/inspecciones/types";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parsePsiPayload", () => {
  it("arma orden + AQL + categorías (7 fijas) + overall", () => {
    const f = fd({
      order_po: "PO-99",
      order_orderQty: "1000",
      aql_sampleSize: "80",
      aql_found_critical: "0",
      aql_found_major: "2",
      aql_max_major: "1.5",
      overall: "fail",
      cat_conform_quantity: "true",
      cat_comment_quantity: "OK",
      cat_conform_packaging: "false",
    });
    const p = parsePsiPayload(f);
    expect(p.order.po).toBe("PO-99");
    expect(p.order.orderQty).toBe(1000);
    expect(p.aql.sampleSize).toBe(80);
    expect(p.aql.found.major).toBe(2);
    expect(p.aql.maxAllowed.major).toBe(1.5);
    expect(p.overall).toBe("fail");
    expect(p.categories).toHaveLength(PSI_CATEGORY_KEYS.length);
    const qty = p.categories.find((c) => c.key === "quantity")!;
    expect(qty.conform).toBe(true);
    expect(qty.comment).toBe("OK");
    expect(p.categories.find((c) => c.key === "packaging")!.conform).toBe(false);
  });

  it("descarta números negativos (→ null o 0) y overall inválido → pending", () => {
    const f = fd({
      order_orderQty: "-5",
      prod_pctDone: "-1",
      overall: "ufo",
    });
    const p = parsePsiPayload(f);
    expect(p.order.orderQty).toBeNull();
    expect(p.production.pctDone).toBeNull();
    expect(p.overall).toBe("pending");
  });

  it("recolecta defectos dinámicos e ignora filas sin descripción", () => {
    const f = fd({
      def_desc_0: "Rayón en tapa",
      def_critical_0: "0",
      def_major_0: "3",
      def_minor_0: "1",
      def_desc_1: "", // vacía → ignorada
      def_major_1: "9",
      def_desc_2: "Color fuera de tono",
      def_minor_2: "2",
    });
    const p = parsePsiPayload(f);
    expect(p.defects).toHaveLength(2);
    expect(p.defects[0]).toEqual({ desc: "Rayón en tapa", critical: 0, major: 3, minor: 1 });
    expect(p.defects[1].desc).toBe("Color fuera de tono");
  });

  it("round-trip: ensurePsiPayload completa lo que parse dejó", () => {
    const p = ensurePsiPayload(parsePsiPayload(fd({ order_po: "X" })));
    expect(p.categories).toHaveLength(7);
    expect(p.measures.masterBox).toBeNull();
  });
});

describe("parseFactoryPayload", () => {
  it("arma legal + bank + facilities (tri-bool) + companyType del enum", () => {
    const f = fd({
      legal_supplierName: "Fábrica X",
      legal_companyType: "manufactory",
      legal_clientProductInScope: "true",
      legal_abnormalList: "false",
      bank_companySeal: "true",
      fac_tidy: "true",
      fac_lit: "",
      score: "88",
      hr_dept_0: "Producción",
      hr_perFactory_0: "120",
      hr_actual_0: "118",
    });
    const p = parseFactoryPayload(f);
    expect(p.legal.supplierName).toBe("Fábrica X");
    expect(p.legal.companyType).toBe("manufactory");
    expect(p.legal.clientProductInScope).toBe(true);
    expect(p.legal.abnormalList).toBe(false);
    expect(p.bank.companySeal).toBe(true);
    expect(p.facilities.tidy).toBe(true);
    expect(p.facilities.lit).toBeNull();
    expect(p.score).toBe(88);
    expect(p.hr[0]).toEqual({ dept: "Producción", perFactory: 120, actual: 118 });
  });

  it("companyType inválido → null; score > 100 → null", () => {
    const p = parseFactoryPayload(fd({ legal_companyType: "xx", score: "150" }));
    expect(p.legal.companyType).toBeNull();
    expect(p.score).toBeNull();
  });

  it("turnover ignora filas totalmente vacías; máquinas/reqs sin nombre se ignoran", () => {
    const f = fd({
      turn_year_0: "2025",
      turn_amount_0: "1M",
      turn_year_1: "",
      turn_amount_1: "",
      turn_topMarkets_1: "",
      turn_pctVolume_1: "",
      mach_name_0: "Inyectora",
      mach_qty_0: "4",
      mach_name_1: "",
      req_question_0: "¿Certificación ISO?",
      req_answer_0: "Sí",
      req_question_1: "",
    });
    const p = parseFactoryPayload(f);
    expect(p.turnover).toHaveLength(1);
    expect(p.turnover[0].year).toBe(2025);
    expect(p.machines).toHaveLength(1);
    expect(p.machines[0].name).toBe("Inyectora");
    expect(p.requirements).toHaveLength(1);
  });

  it("round-trip: ensureFactoryPayload completa defaults", () => {
    const p = ensureFactoryPayload(parseFactoryPayload(fd({ legal_supplierName: "X" })));
    expect(p.hr.length).toBeGreaterThanOrEqual(8);
    expect(p.turnover.length).toBeGreaterThanOrEqual(3);
  });
});
