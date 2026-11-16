/** SDD-0473. Shared document contract; no ERP or database dependencies. */
export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export type DocumentKind = "packing_list" | "invoice" | "proforma" | "combined" | "unknown";
export type DocumentIssue = { id: string; code: string; message: string; severity: "warning" | "error"; path: string; blocking: boolean; resolved?: boolean };
export type DocumentLocation = { path: string; sheet: string | null; cell: string | null; page: number | null; evidenceId?: string; observedValue?: string | number | null };
export type DocumentFieldDecision = { path: string; origin: "manual" | "source"; references: { sourceId: string; evidenceId: string }[]; deleted?: true };
export type TransportDeclarations = { battery: boolean | null; specialCargo: boolean | null };
export type DocumentSource = { id: string; fileName: string; kind: DocumentKind; locations: DocumentLocation[] };
export type DocumentProduct = { id: string; name: string; nameZh: string; code: string; brand: string; material: string; quantity: number | null; unitPrice: number | null; currency: string | null; unit?: string };
/** All measurements and quantities are TOTALS for this group, never per carton. */
export type CartonGroup = { id: string; label: string; cartons: number | null; grossWeightKg: number | null; netWeightKg?: number | null; cbm: number | null; items: { productId: string; quantity: number | null }[] };
export type DocumentDraft = {
  schemaVersion: 1;
  supplier: { company: string; contact: string; email: string; wechat: string; phone: string; address: string; city: string };
  currency: string | null;
  docDate: string | null;
  products: DocumentProduct[];
  groups: CartonGroup[];
  declaredTotals: { cartons: number | null; grossWeightKg: number | null; netWeightKg?: number | null; cbm: number | null; amount: number | null };
  issues: DocumentIssue[];
  sources: DocumentSource[];
  fieldDecisions?: DocumentFieldDecision[];
  transportDeclarations?: TransportDeclarations;
};
export type DocumentTotals = { cartons: number | null; grossWeightKg: number | null; netWeightKg?: number | null; cbm: number | null; quantity: number | null; quantitiesByUnit?: Record<string, number>; amounts: Record<string, number>; complete: boolean };

export function emptyDocumentDraft(): DocumentDraft {
  return { schemaVersion: 1, supplier: { company: "", contact: "", email: "", wechat: "", phone: "", address: "", city: "" }, currency: null, docDate: null, products: [], groups: [], declaredTotals: { cartons: null, grossWeightKg: null, cbm: null, amount: null }, issues: [], sources: [] };
}

const supplierKeys = ["company", "contact", "email", "wechat", "phone", "address", "city"] as const;
const logisticsKeys = ["cartons", "grossWeightKg", "cbm"] as const;
const kinds: DocumentKind[] = ["packing_list", "invoice", "proforma", "combined", "unknown"];
function fail(path: string): never { throw new Error("Documento inválido: " + path); }
function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some((key) => !keys.includes(key))) return fail(path + ".campos");
  return obj;
}
function text(value: unknown, path: string, limit = 200): string {
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return fail(path);
  return value.trim();
}
function identifier(value: unknown, path: string): string {
  const id = text(value, path, 128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id)) return fail(path);
  return id;
}
function number(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12) return fail(path);
  return value;
}
function currency(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return fail(path);
  return value === "CNY" ? "RMB" : value;
}
function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(path);
  return value;
}
function unique(values: string[], path: string): void { if (new Set(values).size !== values.length) fail(path); }

type FieldSpec = { value: unknown; kind: "text" | "number" | "currency" | "date" | "boolean"; limit?: number; integer?: boolean };
/** Exact paths are assembled from validated stable IDs, never followed as object keys. */
function fieldSpecs(d: DocumentDraft): Map<string, FieldSpec> {
  const fields = new Map<string, FieldSpec>();
  const add = (path: string, spec: FieldSpec) => { if (fields.has(path) || path.length > 300) fail("field.path"); fields.set(path, spec); };
  for (const key of supplierKeys) add("supplier." + key, { value: d.supplier[key], kind: "text", limit: 200 });
  add("currency", { value: d.currency, kind: "currency" });
  add("docDate", { value: d.docDate, kind: "date" });
  for (const key of [...logisticsKeys, "netWeightKg", "amount"] as const) add("declaredTotals." + key, { value: d.declaredTotals[key], kind: "number", integer: key === "cartons" });
  for (const p of d.products) {
    for (const key of ["name", "nameZh", "code", "brand", "material", "unit"] as const) add(`products.${p.id}.${key}`, { value: p[key], kind: "text", limit: key === "unit" ? 40 : 200 });
    for (const key of ["quantity", "unitPrice"] as const) add(`products.${p.id}.${key}`, { value: p[key], kind: "number" });
    add(`products.${p.id}.currency`, { value: p.currency, kind: "currency" });
  }
  for (const g of d.groups) {
    add(`groups.${g.id}.label`, { value: g.label, kind: "text", limit: 200 });
    for (const key of [...logisticsKeys, "netWeightKg"] as const) add(`groups.${g.id}.${key}`, { value: g[key], kind: "number", integer: key === "cartons" });
    for (const item of g.items) add(`groups.${g.id}.items.${item.productId}.quantity`, { value: item.quantity, kind: "number" });
  }
  for (const key of ["battery", "specialCargo"] as const) add("transportDeclarations." + key, { value: d.transportDeclarations?.[key], kind: "boolean" });
  return fields;
}
function entityPaths(d: DocumentDraft): Set<string> {
  return new Set([...d.products.map(p => `products.${p.id}`), ...d.groups.flatMap(g => [`groups.${g.id}`, ...g.items.map(i => `groups.${g.id}.items.${i.productId}`)])]);
}
function tombstonePath(path: string): boolean {
  const parts = /^(products)\.(.+)$/.exec(path) ?? /^(groups)\.(.+)$/.exec(path);
  if (!parts || path.length > 300 || path.split(".").some(p => ["__proto__", "constructor", "prototype"].includes(p))) return false;
  const ids = parts[1] === "groups" && parts[2].includes(".items.") ? parts[2].split(".items.") : [parts[2]];
  if (ids.length > 2) return false;
  return ids.every(id => id.length <= 128 && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id));
}
function parseObservedValue(fields: Map<string, FieldSpec>, path: string, value: unknown): string | number | null {
  const spec = fields.get(path);
  if (!spec || spec.kind === "boolean") return fail("evidence.path");
  if (value === null) return null;
  if (spec.kind === "number") {
    const n = number(value, "evidence.number")!;
    if (spec.integer && !Number.isInteger(n)) fail("evidence.integer");
    return n;
  }
  if (spec.kind === "currency") { currency(value, "evidence.currency"); return value as string; }
  if (spec.kind === "date") {
    const date = text(value, "evidence.date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail("evidence.date");
    return date;
  }
  return text(value, "evidence.text", spec.limit);
}
function sameObserved(path: string, a: unknown, b: unknown): boolean {
  return path === "currency" || path.endsWith(".currency") ? (a === "CNY" ? "RMB" : a) === (b === "CNY" ? "RMB" : b) : a === b;
}
function parseFieldDecisions(d: DocumentDraft, value: unknown): DocumentFieldDecision[] {
  const specs = fieldSpecs(d), entities = entityPaths(d);
  const evidence = new Map(d.sources.flatMap(s => s.locations.flatMap(l => l.evidenceId ? [[s.id + "\u0000" + l.evidenceId, l] as const] : [])));
  const decisions = list(value, "fieldDecisions", 10_000).map(v => {
    const row = record(v, ["path", "origin", "references", "deleted"], "fieldDecision");
    const path = text(row.path, "fieldDecision.path", 300);
    if (row.origin !== "manual" && row.origin !== "source") fail("fieldDecision.origin");
    if (Object.hasOwn(row, "deleted") && row.deleted !== true) fail("fieldDecision.deleted");
    if (row.deleted === true ? !tombstonePath(path) || entities.has(path) || specs.has(path) || row.origin !== "manual" : !specs.has(path)) fail("fieldDecision.path");
    const refs = list(row.references, "fieldDecision.references", 20).map(v => {
      const ref = record(v, ["sourceId", "evidenceId"], "fieldDecision.reference");
      const sourceId = identifier(ref.sourceId, "reference.sourceId"), evidenceId = identifier(ref.evidenceId, "reference.evidenceId");
      const location = evidence.get(sourceId + "\u0000" + evidenceId);
      if (!location || location.path !== path || !Object.hasOwn(location, "observedValue") || !sameObserved(path, location.observedValue, specs.get(path)?.value)) fail("fieldDecision.evidence");
      return { sourceId, evidenceId };
    });
    unique(refs.map(r => `${r.sourceId}\u0000${r.evidenceId}`), "fieldDecision.references");
    if (row.origin === "source" ? refs.length === 0 : refs.length !== 0) fail("fieldDecision.references");
    return { path, origin: row.origin, references: refs, ...(row.deleted === true ? { deleted: true as const } : {}) } as DocumentFieldDecision;
  });
  unique(decisions.map(x => x.path), "fieldDecisions.path");
  return decisions;
}

export class DocumentMergeReviewError extends Error {
  constructor() { super("No pudimos relacionar esta lectura con las correcciones anteriores. Revisa los productos y las cajas antes de aplicar."); this.name = "DocumentMergeReviewError"; }
}

const cargoIdentity = (d: DocumentDraft) => JSON.stringify({ products: d.products.map(({ id, name, nameZh, code, brand, material, quantity, unit }) => ({ id, name, nameZh, code, brand, material, quantity, unit })), groups: d.groups, declaredTotals: { cartons: d.declaredTotals.cartons, grossWeightKg: d.declaredTotals.grossWeightKg, netWeightKg: d.declaredTotals.netWeightKg, cbm: d.declaredTotals.cbm } });
export const sameDocumentCargo = (before: DocumentDraft, after: DocumentDraft): boolean => cargoIdentity(before) === cargoIdentity(after);

/** The service supplies the authoritative prior. Browser metadata is never authority. */
export function reconcileDocumentEdit(prior: DocumentDraft, submitted: unknown): DocumentDraft {
  const before = parseDocumentDraft(prior);
  const raw = record(submitted, ["schemaVersion", "supplier", "currency", "docDate", "products", "groups", "declaredTotals", "issues", "sources", "fieldDecisions", "transportDeclarations"], "document");
  const { sources: _sources, fieldDecisions: _decisions, ...business } = raw;
  const next = parseDocumentDraft({ ...business, sources: [] });
  // An older client omitting additive fields is not an explicit deletion.
  if (!Object.hasOwn(next.declaredTotals, "netWeightKg") && Object.hasOwn(before.declaredTotals, "netWeightKg")) next.declaredTotals.netWeightKg = before.declaredTotals.netWeightKg;
  for (const group of next.groups) {
    const old = before.groups.find(g => g.id === group.id);
    if (old && !Object.hasOwn(group, "netWeightKg") && Object.hasOwn(old, "netWeightKg")) group.netWeightKg = old.netWeightKg;
  }
  if (!next.transportDeclarations && before.transportDeclarations) next.transportDeclarations = { ...before.transportDeclarations };
  if (cargoIdentity(before) !== cargoIdentity(next)) next.transportDeclarations = { battery: null, specialCargo: null };
  const oldFields = fieldSpecs(before), fields = fieldSpecs(next), oldEntities = entityPaths(before), entities = entityPaths(next);
  const decisions = new Map((before.fieldDecisions ?? []).filter(d => d.deleted ? !entities.has(d.path) : fields.has(d.path)).map(d => [d.path, d]));
  for (const [path, spec] of fields) {
    if (spec.value !== undefined && !sameObserved(path, oldFields.get(path)?.value, spec.value)) decisions.set(path, { path, origin: "manual", references: [] });
  }
  for (const path of oldEntities) if (!entities.has(path)) decisions.set(path, { path, origin: "manual", references: [], deleted: true });
  // Earlier revisions retain deleted evidence; this revision never has dangling references.
  next.sources = before.sources.map(s => ({ ...s, locations: s.locations.filter(l => !l.evidenceId || fields.has(l.path)) }));
  if (decisions.size || before.fieldDecisions) next.fieldDecisions = [...decisions.values()];
  return parseDocumentDraft(next);
}

/** Safe business projection, also used for history, receipts and generated documents. */
export function projectSupplierDocument(value: DocumentDraft): DocumentDraft {
  const d = parseDocumentDraft(value);
  const fields = fieldSpecs(d), entities = entityPaths(d);
  return {
    schemaVersion: d.schemaVersion, supplier: { ...d.supplier }, currency: d.currency, docDate: d.docDate,
    products: d.products.map(p => ({ ...p })), groups: d.groups.map(g => ({ ...g, items: g.items.map(i => ({ ...i })) })),
    declaredTotals: { ...d.declaredTotals }, sources: [],
    ...(d.transportDeclarations ? { transportDeclarations: { ...d.transportDeclarations } } : {}),
    issues: d.issues.map((i, index) => ({ id: `supplier-review-${index + 1}`, code: "review_required", message: "Revisa este dato y confirma la información del documento.", path: fields.has(i.path) || entities.has(i.path) ? i.path : "", severity: i.severity, blocking: i.blocking, ...(i.resolved === undefined ? {} : { resolved: i.resolved }) })),
  };
}

export function aggregateTransportDeclarations(drafts: DocumentDraft[]) {
  const states = drafts.map(d => parseDocumentDraft(d).transportDeclarations);
  const summarize = (key: keyof TransportDeclarations) => ({ value: states.some(s => s?.[key] === true) ? true : states.some(s => s?.[key] == null) ? null : false, pending: states.some(s => s?.[key] == null) });
  return { battery: summarize("battery"), specialCargo: summarize("specialCargo") };
}

/** Closed boundary: reject malformed data instead of defaulting invented numbers. */
export function parseDocumentDraft(value: unknown): DocumentDraft {
  const d = record(value, ["schemaVersion", "supplier", "currency", "docDate", "products", "groups", "declaredTotals", "issues", "sources", "fieldDecisions", "transportDeclarations"], "document");
  if (d.schemaVersion !== 1) fail("schemaVersion");
  const supplier = record(d.supplier, supplierKeys, "supplier");
  const result = emptyDocumentDraft();
  for (const key of supplierKeys) result.supplier[key] = text(supplier[key], "supplier." + key);
  result.currency = currency(d.currency, "currency");
  result.docDate = d.docDate === null ? null : text(d.docDate, "docDate", 10);
  if (result.docDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(result.docDate) || !Number.isFinite(Date.parse(result.docDate)) || new Date(result.docDate).toISOString().slice(0, 10) !== result.docDate)) fail("docDate");
  result.products = list(d.products, "products", 500).map((v) => {
    const p = record(v, ["id", "name", "nameZh", "code", "brand", "material", "quantity", "unitPrice", "currency", "unit"], "product");
    return { id: identifier(p.id, "product.id"), name: text(p.name, "product.name"), nameZh: text(p.nameZh, "product.nameZh"), code: text(p.code, "product.code"), brand: text(p.brand, "product.brand"), material: text(p.material, "product.material"), quantity: number(p.quantity, "product.quantity"), unitPrice: number(p.unitPrice, "product.unitPrice"), currency: currency(p.currency, "product.currency"), unit: p.unit === undefined ? "pcs" : text(p.unit, "product.unit", 40) };
  });
  unique(result.products.map((p) => p.id), "products.id");
  result.groups = list(d.groups, "groups", 500).map((v) => {
    const g = record(v, ["id", "label", "cartons", "grossWeightKg", "netWeightKg", "cbm", "items"], "group");
    const items = list(g.items, "group.items", 500).map((v) => { const i = record(v, ["productId", "quantity"], "item"); return { productId: identifier(i.productId, "item.productId"), quantity: number(i.quantity, "item.quantity") }; });
    unique(items.map((i) => i.productId), "group.items.productId");
    if (items.some((i) => !result.products.some((p) => p.id === i.productId))) fail("group.items.reference");
    const cartons = number(g.cartons, "group.cartons");
    if (cartons !== null && !Number.isInteger(cartons)) fail("group.cartons.integer");
    return { id: identifier(g.id, "group.id"), label: text(g.label, "group.label"), cartons, grossWeightKg: number(g.grossWeightKg, "group.grossWeightKg"), ...(Object.hasOwn(g, "netWeightKg") ? { netWeightKg: number(g.netWeightKg, "group.netWeightKg") } : {}), cbm: number(g.cbm, "group.cbm"), items };
  });
  unique(result.groups.map((g) => g.id), "groups.id");
  const totals = record(d.declaredTotals, ["cartons", "grossWeightKg", "netWeightKg", "cbm", "amount"], "declaredTotals");
  for (const key of [...logisticsKeys, "amount"] as const) result.declaredTotals[key] = number(totals[key], "declaredTotals." + key);
  if (Object.hasOwn(totals, "netWeightKg")) result.declaredTotals.netWeightKg = number(totals.netWeightKg, "declaredTotals.netWeightKg");
  if (result.declaredTotals.cartons !== null && !Number.isInteger(result.declaredTotals.cartons)) fail("declaredTotals.cartons.integer");
  result.issues = list(d.issues, "issues", 2000).map((v) => {
    const i = record(v, ["id", "code", "message", "severity", "path", "blocking", "resolved"], "issue");
    if ((i.severity !== "warning" && i.severity !== "error") || typeof i.blocking !== "boolean" || (i.resolved !== undefined && typeof i.resolved !== "boolean")) fail("issue.state");
    return { id: identifier(i.id, "issue.id"), code: text(i.code, "issue.code", 100), message: text(i.message, "issue.message", 500), severity: i.severity, path: text(i.path, "issue.path", 300), blocking: i.blocking, ...(i.resolved === undefined ? {} : { resolved: i.resolved }) };
  });
  unique(result.issues.map((i) => i.id), "issues.id");
  const evidenceFields = fieldSpecs(result);
  result.sources = list(d.sources, "sources", 50).map((v) => {
    const s = record(v, ["id", "fileName", "kind", "locations"], "source");
    if (!kinds.includes(s.kind as DocumentKind)) fail("source.kind");
    return { id: identifier(s.id, "source.id"), fileName: text(s.fileName, "source.fileName", 255), kind: s.kind as DocumentKind, locations: list(s.locations, "source.locations", 20000).map((v) => {
      const l = record(v, ["path", "sheet", "cell", "page", "evidenceId", "observedValue"], "location");
      const page = number(l.page, "location.page");
      if (page !== null && (!Number.isInteger(page) || page < 1)) fail("location.page");
      const location: DocumentLocation = { path: text(l.path, "location.path", 300), sheet: l.sheet === null ? null : text(l.sheet, "location.sheet"), cell: l.cell === null ? null : text(l.cell, "location.cell", 40), page };
      if (Object.hasOwn(l, "evidenceId") || Object.hasOwn(l, "observedValue")) {
        location.evidenceId = identifier(l.evidenceId, "location.evidenceId");
        location.observedValue = parseObservedValue(evidenceFields, location.path, l.observedValue);
      }
      return location;
    }) };
  });
  unique(result.sources.map((s) => s.id), "sources.id");
  for (const source of result.sources) unique(source.locations.flatMap(l => l.evidenceId ? [l.evidenceId] : []), "source.evidenceId");
  if (Object.hasOwn(d, "transportDeclarations")) {
    const declarations = record(d.transportDeclarations, ["battery", "specialCargo"], "transportDeclarations");
    for (const key of ["battery", "specialCargo"] as const) if (declarations[key] !== null && typeof declarations[key] !== "boolean") fail("transportDeclarations." + key);
    result.transportDeclarations = { battery: declarations.battery as boolean | null, specialCargo: declarations.specialCargo as boolean | null };
  }
  if (Object.hasOwn(d, "fieldDecisions")) result.fieldDecisions = parseFieldDecisions(result, d.fieldDecisions);
  return result;
}

const round = (v: number, decimals = 4) => Math.round((v + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
function sum(values: (number | null)[]): number | null { return values.length && values.every((v) => v !== null) ? round((values as number[]).reduce((a, b) => a + b, 0)) : null; }
export function computeDocumentTotals(draft: DocumentDraft): DocumentTotals {
  const d = parseDocumentDraft(draft);
  const cartons = sum(d.groups.map((g) => g.cartons)) ?? d.declaredTotals.cartons;
  const grossWeightKg = sum(d.groups.map((g) => g.grossWeightKg)) ?? d.declaredTotals.grossWeightKg;
  const cbm = sum(d.groups.map((g) => g.cbm)) ?? d.declaredTotals.cbm;
  const hasNet = Object.hasOwn(d.declaredTotals, "netWeightKg") || d.groups.some(g => Object.hasOwn(g, "netWeightKg"));
  const netWeightKg = sum(d.groups.map(g => g.netWeightKg ?? null)) ?? d.declaredTotals.netWeightKg ?? null;
  const units=new Set(d.products.map(p=>normalizeProductUnit(p.unit??"pcs")));
  const quantity = units.size===1 ? sum(d.products.map((p) => p.quantity)) : null;
  const quantitiesByUnit:Record<string,number>={};
  for(const unit of units){const total=sum(d.products.filter(p=>normalizeProductUnit(p.unit??"pcs")===unit).map(p=>p.quantity));if(unit&&total!==null)quantitiesByUnit[unit]=total;}
  const amounts: Record<string, number> = {};
  const currencies = new Set(d.products.map((p) => p.currency ?? d.currency).filter((c): c is string => c !== null));
  for (const curr of currencies) {
    const entries = d.products.filter((p) => (p.currency ?? d.currency) === curr);
    if (entries.every((p) => p.quantity !== null && p.unitPrice !== null)) amounts[curr] = round(entries.reduce((a, p) => a + round(p.quantity! * p.unitPrice!, 2), 0), 2);
  }
  return { cartons, grossWeightKg, ...(hasNet ? { netWeightKg } : {}), cbm, quantity, ...(units.size>1?{quantitiesByUnit}:{}), amounts, complete: cartons !== null && grossWeightKg !== null && cbm !== null && d.products.every((p) => p.quantity!==null && normalizeProductUnit(p.unit??"pcs")!=="" && (p.currency ?? d.currency) !== null && p.unitPrice !== null) };
}

export function normalizeProductUnit(unit:string):string {
  const value=unit.normalize("NFKC").trim().toLowerCase();
  return ["pcs","pc","piece","pieces","pzas","unidades","unidad","个","件"].includes(value)?"pcs":value;
}

function issue(code: string, path: string, message: string, blocking = true): DocumentIssue { return { id: (code + ":" + path).replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 128), code, path, message, severity: blocking ? "error" : "warning", blocking }; }
/** Recompute blockers on every save/confirm; resolving a missing-field warning cannot bypass it. */
export function confirmationIssues(draft: DocumentDraft): DocumentIssue[] {
  const d = parseDocumentDraft(draft);
  const issues = d.issues.filter((i) => !i.resolved);
  if (!d.products.length) issues.push(issue("products_missing", "products", "Agrega al menos un producto."));
  if (!d.groups.length) issues.push(issue("groups_missing", "groups", "Indica en qué cajas están los productos."));
  if (!d.supplier.email && !d.supplier.phone && !d.supplier.wechat) issues.push(issue("contact_missing", "supplier", "Completa un contacto del proveedor."));
  const currencies = new Set(d.products.map((p) => p.currency ?? d.currency).filter(Boolean));
  if (currencies.size > 1) issues.push(issue("multiple_currencies", "currency", "El documento final requiere una sola moneda. Revisa los precios sin convertirlos automáticamente."));
  if (currencies.size === 1 && !["USD", "RMB", "EUR"].includes([...currencies][0]!)) issues.push(issue("unsupported_currency", "currency", "La moneda original se conserva. El formato final admite USD, RMB o EUR."));
  for (const p of d.products) {
    const path = "products." + p.id;
    if (!p.name && !p.nameZh) issues.push(issue("name_missing", path + ".name", "Completa el nombre del producto."));
    if (!(p.quantity !== null && p.quantity > 0)) issues.push(issue("quantity_missing", path + ".quantity", "Completa la cantidad del producto."));
    if (p.unitPrice === null) issues.push(issue("price_missing", path + ".unitPrice", "Completa el precio unitario del producto."));
    if (!(p.currency ?? d.currency)) issues.push(issue("currency_missing", path + ".currency", "Confirma la moneda del precio."));
    if (p.unit !== undefined && !normalizeProductUnit(p.unit)) issues.push(issue("unit_review", path + ".unit", "Confirma la unidad de medida del producto antes de enviar."));
    const assigned = d.groups.flatMap((g) => g.items).filter((i) => i.productId === p.id);
    const quantity = sum(assigned.map((i) => i.quantity));
    if (quantity === null || p.quantity === null || Math.abs(quantity - p.quantity) > 0.0005) issues.push(issue("allocation_mismatch", path + ".quantity", "La cantidad asignada a cajas debe coincidir con la cantidad del producto."));
  }
  for (const g of d.groups) {
    if (g.netWeightKg != null && g.grossWeightKg != null && g.netWeightKg > g.grossWeightKg) issues.push(issue("net_exceeds_gross", "groups." + g.id + ".netWeightKg", "El peso neto no puede superar el bruto. Revisa ambos valores."));
    for (const key of logisticsKeys) if (g[key] === null || g[key]! <= 0) issues.push(issue(key + "_missing", "groups." + g.id + "." + key, "Completa " + ({ cartons: "la cantidad de cajas", grossWeightKg: "el peso bruto", cbm: "el CBM" }[key]) + " del grupo."));
    if (!g.items.length || g.items.some((i) => i.quantity === null || i.quantity <= 0)) issues.push(issue("contents_missing", "groups." + g.id + ".items", "Cada grupo debe tener productos y cantidades positivas."));
    for(const item of g.items){const product=d.products.find(p=>p.id===item.productId);
      if(product && normalizeProductUnit(product.unit??"pcs")==="pcs" && g.cartons && item.quantity!==null && Math.abs(item.quantity/g.cartons-Math.round(item.quantity/g.cartons))>0.000001)
        issues.push(issue("unequal_carton_contents","groups."+g.id+".items","La cantidad de piezas no se divide en cajas iguales. Separa las cajas con composición diferente."));}
  }
  const totals = computeDocumentTotals(d);
  if (d.declaredTotals.netWeightKg != null && d.declaredTotals.grossWeightKg != null && d.declaredTotals.netWeightKg > d.declaredTotals.grossWeightKg) issues.push(issue("net_exceeds_gross", "declaredTotals.netWeightKg", "El peso neto declarado supera el bruto. Revisa ambos valores."));
  const netSum = sum(d.groups.map(g => g.netWeightKg ?? null));
  if (netSum !== null && d.declaredTotals.netWeightKg != null && Math.abs(netSum - d.declaredTotals.netWeightKg) > 0.0005) issues.push(issue("declared_total_mismatch", "declaredTotals.netWeightKg", "El total neto declarado no coincide con las cajas. Revisa ambos valores."));
  const knownNet = d.groups.reduce((n, g) => n + (g.netWeightKg ?? 0), 0);
  if (netSum === null && d.declaredTotals.netWeightKg != null && knownNet > d.declaredTotals.netWeightKg + 0.0005) issues.push(issue("declared_total_mismatch", "declaredTotals.netWeightKg", "Los pesos netos conocidos ya superan el total declarado. Revisa ambos valores."));
  if (totals.grossWeightKg != null && ((totals.netWeightKg != null && totals.netWeightKg > totals.grossWeightKg) || knownNet > totals.grossWeightKg)) issues.push(issue("net_exceeds_gross", "declaredTotals.netWeightKg", "El peso neto conocido supera el peso bruto total. Revisa ambos valores."));
  for (const key of logisticsKeys) {
    const actual = sum(d.groups.map((g) => g[key]));
    if (actual !== null && d.declaredTotals[key] !== null && Math.abs(actual - d.declaredTotals[key]!) > 0.0005) issues.push(issue("declared_total_mismatch", "declaredTotals." + key, "El total declarado no coincide con las cajas. Revisa ambos valores."));
    const known = d.groups.reduce((n, g) => n + (g[key] ?? 0), 0);
    if (actual === null && d.declaredTotals[key] !== null && known > d.declaredTotals[key]! + 0.0005) issues.push(issue("declared_total_mismatch", "declaredTotals." + key, "Las cajas conocidas ya superan el total declarado. Revisa ambos valores."));
  }
  if (d.currency && d.declaredTotals.amount !== null && totals.amounts[d.currency] !== undefined && Math.abs(d.declaredTotals.amount - totals.amounts[d.currency]) > 0.02) issues.push(issue("declared_amount_mismatch", "declaredTotals.amount", "El importe declarado difiere de los productos. Revisa descuentos, flete y otros cargos."));
  return [...new Map(issues.map((i) => [i.id, i])).values()];
}

const norm = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
function sourceIndex(d: DocumentDraft) {
  const fields = fieldSpecs(d);
  const index = new Map<string, { source: DocumentSource; location: DocumentLocation }[]>();
  for (const source of d.sources) for (const location of source.locations) {
    if (!location.evidenceId || sameObserved(location.path, location.observedValue, fields.get(location.path)?.value)) {
      const entries = index.get(location.path) ?? [];
      entries.push({ source, location }); index.set(location.path, entries);
    }
  }
  return index;
}
/** Merge proposes changes only. Manual values and deletions retain server authority. */
export function mergeDocuments(current: DocumentDraft, extracted: DocumentDraft): DocumentDraft {
  const d = parseDocumentDraft(current), incoming = parseDocumentDraft(extracted);
  if (incoming.sources.length && incoming.sources.every(s => d.sources.some(old => old.id === s.id))) return d;
  const addedIssues: DocumentIssue[] = [];
  const pathMap = new Map<string, string>(), entityMap = new Map<string, string>();
  const decisions = new Map((d.fieldDecisions ?? []).map(x => [x.path, x]));
  const removedLegacyEvidence = new Set<string>();
  const incomingChoices = new Map<string, { path: string; value: unknown }>();
  const oldIndex = sourceIndex(d), nextIndex = sourceIndex(incoming), incomingFields = fieldSpecs(incoming);
  const rank = (index: ReturnType<typeof sourceIndex>, path: string, commercial: boolean) => (index.get(path) ?? []).reduce((best, { source }) => Math.max(best, source.kind === "combined" ? 3 : commercial ? (["invoice", "proforma"].includes(source.kind) ? 3 : 1) : source.kind === "packing_list" ? 3 : 1), 0);
  const manualEntity = (prefix: string) => [...decisions.values()].some(x => x.origin === "manual" && x.path.startsWith(prefix));
  const refs = (path: string, value: unknown) => (nextIndex.get(path) ?? []).filter(({ location }) => location.evidenceId && sameObserved(path, location.observedValue, value)).map(({ source, location }) => ({ sourceId: source.id, evidenceId: location.evidenceId! }));
  function choose<T extends string | number | null | undefined>(old: T, next: T, path: string, nextPath = path, commercial = false): T {
    pathMap.set(nextPath, path);
    if (decisions.get(path)?.origin === "manual") {
      if (next !== undefined && next !== null && next !== "" && old !== next) addedIssues.push(issue("source_conflict", path, "El documento propone un valor diferente de tu corrección. Revisa el campo antes de confirmar."));
      incomingChoices.set(nextPath, { path, value: old });
      return old;
    }
    let selected = old;
    if (next !== undefined && next !== null && next !== "" && old !== next) {
      if (old == null || old === "") selected = next;
      else {
        addedIssues.push(issue("source_conflict", path, "Hay valores diferentes en los documentos. Revisa el campo y sus fuentes antes de confirmar."));
        if (rank(nextIndex, nextPath, commercial) > rank(oldIndex, path, commercial)) selected = next;
      }
    }
    incomingChoices.set(nextPath, { path, value: selected });
    if (selected !== old) {
      removedLegacyEvidence.add(path);
      const references = refs(nextPath, selected);
      if (references.length) decisions.set(path, { path, origin: "source", references });
      else decisions.delete(path); // A legacy citation does not prove its observed value.
    } else if (selected === next && !decisions.has(path)) {
      const references = refs(nextPath, selected);
      if (references.length) decisions.set(path, { path, origin: "source", references });
    }
    return selected;
  }
  for (const key of supplierKeys) d.supplier[key] = choose(d.supplier[key], incoming.supplier[key], "supplier." + key);
  d.currency = choose(d.currency, incoming.currency, "currency", "currency", true);
  d.docDate = choose(d.docDate, incoming.docDate, "docDate");
  for (const key of [...logisticsKeys, "amount"] as const) d.declaredTotals[key] = choose(d.declaredTotals[key], incoming.declaredTotals[key], "declaredTotals." + key, "declaredTotals." + key, key === "amount");
  if (Object.hasOwn(incoming.declaredTotals, "netWeightKg")) d.declaredTotals.netWeightKg = choose(d.declaredTotals.netWeightKg, incoming.declaredTotals.netWeightKg, "declaredTotals.netWeightKg");
  const productIds = new Map<string, string>();
  for (const product of incoming.products) {
    if (decisions.get("products." + product.id)?.deleted) throw new DocumentMergeReviewError();
    const matches = d.products.filter(p => product.id === p.id || ((product.code && p.code) ? norm(product.code) === norm(p.code) : norm(product.name || product.nameZh) !== "" && norm(product.name || product.nameZh) === norm(p.name || p.nameZh)));
    if (matches.length > 1 || (matches.length === 0 && manualEntity("products."))) throw new DocumentMergeReviewError();
    if (matches.length === 1) {
      const target = matches[0]; productIds.set(product.id, target.id);
      entityMap.set("products." + product.id, "products." + target.id);
      for (const key of ["name", "nameZh", "code", "brand", "material"] as const) target[key] = choose(target[key], product[key], "products." + target.id + "." + key, "products." + product.id + "." + key);
      for (const key of ["quantity", "unitPrice"] as const) target[key] = choose(target[key], product[key], "products." + target.id + "." + key, "products." + product.id + "." + key, key === "unitPrice");
      target.currency = choose(target.currency, product.currency, "products." + target.id + ".currency", "products." + product.id + ".currency", true);
      target.unit = choose(target.unit ?? "pcs", product.unit ?? "pcs", "products." + target.id + ".unit", "products." + product.id + ".unit");
    } else {
      d.products.push(product); productIds.set(product.id, product.id);
    }
  }
  for (const group of incoming.groups) {
    if (decisions.get("groups." + group.id)?.deleted) throw new DocumentMergeReviewError();
    const mapped = { ...group, items: group.items.map(i => ({ ...i, productId: productIds.get(i.productId)! })) };
    const existing = d.groups.filter(g => g.id === group.id || (group.label && norm(g.label) === norm(group.label)));
    if (existing.length > 1 || (existing.length === 0 && manualEntity("groups."))) throw new DocumentMergeReviewError();
    if (existing.length === 1) {
      const target = existing[0];
      entityMap.set("groups." + group.id, "groups." + target.id);
      target.label = choose(target.label, group.label, "groups." + target.id + ".label", "groups." + group.id + ".label");
      for (const item of mapped.items) if (decisions.get(`groups.${target.id}.items.${item.productId}`)?.deleted) throw new DocumentMergeReviewError();
      for (const key of logisticsKeys) target[key] = choose(target[key], group[key], "groups." + target.id + "." + key, "groups." + group.id + "." + key);
      if (Object.hasOwn(group, "netWeightKg")) target.netWeightKg = choose(target.netWeightKg, group.netWeightKg, "groups." + target.id + ".netWeightKg", "groups." + group.id + ".netWeightKg");
      const sameContents = target.items.length === mapped.items.length && target.items.every(i => mapped.items.some(n => n.productId === i.productId && n.quantity === i.quantity));
      if (!sameContents) addedIssues.push(issue("contents_conflict", "groups." + target.id + ".items", "La composición de las cajas difiere. Revisa las cantidades antes de confirmar."));
      for (const item of group.items) {
        const nextPath = `groups.${group.id}.items.${item.productId}.quantity`;
        const targetPath = `groups.${target.id}.items.${productIds.get(item.productId)!}.quantity`;
        pathMap.set(nextPath, targetPath);
        incomingChoices.set(nextPath, { path: targetPath, value: target.items.find(i => i.productId === productIds.get(item.productId))?.quantity });
      }
      pathMap.set("groups." + group.id + ".items", "groups." + target.id + ".items");
    } else {
      if (d.groups.some(g => g.items.some(i => mapped.items.some(n => n.productId === i.productId)))) addedIssues.push(issue("ambiguous_boxes", "groups." + group.id, "Estos productos ya aparecen en otras cajas. Comprueba que no sean cajas repetidas."));
      d.groups.push(mapped);
      for (const item of group.items) pathMap.set(`groups.${group.id}.items.${item.productId}.quantity`, `groups.${group.id}.items.${productIds.get(item.productId)!}.quantity`);
    }
  }
  const remapPath = (path: string) => {
    if (pathMap.has(path)) return pathMap.get(path)!;
    for (const [from, to] of entityMap) if (path === from || path.startsWith(from + ".")) return to + path.slice(from.length);
    return path;
  };
  const fields = fieldSpecs(d);
  d.sources = d.sources.map(s => ({ ...s, locations: s.locations.filter(l => l.evidenceId || !removedLegacyEvidence.has(l.path)) }));
  d.sources.push(...incoming.sources.filter(s => !d.sources.some(old => old.id === s.id)).map(s => ({
    ...s,
    locations: s.locations.flatMap(l => {
      const path = remapPath(l.path), choice = incomingChoices.get(l.path);
      if (l.evidenceId && !fields.has(path)) return []; // Conflicting allocation remains an issue, not an orphan citation.
      if (!l.evidenceId && choice && !sameObserved(path, choice.value, incomingFields.get(l.path)?.value)) return [];
      return [{ ...l, path }];
    }),
  })));
  // New entities get authority only from actual server evidence, never incoming manual flags.
  const selectedIndex = sourceIndex(d);
  for (const [path, spec] of fields) if (!decisions.has(path) && spec.value !== undefined) {
    const references = (selectedIndex.get(path) ?? []).filter(({ location }) => location.evidenceId).map(({ source, location }) => ({ sourceId: source.id, evidenceId: location.evidenceId! }));
    if (references.length) decisions.set(path, { path, origin: "source", references });
  }
  if (decisions.size || d.fieldDecisions) d.fieldDecisions = [...decisions.values()];
  const merged = [...d.issues, ...incoming.issues.map(i => ({ ...i, path: remapPath(i.path) })), ...addedIssues];
  d.issues = [...new Map(merged.map(i => [i.id, i])).values()];
  d.transportDeclarations = { battery: null, specialCargo: null };
  for (const key of ["battery", "specialCargo"] as const) {
    const path = "transportDeclarations." + key;
    if (d.fieldDecisions) d.fieldDecisions = d.fieldDecisions.filter(x => x.path !== path);
  }
  return parseDocumentDraft(d);
}


/** Structural legacy adapter. The shared module deliberately does not import Studio. */
export type DocumentPackingRow = { brand?: string; code?: string; zh?: string; es?: string; hs?: string; carton?: string; ctns?: number | string; perctn?: number | string; unit?: number | string; wkg?: number | string; cbm?: number | string; same?: boolean; qtyDirect?: number | string; uom?:string };
export type DocumentPackingPayload = { supplierCompany?: string; supplierContact?: string; supplierEmail?: string; supplierWechat?: string; supplierPhone?: string; supplierAddress?: string; supplierCity?: string; currency?: string; docDate?: string; supplierNote?: string; rows?: DocumentPackingRow[] };
/**
 * Versión tolerante de `toPackingPayload`, para PRECARGAR el formulario del
 * proveedor con lo que el cliente ya cargó.
 *
 * `toPackingPayload` exige el documento completo porque produce la versión que se
 * confirma. Precargar es lo contrario: sirve justamente cuando falta algo, y el
 * proveedor es quien lo completa. Así que acá nada se exige y **lo desconocido
 * viaja vacío, nunca como cero** — un 0 en el peso se leería como "pesa nada".
 *
 * Las cajas, el peso y el CBM van sólo en la fila LÍDER de cada grupo, que es la
 * convención de Caja Padre del formulario (SDD-0097): las filas `same` comparten
 * las cajas de la líder y sólo aportan su cantidad.
 */
export function toPackingDraft(draft: DocumentDraft): DocumentPackingPayload {
  const d = parseDocumentDraft(draft);
  const rows: DocumentPackingRow[] = [];
  const perCarton = (total: number | null, cartons: number | null) =>
    total === null || cartons === null || cartons <= 0 ? "" : total / cartons;
  for (const g of d.groups) {
    for (const [index, item] of g.items.entries()) {
      const p = d.products.find((product) => product.id === item.productId);
      if (!p) continue;
      const lider = index === 0;
      rows.push({
        brand: p.brand, code: p.code, zh: p.nameZh, es: p.name, hs: p.material, carton: g.label,
        ctns: lider ? (g.cartons ?? "") : 0,
        perctn: lider ? perCarton(item.quantity, g.cartons) : 0,
        unit: p.unitPrice ?? "",
        wkg: lider ? perCarton(g.grossWeightKg, g.cartons) : 0,
        cbm: lider ? perCarton(g.cbm, g.cartons) : 0,
        same: !lider,
        qtyDirect: lider ? 0 : (item.quantity ?? ""),
        uom: normalizeProductUnit(p.unit ?? "pcs"),
      });
    }
  }
  // Un producto que la factura trajo sin asignar a ninguna caja NO se pierde: va
  // como fila propia sin logística, para que el proveedor diga en qué caja viaja.
  const asignados = new Set(d.groups.flatMap((g) => g.items.map((i) => i.productId)));
  for (const p of d.products) {
    if (asignados.has(p.id)) continue;
    rows.push({
      brand: p.brand, code: p.code, zh: p.nameZh, es: p.name, hs: p.material, carton: "",
      ctns: "", perctn: "", unit: p.unitPrice ?? "", wkg: "", cbm: "",
      qtyDirect: p.quantity ?? "", same: false,
      uom: normalizeProductUnit(p.unit ?? "pcs"),
    });
  }
  return {
    supplierCompany: d.supplier.company, supplierContact: d.supplier.contact, supplierEmail: d.supplier.email,
    supplierWechat: d.supplier.wechat, supplierPhone: d.supplier.phone, supplierAddress: d.supplier.address,
    supplierCity: d.supplier.city,
    currency: d.products[0]?.currency ?? d.currency ?? undefined,
    docDate: d.docDate ?? undefined,
    rows: rows.slice(0, 500),
  };
}

export function toPackingPayload(draft: DocumentDraft): DocumentPackingPayload {
  const d = parseDocumentDraft(draft);
  const blockers = confirmationIssues(d).filter((i) => i.blocking);
  if (blockers.length) throw new Error("Revisa el documento antes de confirmar: " + blockers[0].message);
  const rows: DocumentPackingRow[] = [];
  for (const g of d.groups) for (const [index, item] of g.items.entries()) {
    const p = d.products.find((product) => product.id === item.productId)!;
    rows.push({ brand: p.brand, code: p.code, zh: p.nameZh, es: p.name, hs: p.material, carton: g.label, ctns: index === 0 ? g.cartons! : 0, perctn: index === 0 ? item.quantity! / g.cartons! : 0, unit: p.unitPrice!, wkg: index === 0 ? g.grossWeightKg! / g.cartons! : 0, cbm: index === 0 ? g.cbm! / g.cartons! : 0, same: index > 0, qtyDirect: index > 0 ? item.quantity! : 0,uom:normalizeProductUnit(p.unit??"pcs") });
  }
  if (rows.length > 500) throw new Error("El documento final admite hasta 500 líneas.");
  return { supplierCompany: d.supplier.company, supplierContact: d.supplier.contact, supplierEmail: d.supplier.email, supplierWechat: d.supplier.wechat, supplierPhone: d.supplier.phone, supplierAddress: d.supplier.address, supplierCity: d.supplier.city, currency: d.products[0]?.currency ?? d.currency ?? undefined, docDate: d.docDate ?? undefined, rows };
}
export function fromPackingPayload(payload: DocumentPackingPayload): DocumentDraft {
  const d = emptyDocumentDraft();
  d.supplier = { company: payload.supplierCompany ?? "", contact: payload.supplierContact ?? "", email: payload.supplierEmail ?? "", wechat: payload.supplierWechat ?? "", phone: payload.supplierPhone ?? "", address: payload.supplierAddress ?? "", city: payload.supplierCity ?? "" };
  d.currency = payload.currency === "CNY" ? "RMB" : payload.currency ?? null;
  d.docDate = payload.docDate || null;
  const n = (v: number | string | undefined): number | null => { if (v === undefined || v === "") return null; const parsed = typeof v === "number" ? v : Number(v.replace(",", ".")); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; };
  let group: CartonGroup | undefined;
  for (const [index, row] of (payload.rows ?? []).entries()) {
    const id = "legacy-p" + (index + 1);
    const cartons = n(row.ctns); const perctn = n(row.perctn);
    const qty = row.same ? n(row.qtyDirect) : cartons !== null && perctn !== null ? cartons * perctn : null;
    if (!row.es && !row.zh && !row.code && !row.brand && !qty) continue;
    d.products.push({ id, name: row.es ?? "", nameZh: row.zh ?? "", code: row.code ?? "", brand: row.brand ?? "", material: row.hs ?? "", quantity: qty, unitPrice: n(row.unit), currency: d.currency, unit: normalizeProductUnit(row.uom??"pcs") });
    if (!row.same) {
      const weight = n(row.wkg), cbm = n(row.cbm);
      group = { id: "legacy-g" + (index + 1), label: row.carton ?? "", cartons, grossWeightKg: cartons !== null && weight !== null ? cartons * weight : null, cbm: cartons !== null && cbm !== null ? cartons * cbm : null, items: [] };
      d.groups.push(group);
    }
    if (group) group.items.push({ productId: id, quantity: qty });
    else d.issues.push(issue("orphan_mixed_product", "products." + id, "Este producto indica caja mixta sin una caja anterior."));
  }
  return parseDocumentDraft(d);
}
