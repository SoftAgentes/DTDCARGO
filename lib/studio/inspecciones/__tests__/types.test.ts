import { describe, it, expect } from "vitest";
import {
  computeInspectionKpis,
  isSameMonth,
  buildReportNoDisplay,
  inspectionMatchesFilters,
  inspectionTypePrefix,
  INSPECTION_TYPE_META,
} from "@/lib/studio/inspecciones/types";

const REF = new Date("2026-06-15T00:00:00Z");

describe("isSameMonth", () => {
  it("true para una fecha del mismo mes/año", () => {
    expect(isSameMonth("2026-06-01", REF)).toBe(true);
    expect(isSameMonth("2026-06-30", REF)).toBe(true);
  });
  it("false para otro mes/año o fecha nula/inválida", () => {
    expect(isSameMonth("2026-05-31", REF)).toBe(false);
    expect(isSameMonth("2025-06-15", REF)).toBe(false);
    expect(isSameMonth(null, REF)).toBe(false);
    expect(isSameMonth("basura", REF)).toBe(false);
  });
});

describe("computeInspectionKpis", () => {
  const rows = [
    {
      inspection_date: "2026-06-02",
      conclusion: "approved" as const,
      status: "final" as const,
    },
    {
      inspection_date: "2026-06-10",
      conclusion: "observations" as const,
      status: "final" as const,
    },
    {
      inspection_date: "2026-06-20",
      conclusion: "rejected" as const,
      status: "final" as const,
    },
    {
      inspection_date: "2026-05-30",
      conclusion: "approved" as const,
      status: "final" as const,
    },
    { inspection_date: null, conclusion: null, status: "draft" as const },
  ];

  it("cuenta solo los del mes y separa aprobados de observados", () => {
    const k = computeInspectionKpis(rows, REF);
    expect(k.month_count).toBe(3); // jun 2 / 10 / 20
    expect(k.month_approved).toBe(1); // jun 2
    expect(k.month_observed).toBe(2); // observations + rejected
    expect(k.draft_count).toBe(1);
  });

  it("devuelve ceros con lista vacía", () => {
    expect(computeInspectionKpis([], REF)).toEqual({
      month_count: 0,
      month_approved: 0,
      month_observed: 0,
      draft_count: 0,
    });
  });
});

describe("correlativo display", () => {
  it("prefija QC para PSI y FA para fábrica, con padding 4", () => {
    expect(inspectionTypePrefix("product_psi")).toBe("DTD-QC-");
    expect(inspectionTypePrefix("factory_audit")).toBe("DTD-FA-");
    expect(buildReportNoDisplay("product_psi", 7)).toBe("DTD-QC-0007");
    expect(buildReportNoDisplay("factory_audit", 123)).toBe("DTD-FA-0123");
  });

  it("el prefijo del meta coincide con la migración (DTD-QC / DTD-FA)", () => {
    expect(INSPECTION_TYPE_META.product_psi.prefix).toBe("DTD-QC-");
    expect(INSPECTION_TYPE_META.factory_audit.prefix).toBe("DTD-FA-");
  });
});

describe("inspectionMatchesFilters", () => {
  const row = {
    type: "product_psi" as const,
    status: "draft" as const,
    client_id: "c1",
  };

  it("pasa con todos en 'todos'", () => {
    expect(inspectionMatchesFilters(row, "todos", "todos", "todos")).toBe(true);
  });
  it("filtra por tipo", () => {
    expect(inspectionMatchesFilters(row, "product_psi", "todos", "todos")).toBe(
      true,
    );
    expect(
      inspectionMatchesFilters(row, "factory_audit", "todos", "todos"),
    ).toBe(false);
  });
  it("filtra por estado", () => {
    expect(inspectionMatchesFilters(row, "todos", "draft", "todos")).toBe(true);
    expect(inspectionMatchesFilters(row, "todos", "final", "todos")).toBe(
      false,
    );
  });
  it("filtra por cliente", () => {
    expect(inspectionMatchesFilters(row, "todos", "todos", "c1")).toBe(true);
    expect(inspectionMatchesFilters(row, "todos", "todos", "c2")).toBe(false);
  });
});
