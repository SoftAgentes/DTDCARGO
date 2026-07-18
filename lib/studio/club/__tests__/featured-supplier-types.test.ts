import { describe, it, expect } from "vitest";
import {
  validateFeaturedSupplierInput,
  featuredSupplierStatusLabel,
  featuredSupplierStatusTone,
  featuredSupplierStatsFrom,
  periodLabel,
  currentPeriod,
  FEATURED_SUPPLIER_STATUSES,
  type FeaturedSupplier,
} from "@/lib/studio/club/featured-supplier-types";

describe("validateFeaturedSupplierInput (Slice D · proveedor del mes)", () => {
  const base = { period: "2026-07", supplierName: "Fábrica verificada Yiwu" };

  it("acepta un alta válida con default 'borrador'", () => {
    const { input, fieldErrors } = validateFeaturedSupplierInput(base);
    expect(fieldErrors).toBeNull();
    expect(input?.period).toBe("2026-07");
    expect(input?.supplierName).toBe("Fábrica verificada Yiwu");
    expect(input?.status).toBe("borrador");
    expect(input?.inspectionId).toBeNull();
  });

  it("rechaza sin nombre de proveedor (white-label requerido)", () => {
    const { input, fieldErrors } = validateFeaturedSupplierInput({ ...base, supplierName: "  " });
    expect(input).toBeNull();
    expect(fieldErrors?.supplierName).toBeTruthy();
  });

  it("rechaza período con formato inválido (no AAAA-MM)", () => {
    for (const bad of ["2026", "2026-7", "julio", "2026/07"]) {
      const { fieldErrors } = validateFeaturedSupplierInput({ ...base, period: bad });
      expect(fieldErrors?.period).toBeTruthy();
    }
  });

  it("rechaza mes fuera de rango (00 o 13)", () => {
    expect(validateFeaturedSupplierInput({ ...base, period: "2026-00" }).fieldErrors?.period).toBeTruthy();
    expect(validateFeaturedSupplierInput({ ...base, period: "2026-13" }).fieldErrors?.period).toBeTruthy();
  });

  it("conserva inspectionId (D8: derivado de inspección) y estado 'publicado'", () => {
    const { input } = validateFeaturedSupplierInput({
      ...base,
      inspectionId: "insp-1",
      status: "publicado",
    });
    expect(input?.inspectionId).toBe("insp-1");
    expect(input?.status).toBe("publicado");
  });

  it("rechaza un estado fuera del enum", () => {
    const { fieldErrors } = validateFeaturedSupplierInput({
      ...base,
      // @ts-expect-error entrada inválida a propósito
      status: "archivado",
    });
    expect(fieldErrors?.status).toBeTruthy();
  });
});

describe("helpers de proveedor del mes", () => {
  it("periodLabel formatea AAAA-MM a mes legible", () => {
    expect(periodLabel("2026-07")).toBe("julio 2026");
    expect(periodLabel("2026-01")).toBe("enero 2026");
    expect(periodLabel("basura")).toBe("basura");
  });

  it("currentPeriod devuelve AAAA-MM del mes dado (UTC)", () => {
    expect(currentPeriod(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03");
  });

  it("stats cuenta publicados y total", () => {
    const rows = [
      { status: "publicado" },
      { status: "borrador" },
      { status: "publicado" },
    ] as FeaturedSupplier[];
    const stats = featuredSupplierStatsFrom(rows);
    expect(stats.publicados).toBe(2);
    expect(stats.total).toBe(3);
  });

  it("cubre los estados con label y tono", () => {
    expect(FEATURED_SUPPLIER_STATUSES).toHaveLength(2);
    for (const s of FEATURED_SUPPLIER_STATUSES) {
      expect(featuredSupplierStatusLabel(s)).toBeTruthy();
      expect(["neutral", "success"]).toContain(featuredSupplierStatusTone(s));
    }
  });
});
