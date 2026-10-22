// @vitest-environment node
import { describe, expect, it } from "vitest";
import { confirmationIssues } from "@/lib/shared/document-import";
import { parseIntermediate, type Evidence, type Observation } from "./extraction-contract";
import { draftFromExtraction } from "./draft-from-extraction";

const authority = { sourceId: "job-synthetic", fileName: "synthetic.xlsx", kind: "packing_list" as const };
const evidence: Evidence[] = [{ id: "cell1", kind: "cell", sheet: "Datos", cell: "B2", value: "Vasos", unavailable: false }, { id: "pdf1", kind: "pdf", page: 7, blockIndex: 0, label: "table", content: "12 kg 10 kg", bbox: [0, 0, 50, 50], width: 100, height: 100 }];
const observation = (subject: string, field: string, value: Observation["value"], evidenceIds = ["cell1"]): Observation => ({ subject, field, value, evidenceIds });
const proposal = (observations: Observation[], refs = evidence) => parseIntermediate({ version: 1, observations, issues: [] }, authority, refs);

describe("S2: puente de evidencia a propuesta revisable", () => {
  it("asigna IDs de servidor y conserva bruto/neto, página real y celda, sin inventar unidad ni confirmar", () => {
    const d = draftFromExtraction(proposal([observation("product:p1", "name", "Vasos"), observation("group:g1", "grossWeightKg", 12, ["pdf1"]), observation("group:g1", "netWeightKg", 10, ["pdf1"]), observation("allocation:g1:p1", "quantity", 20)]), authority);
    expect(d.groups[0]).toMatchObject({ grossWeightKg: 12, netWeightKg: 10, cartons: null, cbm: null, items: [{ productId: d.products[0].id, quantity: 20 }] });
    expect(d.products[0]).toMatchObject({ id: "read:job-synthetic:p1", name: "Vasos", nameZh: "", unit: "", unitPrice: null });
    expect(d.sources[0].locations).toContainEqual(expect.objectContaining({ path: `groups.${d.groups[0].id}.netWeightKg`, page: 7, cell: null, observedValue: 10 }));
    expect(d.sources[0].locations[0]).toMatchObject({ sheet: "Datos", cell: "B2", page: null, observedValue: "Vasos" });
    expect(d.fieldDecisions?.every(f => f.origin === "source" && f.references.length > 0)).toBe(true);
    expect(d.transportDeclarations).toEqual({ battery: null, specialCargo: null });
    expect(confirmationIssues(d).map(i => i.code)).toContain("ai_review_required");
    expect(JSON.stringify(d)).not.toContain("12 kg 10 kg");
  });
  it("conserva monedas contradictorias como alternativas de evidencia bloqueantes", () => {
    const d = draftFromExtraction(proposal([observation("document", "currency", "USD"), observation("total", "currency", "EUR")]), authority);
    expect(d.currency).toBe("USD");
    expect(d.issues.map(i => i.code)).toContain("source_conflict");
    expect(d.sources[0].locations.map(l => l.observedValue)).toEqual(["USD", "EUR"]);
    expect(d.fieldDecisions?.[0].references).toHaveLength(1);
  });
  it("normaliza CNY sin convertir importes, y no fabrica origen para un texto ausente", () => {
    const d = draftFromExtraction(proposal([observation("document", "currency", "CNY"), observation("supplier", "company", null, [])]), authority);
    expect(d.currency).toBe("RMB"); expect(d.supplier.company).toBe("");
    expect(d.fieldDecisions?.some(f => f.path === "supplier.company")).toBe(false);
  });
  it("rechaza explícitamente texto o referencias que excedan el contrato final, sin truncar", () => {
    expect(() => draftFromExtraction(proposal([observation("product:p1", "name", "x".repeat(201))]), authority)).toThrow();
    const refs: Evidence[] = Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, kind: "cell", sheet: "Datos", cell: `A${i + 1}`, value: "Vasos", unavailable: false }));
    expect(() => draftFromExtraction(proposal([observation("product:p1", "name", "Vasos", refs.map(e => e.id))], refs), authority)).toThrow();
  });
  it("niega procedencia cambiada, fórmulas no disponibles y referencias huérfanas", () => {
    const p = proposal([observation("product:p1", "name", "Vasos")]);
    expect(() => draftFromExtraction(p, { ...authority, sourceId: "other" })).toThrow();
    expect(() => draftFromExtraction({ ...p, observations: [observation("product:p1", "name", "Vasos", ["missing"])] }, authority)).toThrow();
    expect(() => proposal([observation("product:p1", "name", "Vasos")], [{ ...evidence[0], kind: "cell", id: "cell1", sheet: "Datos", cell: "B2", value: null, unavailable: true }])).toThrow();
  });
});
