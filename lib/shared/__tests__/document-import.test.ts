import { describe, expect, it } from "vitest";
import { aggregateTransportDeclarations, DocumentMergeReviewError, projectSupplierDocument, reconcileDocumentEdit, computeDocumentTotals, confirmationIssues, emptyDocumentDraft, fromPackingPayload, mergeDocuments, parseDocumentDraft, toPackingPayload, type DocumentDraft, type DocumentKind , toPackingDraft } from "../document-import";

function mixed(): DocumentDraft {
  const d = emptyDocumentDraft();
  d.currency = "USD"; d.supplier.wechat = "synthetic-supplier";
  d.products = [
    { id: "p1", name: "Camisa", nameZh: "衬衫", code: "A1", brand: "", material: "", quantity: 100, unitPrice: 2, currency: "USD", unit: "pcs" },
    { id: "p2", name: "Pantalón", nameZh: "", code: "A2", brand: "", material: "", quantity: 50, unitPrice: 3, currency: "USD", unit: "pcs" },
  ];
  d.groups = [{ id: "g1", label: "1-10", cartons: 10, grossWeightKg: 200, cbm: 1.5, items: [{ productId: "p1", quantity: 100 }, { productId: "p2", quantity: 50 }] }];
  return d;
}
function source(d: DocumentDraft, id: string, kind: DocumentKind, paths: string[]): void { d.sources.push({ id, fileName: id + ".xlsx", kind, locations: paths.map((path) => ({ path, sheet: "Sheet1", cell: "A1", page: null })) }); }

describe("S2 autoridad de campos, neto y proyección", () => {
  it("mantiene ausentes las extensiones legacy y suma el neto una vez por grupo mixto", () => {
    const legacy = parseDocumentDraft(mixed());
    expect(legacy).not.toHaveProperty("fieldDecisions"); expect(legacy).not.toHaveProperty("transportDeclarations");
    expect(computeDocumentTotals(legacy)).not.toHaveProperty("netWeightKg");
    legacy.groups[0].netWeightKg = 180;
    expect(computeDocumentTotals(legacy)).toMatchObject({ netWeightKg: 180, grossWeightKg: 200, cartons: 10 });
    legacy.groups[0].netWeightKg = 201;
    expect(confirmationIssues(legacy).some(i => i.code === "net_exceeds_gross")).toBe(true);
  });
  it.each(["products.0.quantity", "products.p1.__proto__", "constructor", "groups.missing.cbm", "products.p1.quantity.extra"])("rechaza autoridad en ruta no cerrada %s", path => {
    expect(() => parseDocumentDraft({ ...mixed(), fieldDecisions: [{ path, origin: "manual", references: [] }] })).toThrow();
  });
  it("exige evidencia existente, única, del mismo campo y con valor compatible", () => {
    const d = mixed();
    d.sources = [{ id: "s1", fileName: "synthetic.xlsx", kind: "invoice", locations: [{ path: "products.p1.quantity", sheet: "Datos", cell: "A1", page: null, evidenceId: "e1", observedValue: 100 }] }];
    d.fieldDecisions = [{ path: "products.p1.quantity", origin: "source", references: [{ sourceId: "s1", evidenceId: "e1" }] }];
    expect(parseDocumentDraft(d).fieldDecisions?.[0].origin).toBe("source");
    d.fieldDecisions[0].path = "products.p2.quantity"; expect(() => parseDocumentDraft(d)).toThrow();
    d.fieldDecisions[0].path = "products.p1.quantity"; d.sources[0].locations[0].observedValue = 99; expect(() => parseDocumentDraft(d)).toThrow();
    d.sources[0].locations[0].observedValue = 100; d.sources[0].locations.push({ ...d.sources[0].locations[0] }); expect(() => parseDocumentDraft(d)).toThrow();
    d.sources[0].locations.pop(); d.sources[0].locations[0].observedValue = "100"; expect(() => parseDocumentDraft(d)).toThrow();
    d.sources[0].locations[0].observedValue = { value: 100 } as never; expect(() => parseDocumentDraft(d)).toThrow();
  });
  it("rechaza más de veinte referencias sin recortar la evidencia", () => {
    const d = mixed(); d.sources = [{ id: "s1", fileName: "synthetic.xlsx", kind: "invoice", locations: Array.from({ length: 21 }, (_, i) => ({ path: "products.p1.quantity", sheet: "Datos", cell: `A${i + 1}`, page: null, evidenceId: `e${i}`, observedValue: 100 })) }];
    d.fieldDecisions = [{ path: "products.p1.quantity", origin: "source", references: d.sources[0].locations.map(l => ({ sourceId: "s1", evidenceId: l.evidenceId! })) }];
    expect(() => parseDocumentDraft(d)).toThrow(); expect(d.sources[0].locations).toHaveLength(21);
  });
  it("deriva correcciones desde el anterior real aunque el proveedor omita toda metadata", () => {
    const prior = mixed(); prior.supplier.company = "Original"; prior.transportDeclarations = { battery: false, specialCargo: false };
    const browser = projectSupplierDocument(prior); browser.products[0].unitPrice = null; browser.supplier.company = "";
    browser.fieldDecisions = [{ path: "products.p1.unitPrice", origin: "source", references: [] }];
    const saved = reconcileDocumentEdit(prior, browser);
    expect(saved.fieldDecisions).toEqual(expect.arrayContaining([{ path: "products.p1.unitPrice", origin: "manual", references: [] }]));
    const incoming = mixed(); incoming.products[0].unitPrice = 99; incoming.supplier.company = "Otra propuesta"; source(incoming, "new", "invoice", ["products.p1.unitPrice"]);
    const merged = mergeDocuments(saved, incoming);
    expect(merged.products[0].unitPrice).toBeNull(); expect(merged.supplier.company).toBe("");
    expect(merged.issues.some(i => i.code === "source_conflict")).toBe(true);
    expect(saved.transportDeclarations).toEqual({ battery: false, specialCargo: false });
    expect(merged.transportDeclarations).toEqual({ battery: null, specialCargo: null });
  });
  it.each(["product", "group", "allocation"])("no resucita una eliminación manual de %s", kind => {
    const prior = mixed(), browser = projectSupplierDocument(prior);
    if (kind === "product") { browser.products.shift(); browser.groups[0].items.shift(); }
    if (kind === "group") browser.groups = [];
    if (kind === "allocation") browser.groups[0].items.shift();
    const saved = reconcileDocumentEdit(prior, browser);
    expect(saved.fieldDecisions?.some(f => f.deleted === true)).toBe(true);
    const incoming = mixed(); source(incoming, "new", "packing_list", []);
    expect(() => mergeDocuments(saved, incoming)).toThrow(DocumentMergeReviewError);
    expect(prior.products).toHaveLength(2);
  });
  it("conserva neto omitido por un cliente antiguo y reconoce su borrado explícito", () => {
    const prior = mixed(); prior.groups[0].netWeightKg = 180;
    const browser = projectSupplierDocument(prior); delete browser.groups[0].netWeightKg;
    expect(reconcileDocumentEdit(prior, browser).groups[0].netWeightKg).toBe(180);
    browser.groups[0].netWeightKg = null;
    expect(reconcileDocumentEdit(prior, browser).groups[0].netWeightKg).toBeNull();
  });
  it("invalida declaraciones al editar carga y conserva un sí aunque otra compra esté pendiente", () => {
    const prior = mixed(); prior.transportDeclarations = { battery: true, specialCargo: false };
    const changed = projectSupplierDocument(prior); changed.groups[0].grossWeightKg = 220;
    expect(reconcileDocumentEdit(prior, changed).transportDeclarations).toEqual({ battery: null, specialCargo: null });
    expect(aggregateTransportDeclarations([prior, mixed()])).toEqual({ battery: { value: true, pending: true }, specialCargo: { value: null, pending: true } });
  });
  it("proyecta mercancía y contacto propio sin fuentes, decisiones ni canarios privados en incidencias", () => {
    const d = mixed(); d.supplier.email = "proveedor@synthetic.example";
    d.sources = [{ id: "s1", fileName: "PRIVATE-FILE-CANARY.xlsx", kind: "invoice", locations: [{ path: "products.p1.name", sheet: "PRIVATE-OCR-CANARY", cell: "A1", page: null, evidenceId: "e1", observedValue: "PRIVATE-ALTERNATIVE-CANARY" }] }];
    d.fieldDecisions = [{ path: "products.p1.name", origin: "manual", references: [] }];
    d.issues = [{ id: "PRIVATE-ID-CANARY", code: "PRIVATE-CODE-CANARY", path: "PRIVATE-PATH-CANARY", message: "PRIVATE-BUYER-CANARY PRIVATE-ALTERNATIVE-CANARY", blocking: true, severity: "error" }];
    const projected = projectSupplierDocument(d);
    expect(JSON.stringify(projected)).not.toMatch(/PRIVATE-/);
    expect(projected.sources).toEqual([]); expect(projected).not.toHaveProperty("fieldDecisions");
    expect(projected.supplier.email).toBe("proveedor@synthetic.example"); expect(projected.products).toEqual(d.products);
  });
});

describe("SDD-0473 document contract", () => {
  it("counts mixed cartons once, quantities and value independently", () => {
    expect(computeDocumentTotals(mixed())).toEqual({ cartons: 10, grossWeightKg: 200, cbm: 1.5, quantity: 150, amounts: { USD: 350 }, complete: true });
    expect(confirmationIssues(mixed())).toEqual([]);
  });
  it("keeps grand totals without inventing carton allocation", () => {
    const d = mixed(); d.groups = []; d.declaredTotals = { cartons: 10, grossWeightKg: 200, cbm: 1.5, amount: 350 };
    expect(computeDocumentTotals(d).cbm).toBe(1.5);
    expect(d.groups).toEqual([]);
    expect(confirmationIssues(d).map((i) => i.code)).toContain("groups_missing");
  });
  it("never turns missing weight into zero or a partial sum", () => {
    const d = mixed(); d.groups[0].grossWeightKg = null;
    d.groups.push({ id: "g2", label: "11", cartons: 1, grossWeightKg: 3, cbm: 0.2, items: [] });
    expect(computeDocumentTotals(d).grossWeightKg).toBeNull();
    expect(confirmationIssues(d).some((i) => i.code === "grossWeightKg_missing")).toBe(true);
  });
  it("does not add unlike currencies and blocks legacy confirmation", () => {
    const d = mixed(); d.products[1].currency = "EUR";
    expect(computeDocumentTotals(d).amounts).toEqual({ USD: 200, EUR: 150 });
    expect(() => toPackingPayload(d)).toThrow();
  });
  it("normalizes RMB/CNY identity without exchanging prices", () => {
    const d = mixed(); d.currency = "CNY"; d.products.forEach((p) => p.currency = "CNY");
    expect(parseDocumentDraft(d).currency).toBe("RMB");
    expect(computeDocumentTotals(d).amounts).toEqual({ RMB: 350 });
  });
  it.each([NaN, Infinity, -2, "10", undefined])("rejects invalid number %s", (value) => {
    const d = mixed(); (d.products[0] as unknown as Record<string, unknown>).quantity = value;
    expect(() => parseDocumentDraft(d)).toThrow();
  });
  it("rejects fractional cartons, dangling references, duplicate IDs and unknown fields", () => {
    const d = mixed(); d.groups[0].cartons = 1.5; expect(() => parseDocumentDraft(d)).toThrow();
    d.groups[0].cartons = 10; d.groups[0].items[0].productId = "nonexistent"; expect(() => parseDocumentDraft(d)).toThrow();
    d.groups[0].items[0].productId = "p1"; d.products[1].id = "p1"; expect(() => parseDocumentDraft(d)).toThrow();
    expect(() => parseDocumentDraft({ ...mixed(), markbox: "DTD-PRIVATE" })).toThrow();
  });
  it("rejects invalid calendar dates", () => { const d = mixed(); d.docDate = "2026-02-30"; expect(() => parseDocumentDraft(d)).toThrow(); });
  it("recomputes missing-data blockers even if stale issue was marked resolved", () => {
    const d = mixed(); d.groups[0].cbm = null; d.issues = [{ id: "cbm_missing:groups.g1.cbm", code: "cbm_missing", message: "old", severity: "error", path: "groups.g1.cbm", blocking: true, resolved: true }];
    expect(confirmationIssues(d).some((i) => i.code === "cbm_missing" && !i.resolved)).toBe(true);
  });
  it("detects allocation, declared total and unknown unit discrepancies", () => {
    const d = mixed(); d.groups[0].items[0].quantity = 90; d.declaredTotals.grossWeightKg = 250; d.products[0].unit = "";
    expect(confirmationIssues(d).map((i) => i.code)).toEqual(expect.arrayContaining(["allocation_mismatch", "declared_total_mismatch", "unit_review"]));
  });
  it("round-trips mixed contents through the existing packing payload", () => {
    const payload = toPackingPayload(mixed());
    expect(payload.rows?.[0]).toMatchObject({ ctns: 10, perctn: 10, wkg: 20, cbm: 0.15, same: false });
    expect(payload.rows?.[1]).toMatchObject({ same: true, qtyDirect: 50, ctns: 0, wkg: 0 });
    expect(computeDocumentTotals(fromPackingPayload(payload))).toEqual(computeDocumentTotals(mixed()));
  });
  it("does not silently attach a leading mixed product to an invented box", () => {
    const d = fromPackingPayload({ rows: [{ es: "A", same: true, qtyDirect: 5 }] });
    expect(d.groups).toHaveLength(0);
    expect(d.issues[0].code).toBe("orphan_mixed_product");
  });
});

describe("document merge", () => {
  it("reapplying the same source is idempotent and does not mutate either input", () => {
    const incoming = mixed(); source(incoming, "s1", "combined", []);
    const frozen = JSON.stringify(incoming);
    const applied = mergeDocuments(emptyDocumentDraft(), incoming);
    expect(mergeDocuments(applied, incoming)).toEqual(applied);
    expect(JSON.stringify(incoming)).toBe(frozen);
  });
  it("matches invoice prices to existing packing products without duplicating cartons", () => {
    const current = mixed(); current.products.forEach((p) => p.unitPrice = null); source(current, "pl", "packing_list", ["products.p1.quantity"]);
    const invoice = mixed(); invoice.groups = []; invoice.products = invoice.products.map((p) => ({ ...p, id: "inv-" + p.id })); source(invoice, "invoice", "invoice", ["products.inv-p1.unitPrice", "products.inv-p2.unitPrice"]);
    const merged = mergeDocuments(current, invoice);
    expect(merged.products).toHaveLength(2); expect(merged.groups).toHaveLength(1); expect(computeDocumentTotals(merged).amounts).toEqual({ USD: 350 });
    expect(merged.sources[1].locations[0].path).toBe("products.p1.unitPrice");
  });
  it("prefers packing logistics but preserves a blocking conflict with remapped paths", () => {
    const current = mixed(); source(current, "pi", "proforma", ["groups.g1.grossWeightKg"]);
    const incoming = mixed(); incoming.groups[0].id = "other-group"; incoming.groups[0].grossWeightKg = 220;
    source(incoming, "pl", "packing_list", ["groups.other-group.grossWeightKg"]);
    incoming.issues.push({ id: "input-note", code: "check", path: "groups.other-group", message: "Review", blocking: true, severity: "warning" });
    const merged = mergeDocuments(current, incoming);
    expect(merged.groups[0].grossWeightKg).toBe(220);
    expect(merged.issues.some((i) => i.code === "source_conflict" && i.path === "groups.g1.grossWeightKg")).toBe(true);
    expect(merged.issues.find((i) => i.path === "groups.g1.grossWeightKg")?.message).toContain("valores diferentes");
    expect(merged.issues.find((i) => i.id === "input-note")?.path).toBe("groups.g1");
  });
  it("does not guess a match when several products have the same name", () => {
    const current = mixed(); current.products.forEach((p) => { p.code = ""; p.name = "Same"; });
    const incoming = emptyDocumentDraft(); incoming.products = [{ ...mixed().products[0], id: "p3", code: "", name: "Same" }];
    expect(() => mergeDocuments(current, incoming)).toThrow(DocumentMergeReviewError);
    expect(current.products).toHaveLength(2);
  });
});

/**
 * SDD-0473 · Precargar el enlace del proveedor con lo que el cliente ya cargó.
 *
 * Es lo contrario de confirmar: acá el documento está INCOMPLETO a propósito y el
 * proveedor lo completa. Lo que no se sabe tiene que llegar vacío — un cero en el
 * peso se leería como "no pesa nada" y el proveedor lo daría por bueno.
 */
describe("toPackingDraft (SDD-0473)", () => {
  const conGrupo = (over = {}) => {
    const d = emptyDocumentDraft();
    d.currency = "USD";
    d.products = [
      { id: "p1", name: "Vasos", nameZh: "杯子", code: "VAS-01", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD", unit: "pcs" },
      { id: "p2", name: "Tapas", nameZh: "盖子", code: "TAP-02", brand: "", material: "", quantity: 8, unitPrice: 4, currency: "USD", unit: "pcs" },
    ];
    d.groups = [{ id: "g1", label: "A", cartons: 5, grossWeightKg: 15, cbm: 2.5, items: [{ productId: "p1", quantity: 50 }, { productId: "p2", quantity: 8 }], ...over }];
    return d;
  };

  it("precarga un documento incompleto en vez de negarse, al revés que toPackingPayload", () => {
    const sinPeso = conGrupo({ grossWeightKg: null, cbm: null });
    expect(() => toPackingPayload(sinPeso)).toThrow();
    const draft = toPackingDraft(sinPeso);
    expect(draft.rows).toHaveLength(2);
  });

  it("deja vacío lo que el documento no trajo, nunca un cero", () => {
    const { rows } = toPackingDraft(conGrupo({ grossWeightKg: null, cbm: null }));
    expect(rows![0].wkg).toBe("");
    expect(rows![0].cbm).toBe("");
    expect(rows![0].wkg).not.toBe(0);
  });

  it("pone cajas, peso y CBM sólo en la fila líder del grupo", () => {
    const { rows } = toPackingDraft(conGrupo());
    expect(rows![0]).toMatchObject({ ctns: 5, wkg: 3, cbm: 0.5, same: false });
    // La hija comparte esas cajas: aportar su peso otra vez duplicaría el envío.
    expect(rows![1]).toMatchObject({ ctns: 0, wkg: 0, cbm: 0, same: true, qtyDirect: 8 });
  });

  it("no pierde un producto que la factura trajo sin asignar a ninguna caja", () => {
    const d = conGrupo();
    d.products.push({ id: "p3", name: "Sorbetes", nameZh: "", code: "SOR-03", brand: "", material: "", quantity: 100, unitPrice: 1, currency: "USD", unit: "pcs" });
    const { rows } = toPackingDraft(d);
    const suelto = rows!.find((r) => r.code === "SOR-03");
    expect(suelto).toBeDefined();
    expect(suelto).toMatchObject({ qtyDirect: 100, ctns: "", wkg: "", cbm: "", same: false });
  });

  it("conserva el contacto del proveedor para que no lo reescriba", () => {
    const d = conGrupo();
    d.supplier.company = "义乌供应商";
    d.supplier.wechat = "wechat-id";
    const draft = toPackingDraft(d);
    expect(draft.supplierCompany).toBe("义乌供应商");
    expect(draft.supplierWechat).toBe("wechat-id");
    expect(draft.currency).toBe("USD");
  });

  it("no divide por cero cuando el grupo no declara cuántas cajas son", () => {
    const { rows } = toPackingDraft(conGrupo({ cartons: null }));
    expect(rows![0].perctn).toBe("");
    expect(rows![0].wkg).toBe("");
    expect(Number.isNaN(Number(rows![0].wkg))).toBe(false);
  });
});
