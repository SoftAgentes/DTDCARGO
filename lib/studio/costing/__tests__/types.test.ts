/**
 * Tests del motor puro de Costing & Margen (SDD-0053 · Slice A).
 *
 * Cubre Acceptance §5 Slice A (types):
 *  - totalCost suma las 7 categorías.
 *  - shipmentEconomics: margen + marginPct; revenue 0 → marginPct 0 (sin NaN).
 *  - marginTone: los 4 umbrales + bordes 0/15/30.
 *  - convertUsd / fmtMoney: USD passthrough, VES × rate.
 *  - matchTemplate: match + miss.
 *  - validateCostInput / validateTemplateInput: negativos/NaN rechazados.
 */

import { describe, it, expect } from "vitest";
import {
  COST_CATEGORIES,
  convertUsd,
  emptyCosts,
  fmtMoney,
  marginTone,
  matchTemplate,
  shipmentEconomics,
  totalCost,
  validateCostInput,
  validateTemplateInput,
  type RouteCostTemplate,
} from "../types";

const COSTS = {
  freight: 4200,
  customs: 1800,
  transport: 1100,
  handling: 580,
  insurance: 280,
  commission: 630,
  other: 420,
};
const SUM = 4200 + 1800 + 1100 + 580 + 280 + 630 + 420; // 9010

describe("COST_CATEGORIES", () => {
  it("tiene las 7 categorías con colorToken como var(--*) del sistema", () => {
    expect(COST_CATEGORIES).toHaveLength(7);
    expect(COST_CATEGORIES.map((c) => c.key)).toEqual([
      "freight",
      "customs",
      "transport",
      "handling",
      "insurance",
      "commission",
      "other",
    ]);
    for (const c of COST_CATEGORIES) {
      expect(c.colorToken).toMatch(/^var\(--[a-z-]+\)$/);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("emptyCosts / totalCost", () => {
  it("emptyCosts son 7 ceros", () => {
    const e = emptyCosts();
    expect(totalCost(e)).toBe(0);
    expect(Object.values(e)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("totalCost suma las 7 categorías", () => {
    expect(totalCost(COSTS)).toBe(SUM);
  });

  it("totalCost de null/undefined → 0", () => {
    expect(totalCost(null)).toBe(0);
    expect(totalCost(undefined)).toBe(0);
  });

  it("totalCost coacciona strings (numeric de Supabase) y descarta basura", () => {
    // Supabase devuelve numeric como string; totalCost coacciona con Number().
    expect(
      totalCost({ freight: "1000", customs: "abc" } as unknown as Record<string, number>),
    ).toBe(1000);
  });
});

describe("shipmentEconomics", () => {
  it("revenue > cost → margen positivo y marginPct correcto", () => {
    const eco = shipmentEconomics({ revenueUsd: 12000, costs: COSTS });
    expect(eco.totalCost).toBe(SUM);
    expect(eco.revenue).toBe(12000);
    expect(eco.margin).toBe(12000 - SUM);
    expect(eco.marginPct).toBeCloseTo(((12000 - SUM) / 12000) * 100, 6);
    // las 7 categorías se proyectan en el resultado
    expect(eco.freight).toBe(4200);
    expect(eco.other).toBe(420);
  });

  it("cost > revenue → margen negativo", () => {
    const eco = shipmentEconomics({ revenueUsd: 5000, costs: COSTS });
    expect(eco.margin).toBe(5000 - SUM);
    expect(eco.margin).toBeLessThan(0);
    expect(eco.marginPct).toBeLessThan(0);
  });

  it("revenue 0 → marginPct 0 (sin NaN/Infinity)", () => {
    const eco = shipmentEconomics({ revenueUsd: 0, costs: COSTS });
    expect(eco.revenue).toBe(0);
    expect(eco.margin).toBe(-SUM);
    expect(eco.marginPct).toBe(0);
    expect(Number.isNaN(eco.marginPct)).toBe(false);
    expect(Number.isFinite(eco.marginPct)).toBe(true);
  });

  it("sin costos (null) → totalCost 0, margen = revenue", () => {
    const eco = shipmentEconomics({ revenueUsd: 8000, costs: null });
    expect(eco.totalCost).toBe(0);
    expect(eco.margin).toBe(8000);
    expect(eco.marginPct).toBe(100);
  });
});

describe("marginTone", () => {
  it("los 4 umbrales", () => {
    expect(marginTone(45)).toBe("success");
    expect(marginTone(20)).toBe("info");
    expect(marginTone(8)).toBe("warning");
    expect(marginTone(-5)).toBe("danger");
  });

  it("bordes exactos 30 / 15 / 0", () => {
    expect(marginTone(30)).toBe("success"); // ≥30
    expect(marginTone(29.99)).toBe("info");
    expect(marginTone(15)).toBe("info"); // ≥15
    expect(marginTone(14.99)).toBe("warning");
    expect(marginTone(0)).toBe("warning"); // ≥0
    expect(marginTone(-0.01)).toBe("danger");
  });

  it("no-finito (NaN/Infinity) → danger (fail-safe)", () => {
    expect(marginTone(Number.NaN)).toBe("danger");
    expect(marginTone(Number.POSITIVE_INFINITY)).toBe("danger");
    expect(marginTone(Number.NEGATIVE_INFINITY)).toBe("danger");
  });
});

describe("convertUsd / fmtMoney", () => {
  it("USD passthrough", () => {
    expect(convertUsd(1000, "USD", 36.45)).toBe(1000);
    expect(fmtMoney(1000, "USD", 36.45)).toBe("$1,000");
  });

  it("VES = usd × rate", () => {
    expect(convertUsd(1000, "VES", 36.45)).toBe(36450);
    expect(fmtMoney(1000, "VES", 36.45)).toBe("Bs.36,450");
  });

  it("monto inválido → 0", () => {
    expect(convertUsd(Number.NaN, "USD", 36.45)).toBe(0);
    expect(fmtMoney(Number.NaN, "VES", 36.45)).toBe("Bs.0");
  });
});

describe("matchTemplate", () => {
  function tpl(p: Partial<RouteCostTemplate>): RouteCostTemplate {
    return {
      id: p.id ?? "t1",
      tenant_id: "tn1",
      name: p.name ?? "Yiwu → Pto Cabello · LCL",
      origin: p.origin ?? "YIW",
      destination: p.destination ?? "PBL",
      shipment_service: p.shipment_service ?? "consolidado_lcl",
      freight: 4200,
      customs: 1800,
      transport: 1100,
      handling: 580,
      insurance: 280,
      commission: 630,
      other: 420,
      active: p.active ?? true,
      notes: null,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-05-01T00:00:00Z",
      deleted_at: p.deleted_at ?? null,
      ...p,
    };
  }

  const templates = [
    tpl({ id: "a", origin: "YIW", destination: "PBL", shipment_service: "consolidado_lcl" }),
    tpl({ id: "b", origin: "SZX", destination: "LGU", shipment_service: "fcl_directo" }),
  ];

  it("match exacto por origin+destination+service", () => {
    const m = matchTemplate(templates, {
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidado_lcl",
    });
    expect(m?.id).toBe("a");
  });

  it("miss: servicio distinto → null", () => {
    const m = matchTemplate(templates, {
      origin: "YIW",
      destination: "PBL",
      shipment_service: "fcl_directo",
    });
    expect(m).toBeNull();
  });

  it("miss: ruta inexistente → null", () => {
    const m = matchTemplate(templates, {
      origin: "ZZZ",
      destination: "PBL",
      shipment_service: "consolidado_lcl",
    });
    expect(m).toBeNull();
  });

  it("ignora templates inactivos o borrados", () => {
    const ts = [
      tpl({ id: "inactive", active: false }),
      tpl({ id: "deleted", deleted_at: "2026-05-02T00:00:00Z" }),
    ];
    const m = matchTemplate(ts, {
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidado_lcl",
    });
    expect(m).toBeNull();
  });
});

describe("validateCostInput", () => {
  it("acepta 7 montos válidos", () => {
    const { input, fieldErrors } = validateCostInput({
      shipment_id: "s1",
      ...COSTS,
      notes: "  flete subió ",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.shipment_id).toBe("s1");
    expect(input?.freight).toBe(4200);
    expect(input?.notes).toBe("flete subió");
  });

  it("rechaza shipment_id vacío", () => {
    const { fieldErrors } = validateCostInput({ ...COSTS });
    expect(fieldErrors?.shipment_id).toBeDefined();
  });

  it("rechaza negativos", () => {
    const { fieldErrors, input } = validateCostInput({
      shipment_id: "s1",
      ...COSTS,
      freight: -100,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.freight).toBeDefined();
  });

  it("rechaza NaN (texto no numérico)", () => {
    const { fieldErrors } = validateCostInput({
      shipment_id: "s1",
      ...COSTS,
      customs: "abc",
    });
    expect(fieldErrors?.customs).toBeDefined();
  });
});

describe("validateTemplateInput", () => {
  it("acepta template válido", () => {
    const { input, fieldErrors } = validateTemplateInput({
      name: "Yiwu → Pto Cabello · LCL",
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidado_lcl",
      ...COSTS,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.name).toBe("Yiwu → Pto Cabello · LCL");
    expect(input?.shipment_service).toBe("consolidado_lcl");
    expect(input?.active).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const { fieldErrors } = validateTemplateInput({ ...COSTS });
    expect(fieldErrors?.name).toBeDefined();
  });

  it("rechaza servicio inválido", () => {
    const { fieldErrors } = validateTemplateInput({
      name: "X",
      shipment_service: "no_existe",
      ...COSTS,
    });
    expect(fieldErrors?.shipment_service).toBeDefined();
  });

  it("servicio vacío/null es válido (template genérico)", () => {
    const { input, fieldErrors } = validateTemplateInput({
      name: "Genérico",
      shipment_service: "",
      ...COSTS,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.shipment_service).toBeNull();
  });

  it("rechaza montos negativos/NaN", () => {
    const neg = validateTemplateInput({ name: "X", ...COSTS, handling: -5 });
    expect(neg.fieldErrors?.handling).toBeDefined();
    const nan = validateTemplateInput({ name: "X", ...COSTS, insurance: "x" });
    expect(nan.fieldErrors?.insurance).toBeDefined();
  });
});
