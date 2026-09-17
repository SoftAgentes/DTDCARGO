import { describe, expect, it } from "vitest";
import { computeDocumentTotals, confirmationIssues, emptyDocumentDraft, fromPackingPayload, mergeDocuments, parseDocumentDraft, toPackingPayload, type DocumentDraft, type DocumentKind } from "../document-import";

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
    expect(merged.issues.find((i) => i.path === "groups.g1.grossWeightKg")?.message).toContain("Actual: «200»; documento: «220»");
    expect(merged.issues.find((i) => i.id === "input-note")?.path).toBe("groups.g1");
  });
  it("does not guess a match when several products have the same name", () => {
    const current = mixed(); current.products.forEach((p) => { p.code = ""; p.name = "Same"; });
    const incoming = emptyDocumentDraft(); incoming.products = [{ ...mixed().products[0], id: "p3", code: "", name: "Same" }];
    const merged = mergeDocuments(current, incoming);
    expect(merged.issues.some((i) => i.code === "ambiguous_product")).toBe(true);
    expect(merged.products).toHaveLength(3);
  });
});
