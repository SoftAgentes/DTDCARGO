/**
 * Tests de los helpers PUROS del hub de Documentos (SDD-0049 Slice B).
 *
 * Cubre Acceptance §5 Slice B (lógica de navegación/filtros del hub):
 *  - hubDeepLink: deep-link a la ruta del módulo por entity_type (none → null)
 *  - hubHref: arma la query string preservando/omitiendo defaults
 *  - folderTreeCount: suma de subcarpetas en grupo top-level vs hoja vs all
 */
import { describe, it, expect } from "vitest";
import {
  hubDeepLink,
  hubHref,
  folderTreeCount,
  HUB_VIEWS,
} from "../hub-helpers";

describe("hubDeepLink", () => {
  it("shipment → módulo tracking", () => {
    const link = hubDeepLink("shipment");
    expect(link).not.toBeNull();
    expect(link!.href).toBe("/studio/tracking");
    expect(link!.label).toBe("Embarque");
  });

  it("client → módulo clientes", () => {
    expect(hubDeepLink("client")?.href).toBe("/studio/clientes");
  });

  it("invoice → módulo facturación", () => {
    expect(hubDeepLink("invoice")?.href).toBe("/studio/facturacion");
  });

  it("expense → módulo gastos", () => {
    expect(hubDeepLink("expense")?.href).toBe("/studio/gastos");
  });

  it("consolidation/booking → módulo naviera", () => {
    expect(hubDeepLink("consolidation")?.href).toBe("/studio/naviera");
    expect(hubDeepLink("booking")?.href).toBe("/studio/naviera");
  });

  it("none → null (no clickeable)", () => {
    expect(hubDeepLink("none")).toBeNull();
  });
});

describe("hubHref", () => {
  it("sin patch → ruta limpia (defaults omitidos)", () => {
    expect(hubHref({})).toBe("/studio/documentos");
  });

  it("folder/view = 'all' se omiten (son default)", () => {
    expect(hubHref({ folder: "all", view: "all" })).toBe("/studio/documentos");
  });

  it("folder concreto", () => {
    expect(hubHref({ folder: "log-bl" })).toBe(
      "/studio/documentos?folder=log-bl",
    );
  });

  it("view de filtro", () => {
    expect(hubHref({ view: "por-vencer" })).toBe(
      "/studio/documentos?view=por-vencer",
    );
  });

  it("q se incluye trimmeado; vacío se omite", () => {
    expect(hubHref({ q: "  BL  " })).toBe("/studio/documentos?q=BL");
    expect(hubHref({ q: "   " })).toBe("/studio/documentos");
  });

  it("combina folder + q", () => {
    const href = hubHref({ folder: "con-fact", q: "factura" });
    expect(href).toContain("folder=con-fact");
    expect(href).toContain("q=factura");
  });
});

describe("folderTreeCount", () => {
  const counts: Record<string, number> = {
    all: 7,
    "log-bl": 2,
    "log-packing": 1,
    "con-fact": 3,
    "op-kyc": 1,
  };

  it("'all' → total", () => {
    expect(folderTreeCount(counts, "all")).toBe(7);
  });

  it("grupo top-level → suma de sus subcarpetas", () => {
    // log = log-bl(2) + log-packing(1) + log-origen(0) + log-fotos(0) = 3
    expect(folderTreeCount(counts, "log")).toBe(3);
    // con = con-fact(3) + resto(0) = 3
    expect(folderTreeCount(counts, "con")).toBe(3);
  });

  it("subcarpeta (hoja) → conteo directo", () => {
    expect(folderTreeCount(counts, "log-bl")).toBe(2);
    expect(folderTreeCount(counts, "op-kyc")).toBe(1);
  });

  it("carpeta sin docs → 0", () => {
    expect(folderTreeCount(counts, "adu-dua")).toBe(0);
    expect(folderTreeCount(counts, "otr")).toBe(0);
  });
});

describe("HUB_VIEWS", () => {
  it("expone las 4 vistas (all + 3 filtros)", () => {
    expect(HUB_VIEWS.map((v) => v.id)).toEqual([
      "all",
      "por-vencer",
      "pendientes",
      "sin-vincular",
    ]);
  });
});
