// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalize,
  buildTypeChips,
  filterDocs,
  type PortalDocView,
} from "@/lib/portal/documentos-filter";

function doc(over: Partial<PortalDocView> = {}): PortalDocView {
  return {
    id: "1",
    docType: "bl",
    typeLabel: "Bill of Lading",
    typeShort: "BL",
    shipmentCode: "DTD-2026-0311",
    meta: "240 KB · 12 jul 2026",
    url: "https://example.test/x",
    ...over,
  };
}

describe("normalize", () => {
  it("baja a minúsculas y quita acentos", () => {
    expect(normalize("Aduaná")).toBe("aduana");
    expect(normalize("  FACTURA  ")).toBe("factura");
  });
});

describe("buildTypeChips", () => {
  it("pone 'Todos' primero con el total", () => {
    const chips = buildTypeChips([doc({ id: "1" }), doc({ id: "2" })]);
    expect(chips[0]).toEqual({ key: "todos", label: "Todos", count: 2 });
  });

  it("cuenta por tipo y solo ofrece los tipos presentes", () => {
    const chips = buildTypeChips([
      doc({ id: "1", docType: "bl", typeLabel: "Bill of Lading" }),
      doc({ id: "2", docType: "bl", typeLabel: "Bill of Lading" }),
      doc({ id: "3", docType: "pod", typeLabel: "Entrega (POD)" }),
    ]);
    expect(chips.map((c) => [c.key, c.count])).toEqual([
      ["todos", 3],
      ["bl", 2],
      ["pod", 1],
    ]);
  });

  it("sin documentos deja solo 'Todos' en cero", () => {
    expect(buildTypeChips([])).toEqual([{ key: "todos", label: "Todos", count: 0 }]);
  });
});

describe("filterDocs", () => {
  const docs = [
    doc({ id: "1", docType: "bl", typeLabel: "Bill of Lading", typeShort: "BL", shipmentCode: "DTD-2026-0311" }),
    doc({ id: "2", docType: "pod", typeLabel: "Entrega (POD)", typeShort: "POD", shipmentCode: "DTD-2026-0288" }),
    doc({ id: "3", docType: "factura", typeLabel: "Factura comercial", typeShort: "FC", shipmentCode: null }),
  ];

  it("sin filtros devuelve todo", () => {
    expect(filterDocs(docs)).toHaveLength(3);
  });

  it("filtra por tipo", () => {
    expect(filterDocs(docs, { type: "pod" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("busca por etiqueta larga", () => {
    expect(filterDocs(docs, { query: "lading" }).map((d) => d.id)).toEqual(["1"]);
  });

  it("busca por etiqueta corta", () => {
    expect(filterDocs(docs, { query: "pod" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("busca por código de envío", () => {
    expect(filterDocs(docs, { query: "0288" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(filterDocs(docs, { query: "FÁCTURA" }).map((d) => d.id)).toEqual(["3"]);
  });

  it("combina tipo y texto", () => {
    expect(filterDocs(docs, { type: "bl", query: "0288" })).toEqual([]);
    expect(filterDocs(docs, { type: "bl", query: "0311" }).map((d) => d.id)).toEqual(["1"]);
  });

  it("un documento sin código de envío no rompe la búsqueda", () => {
    expect(filterDocs(docs, { query: "DTD" }).map((d) => d.id)).toEqual(["1", "2"]);
  });
});

/**
 * SDD-0308 · El packing list del proveedor entra a esta sección junto a los
 * documentos de envío, y cuelga de una COMPRA, no de un envío.
 *
 * Lo que se protege: que se pueda encontrar escribiendo el código de su compra.
 * Un documento que existe en la lista pero no aparece al buscarlo por su código
 * es, para el cliente, un documento que no está — y el fallo es mudo, porque la
 * pantalla no se rompe: sólo devuelve cero resultados.
 */
describe("filterDocs · documentos que cuelgan de una compra", () => {
  const mezcla = [
    doc({ id: "1", docType: "bl", typeLabel: "BL · Conocimiento de embarque", typeShort: "BL", shipmentCode: "DTD-2026-0311" }),
    doc({
      id: "pl:a",
      docType: "packing",
      typeLabel: "Packing list",
      typeShort: "PL",
      shipmentCode: null,
      purchaseCode: "PRE-2026-0044",
      url: "/portal/compras/PRE-2026-0044",
      kind: "abrir",
    }),
  ];

  it("encuentra el packing list por el código de su COMPRA", () => {
    const r = filterDocs(mezcla, { query: "PRE-2026-0044" });
    expect(r.map((d) => d.id)).toEqual(["pl:a"]);
  });

  it("un código de compra parcial también lo encuentra", () => {
    expect(filterDocs(mezcla, { query: "0044" }).map((d) => d.id)).toEqual(["pl:a"]);
  });

  it("el código de envío sigue sin traer el packing list", () => {
    // Cuelgan de cosas distintas: buscar un envío no puede devolver el packing
    // list de una compra que todavía no está en ese envío.
    expect(filterDocs(mezcla, { query: "DTD-2026-0311" }).map((d) => d.id)).toEqual(["1"]);
  });

  it("el chip 'packing' filtra solo los packing lists", () => {
    expect(filterDocs(mezcla, { type: "packing" }).map((d) => d.id)).toEqual(["pl:a"]);
  });

  it("y aparece como su propio chip, con su conteo", () => {
    const chips = buildTypeChips(mezcla);
    expect(chips.find((c) => c.key === "packing")).toEqual({
      key: "packing",
      label: "Packing list",
      count: 1,
    });
  });
});
