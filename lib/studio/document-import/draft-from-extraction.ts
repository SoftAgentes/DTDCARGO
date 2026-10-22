import "server-only";
import { emptyDocumentDraft, parseDocumentDraft, type DocumentDraft, type DocumentProduct, type CartonGroup, type DocumentLocation } from "@/lib/shared/document-import";
import { fail, parseIntermediate, validateOptions, type ExtractionOptions, type IntermediateExtraction } from "./extraction-contract";

/** Converts a server extraction into a proposal. No provider calls, application or confirmation. */
export function draftFromExtraction(extraction: IntermediateExtraction, authority: ExtractionOptions): DocumentDraft {
  const source = validateOptions(authority);
  if (extraction.source.sourceId !== source.sourceId || extraction.source.kind !== source.kind || extraction.source.fileName !== source.fileName) fail("invalid_metadata");
  const parsed = parseIntermediate({ version: extraction.version, observations: extraction.observations, issues: extraction.issues }, source, extraction.evidence);
  const d = emptyDocumentDraft(), products = new Map<string, DocumentProduct>(), groups = new Map<string, CartonGroup>();
  const evidence = new Map(parsed.evidence.map(e => [e.id, e]));
  if (evidence.size !== parsed.evidence.length) fail("extraction_invalid", "received");
  const stableId = (local: string) => `read:${source.sourceId}:${local}`;
  for (const row of parsed.observations) {
    const [category, local] = row.subject.split(":");
    if (category === "product" && !products.has(local)) products.set(local, { id: stableId(local), name: "", nameZh: "", code: "", brand: "", material: "", quantity: null, unitPrice: null, currency: null, unit: "" });
    if (category === "group" && !groups.has(local)) groups.set(local, { id: stableId(local), label: "", cartons: null, grossWeightKg: null, cbm: null, items: [] });
  }
  d.products = [...products.values()]; d.groups = [...groups.values()];
  const locations: DocumentLocation[] = [];
  const decisions = new Map<string, NonNullable<DocumentDraft["fieldDecisions"]>[number]>();
  const selected = new Map<string, string | number | null>();
  for (const [index, row] of parsed.observations.entries()) {
    if (row.evidenceIds.length > 20) fail("extraction_invalid", "received");
    const [category, local, productLocal] = row.subject.split(":");
    const field = row.field === "date" ? "docDate" : row.field;
    const value = row.field === "currency" && row.value === "CNY" ? "RMB" : typeof row.value === "string" ? row.value.trim() : row.value;
    let path: string, target: object, key = field;
    if (category === "supplier") { path = `supplier.${field}`; target = d.supplier; }
    else if (category === "document" || (category === "total" && field === "currency")) { path = field; target = d; }
    else if (category === "product") { const p = products.get(local)!; path = `products.${p.id}.${field}`; target = p; }
    else if (category === "group") { const g = groups.get(local)!; path = `groups.${g.id}.${field}`; target = g; }
    else if (category === "allocation") {
      const g = groups.get(local)!, p = products.get(productLocal)!;
      const item = { productId: p.id, quantity: null as number | null };
      g.items.push(item); target = item; key = "quantity"; path = `groups.${g.id}.items.${p.id}.quantity`;
    } else { target = d.declaredTotals; path = `declaredTotals.${field}`; }
    // Only parsed closed fields reach this assignment. Local labels never become arbitrary paths.
    const textual = category === "supplier" || ["name", "nameZh", "code", "brand", "material", "unit", "label"].includes(field);
    const businessValue = value === null && textual ? "" : value;
    if (!selected.has(path) || selected.get(path) === null) {
      if (selected.has(path) && selected.get(path) !== businessValue) decisions.delete(path);
      Object.assign(target, { [key]: businessValue }); selected.set(path, businessValue);
    } else if (selected.get(path) !== businessValue) {
      d.issues.push({ id: `extraction-conflict-${index + 1}`, code: "source_conflict", path, message: "La lectura contiene valores diferentes para este dato. Revisa el original.", blocking: true, severity: "error" });
    }
    const references: { sourceId: string; evidenceId: string }[] = [];
    for (const [refIndex, id] of row.evidenceIds.entries()) {
      const e = evidence.get(id)!;
      const evidenceId = `o${index + 1}r${refIndex + 1}`;
      locations.push({ path, evidenceId, observedValue: value, sheet: e.kind === "cell" ? e.sheet : null, cell: e.kind === "cell" ? e.cell : null, page: e.kind === "pdf" ? e.page : null });
      references.push({ sourceId: source.sourceId, evidenceId });
    }
    if (references.length && selected.get(path) === value) {
      const previous = decisions.get(path)?.references ?? [];
      if (previous.length + references.length > 20) fail("extraction_invalid", "received");
      decisions.set(path, { path, origin: "source", references: [...previous, ...references] });
    }
  }
  d.sources = [{ id: source.sourceId, kind: source.kind, fileName: source.fileName, locations }];
  d.fieldDecisions = [...decisions.values()];
  d.transportDeclarations = { battery: null, specialCargo: null };
  d.issues.push({ id: "ai_review_required:document", code: "ai_review_required", path: "document", message: "Revisa los datos de la lectura asistida contra el original antes de continuar.", severity: "error", blocking: true });
  for (const [index, problem] of parsed.issues.entries()) d.issues.push({ id: `extraction-review-${index + 1}`, code: `extraction_${problem.code}`, path: "document", message: "La lectura dejó un dato pendiente o contradictorio. Revisa el documento original.", severity: "error", blocking: true });
  try { return parseDocumentDraft(d); } catch { return fail("extraction_invalid", "received"); }
}
