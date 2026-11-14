// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ExtractionFailure, parseBoundedJson, parseIntermediate, spreadsheetEvidence, validateOptions,
  type Evidence, type Observation, type SpreadsheetInput } from "./extraction-contract";

const source = { sourceId: "synthetic-source", fileName: "synthetic.pdf", kind: "packing_list" as const };
const evidence: Evidence[] = [{ id: "p1b8", kind: "pdf", page: 1, blockIndex: 8, label: "table",
  content: "Fictitious group: gross 7 kg, net 5 kg", bbox: [0, 0, 1, 1], width: 600, height: 800 }];
const fact = (change: Partial<Observation> = {}): Observation => ({ subject: "group:g1", field: "netWeightKg", value: 5, evidenceIds: ["p1b8"], ...change });
const result = (observations = [fact()]) => ({ version: 1, observations, issues: [] });
const sheet = (): SpreadsheetInput => ({ type: "spreadsheet", sheets: [{ name: "货物", cells: [
  { cell: "A1", value: "样品", unavailable: false }, { cell: "B1", value: null, unavailable: true },
] }] });

describe("SDD-0473 GLM S1 neutral contract", () => {
  it("keeps net and gross independently with original block/page evidence and pending review", () => {
    const parsed = parseIntermediate(result([fact(), fact({ field: "grossWeightKg", value: 7 })]), source, evidence);
    expect(parsed.observations.map(row => [row.field, row.value])).toEqual([["netWeightKg", 5], ["grossWeightKg", 7]]);
    expect(parsed.evidence[0]).toMatchObject({ page: 1, blockIndex: 8 });
    expect(parsed).toMatchObject({ source, reviewRequired: true, businessValidation: "pending" });
    expect(parsed).not.toHaveProperty("schemaVersion");
  });
  it("retains unknown values with an unresolved missing-value issue", () => {
    const parsed = parseIntermediate(result([fact({ value: null, evidenceIds: [] })]), source, evidence);
    expect(parsed.observations[0].value).toBeNull();
    expect(parsed.issues).toContainEqual({ code: "missing_value", evidenceIds: [] });
  });
  it("rejects fabricated evidence instead of trusting model page claims", () => {
    expect(() => parseIntermediate(result([fact({ evidenceIds: ["p9b8"] })]), source, evidence)).toThrow(ExtractionFailure);
    expect(() => parseIntermediate(result([fact({ evidenceIds: [] })]), source, evidence)).toThrow(ExtractionFailure);
  });
  it("rejects duplicate facts and duplicate citations", () => {
    expect(() => parseIntermediate(result([fact(), fact()]), source, evidence)).toThrow(ExtractionFailure);
    expect(() => parseIntermediate(result([fact({ evidenceIds: ["p1b8", "p1b8"] })]), source, evidence)).toThrow(ExtractionFailure);
  });
  it("rejects extra data, resolved flags and prototype keys", () => {
    expect(() => parseIntermediate({ ...result(), confirmed: true }, source, evidence)).toThrow(ExtractionFailure);
    expect(() => parseIntermediate({ ...result(), issues: [{ code: "conflict", evidenceIds: [], resolved: true }] }, source, evidence)).toThrow(ExtractionFailure);
    expect(() => parseIntermediate(JSON.parse('{"version":1,"observations":[],"issues":[],"__proto__":{}}'), source, evidence)).toThrow(ExtractionFailure);
  });
  it("rejects unsafe numbers and fractional carton counts", () => {
    for (const value of [-1, Infinity, NaN, 1e13]) expect(() => parseIntermediate(result([fact({ value })]), source, evidence)).toThrow(ExtractionFailure);
    expect(() => parseIntermediate(result([fact({ field: "cartons", value: 1.5 })]), source, evidence)).toThrow(ExtractionFailure);
  });
  it("does not infer a currency from a bare symbol", () => {
    expect(() => parseIntermediate(result([fact({ subject: "document", field: "currency", value: "$" })]), source, evidence)).toThrow(ExtractionFailure);
  });
  it("requires known product and group subjects for an allocation", () => {
    const allocation = fact({ subject: "allocation:g1:p2", field: "quantity", value: 2 });
    expect(() => parseIntermediate(result([fact(), allocation]), source, evidence)).toThrow(ExtractionFailure);
    expect(parseIntermediate(result([fact(), allocation, fact({ subject: "product:p2", field: "name", value: "样品" })]), source, evidence).observations).toHaveLength(3);
  });
  it("does not use an image URL as text evidence", () => {
    const images: Evidence[] = [{ ...evidence[0] as Extract<Evidence, { kind: "pdf" }>, label: "image", content: "https://example.invalid/not-fetched" }];
    expect(() => parseIntermediate(result(), source, images)).toThrow(ExtractionFailure);
  });
  it("preserves Chinese cells and unavailable formulas without evaluating them", () => {
    const cells = spreadsheetEvidence(sheet());
    expect(cells).toEqual([
      { id: "s1c1", kind: "cell", sheet: "货物", cell: "A1", value: "样品", unavailable: false },
      { id: "s1c2", kind: "cell", sheet: "货物", cell: "B1", value: null, unavailable: true },
    ]);
    expect(() => parseIntermediate(result([fact({ evidenceIds: ["s1c2"] })]), source, cells)).toThrow(ExtractionFailure);
  });
  it("rejects duplicate cells, out-of-range coordinates and invented formula results", () => {
    expect(() => spreadsheetEvidence({ type: "spreadsheet", sheets: [null] } as unknown as SpreadsheetInput)).toThrow(ExtractionFailure);
    for (const cells of [
      [{ cell: "A1", value: 1, unavailable: false }, { cell: "A1", value: 2, unavailable: false }],
      [{ cell: "CW1", value: 1, unavailable: false }],
      [{ cell: "A2001", value: 1, unavailable: false }],
      [{ cell: "A1", value: 42, unavailable: true }],
    ]) expect(() => spreadsheetEvidence({ type: "spreadsheet", sheets: [{ name: "Sheet", cells }] })).toThrow(ExtractionFailure);
  });
  it("bounds text bytes and JSON depth and never repairs fenced output", () => {
    expect(() => parseBoundedJson('"中"', 4)).toThrow(ExtractionFailure);
    expect(() => parseBoundedJson("[".repeat(33) + "0" + "]".repeat(33), 100)).toThrow(ExtractionFailure);
    expect(() => parseBoundedJson('```json\n{"version":1}\n```', 100)).toThrow(ExtractionFailure);
    expect(parseBoundedJson('{"text":"[\\\"quoted\\\"]"}', 100)).toEqual({ text: '["quoted"]' });
  });
  it("keeps errors fixed and nonretryable, with separate delivery uncertainty", () => {
    const error = new ExtractionFailure("extraction_unavailable", "uncertain");
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ code: "extraction_unavailable", retryable: false, outcome: "uncertain" });
    expect(error).not.toHaveProperty("cause");
  });
  it("rejects invalid source metadata without adopting model identities", () => {
    expect(() => validateOptions({ ...source, sourceId: "../other" })).toThrow(ExtractionFailure);
    expect(() => validateOptions({ ...source, sourceId: undefined as unknown as string })).toThrow(ExtractionFailure);
    expect(() => validateOptions({ ...source, fileName: "bad\nname.pdf" })).toThrow(ExtractionFailure);
  });
});
