import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { packlistDraftKey, packlistHistoryKey } from "@/lib/studio/prealertas/packlist-draft";
import { FIXTURE_TOKEN, prepareFixtureOrigin, resetFixtureDraft } from "./fixture-draft";

function memoryStorage(values: Record<string, string> = {}) {
  const entries = new Map(Object.entries(values));
  return {
    entries,
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
    removeItem: vi.fn((key: string) => { entries.delete(key); }),
  };
}
const draftKey = packlistDraftKey(FIXTURE_TOKEN);
const historyKey = packlistHistoryKey(FIXTURE_TOKEN);

describe("demo draft origin and isolated reset", () => {
  it("starts with example data without seeding supplier values or storage", () => {
    const storage = memoryStorage();
    expect(prepareFixtureOrigin(() => storage).kind).toBe("example");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("recognizes and sanitizes the real token draft while preserving entered values", () => {
    const storage = memoryStorage({ [draftKey]: JSON.stringify({ company: "Proveedor ingresado", wechat: "contacto-ingresado", currency: "EUR", rows: [{ zh: "灯具", ctns: "2", perctn: "10" }], clientEmail: "private@example.invalid", mark: "stale-mark" }) });
    expect(prepareFixtureOrigin(() => storage)).toEqual({ kind: "restored", clearedLegacyContact: false });
    const draft = JSON.parse(storage.getItem(draftKey)!);
    expect(draft.company).toBe("Proveedor ingresado");
    expect(draft.wechat).toBe("contacto-ingresado");
    expect(draft.rows).toHaveLength(1);
    expect(draft).not.toHaveProperty("clientEmail");
    expect(draft).not.toHaveProperty("mark");
  });

  it("removes only exact contacts seeded by the previous demo, also in history", () => {
    const draft = { company: "示例供应商 · Proveedor de muestra", wechat: "demo-wechat", email: "ingresado@example.invalid", rows: [{ zh: "自己填写的商品" }] };
    const storage = memoryStorage({ [draftKey]: JSON.stringify(draft), [historyKey]: JSON.stringify([{ t: 1, label: "version", data: JSON.stringify(draft) }]) });
    expect(prepareFixtureOrigin(() => storage)).toEqual({ kind: "restored", clearedLegacyContact: true });
    for (const raw of [storage.getItem(draftKey), JSON.parse(storage.getItem(historyKey)!)[0].data]) {
      expect(JSON.parse(raw!)).toEqual({ ...draft, company: "", wechat: "" });
    }
  });

  it.each(["{malformed", "{}", '{"rows":[null]}']) ("keeps unusable draft %s intact so the user can explicitly reset it", raw => {
    const storage = memoryStorage({ [draftKey]: raw });
    expect(prepareFixtureOrigin(() => storage).kind).toBe("invalid");
    expect(storage.getItem(draftKey)).toBe(raw);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not announce restoration when storage access or the form's pre-restore write fails", () => {
    expect(prepareFixtureOrigin(() => { throw new Error("blocked"); }).kind).toBe("unavailable");
    const storage = memoryStorage({ [draftKey]: '{"company":"guardado"}' });
    storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    expect(prepareFixtureOrigin(() => storage).kind).toBe("unavailable");
    expect(storage.getItem(draftKey)).toBe('{"company":"guardado"}');
  });

  it("resets just this token's draft and history and preserves other purchases and preferences", () => {
    const storage = memoryStorage({ [draftKey]: '{"company":"demo"}', [historyKey]: "[]", [packlistDraftKey("another-purchase")]: "other-draft", [packlistHistoryKey("another-purchase")]: "other-history", theme: "dark" });
    expect(resetFixtureDraft(() => storage)).toBe(true);
    expect([...storage.entries]).toEqual([[packlistDraftKey("another-purchase"), "other-draft"], [packlistHistoryKey("another-purchase"), "other-history"], ["theme", "dark"]]);
    expect(storage.removeItem.mock.calls).toEqual([[draftKey], [historyKey]]);
    expect(prepareFixtureOrigin(() => storage).kind).toBe("example");
  });

  it("reports incomplete reset when one key cannot be removed", () => {
    const storage = memoryStorage({ [draftKey]: '{"company":"demo"}', [historyKey]: "[]" });
    storage.removeItem.mockImplementation(key => { if (key === historyKey) throw new Error("blocked"); storage.entries.delete(key); });
    expect(resetFixtureDraft(() => storage)).toBe(false);
    expect(storage.getItem(historyKey)).toBe("[]");
    expect(resetFixtureDraft(() => { throw new Error("blocked"); })).toBe(false);
  });
});

function untouchedDraft() {
  return {
    folio: "", company: "", email: "", wechat: "", address: "", city: "",
    mark: "DTD-DEMO", docDate: "2026-09-16", currency: "USD", note: "", lang: "es",
    rows: [{ brand: "", code: "", zh: "", es: "", hs: "", carton: "", ctns: "", perctn: "", unit: "", wkg: "", cbm: "" }],
  };
}

describe("untouched autosave versus edited demo", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 16, 23, 30)); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("keeps reset -> untouched autosave -> reload classified as example, using the local date", () => {
    const storage = memoryStorage({ [draftKey]: '{"company":"Anterior"}', [historyKey]: "[]" });
    expect(resetFixtureDraft(() => storage)).toBe(true);
    // This is the exact snapshot saved by the real form after resetting. UTC
    // conversion must not classify the local calendar date as an edit.
    vi.spyOn(Date.prototype, "toISOString").mockImplementation(() => { throw new Error("Do not use UTC"); });
    storage.setItem(draftKey, JSON.stringify(untouchedDraft()));
    expect(prepareFixtureOrigin(() => storage).kind).toBe("example");
    expect(prepareFixtureOrigin(() => storage).kind).toBe("example");
    expect(storage.getItem(draftKey)).toBeNull();
  });

  it.each([
    ["company", "Proveedor ingresado"], ["email", "contacto@example.invalid"], ["wechat", "contacto-ingresado"],
    ["address", "Dirección ingresada"], ["city", "Shenzhen"], ["folio", "REF-12"], ["note", "Cajas frágiles"],
    ["currency", "RMB"], ["currency", "EUR"], ["docDate", "2026-09-15"], ["docDate", ""], ["lang", "en"],
  ])("restores an edited %s even when every other field is untouched (%s)", (field, value) => {
    const draft = { ...untouchedDraft(), [field]: value };
    const storage = memoryStorage({ [draftKey]: JSON.stringify(draft) });
    expect(prepareFixtureOrigin(() => storage).kind).toBe("restored");
    expect(JSON.parse(storage.getItem(draftKey)!)[field]).toBe(value);
  });

  it.each([
    { name: "product description", rows: [{ zh: "灯具" }] },
    { name: "zero price", rows: [{ unit: 0 }] },
    { name: "direct quantity", rows: [{ qtyDirect: "3" }] },
    { name: "mixed carton", rows: [{ same: true }] },
    { name: "additional carton", rows: [{}, {}] },
  ])("restores $name without requiring supplier fields", ({ rows }) => {
    const draft = { ...untouchedDraft(), rows: rows.map(row => ({ ...untouchedDraft().rows[0], ...row })) };
    const storage = memoryStorage({ [draftKey]: JSON.stringify(draft) });
    expect(prepareFixtureOrigin(() => storage).kind).toBe("restored");
    expect(JSON.parse(storage.getItem(draftKey)!).rows).toEqual(draft.rows);
  });

  it("keeps old partial empty drafts as example and preserves edited old partial drafts", () => {
    const storage = memoryStorage({ [draftKey]: '{"company":"","wechat":"","currency":"USD"}' });
    expect(prepareFixtureOrigin(() => storage).kind).toBe("example");
    storage.setItem(draftKey, '{"note":"Borrador antiguo editado"}');
    expect(prepareFixtureOrigin(() => storage).kind).toBe("restored");
  });

  it("classifies cleared legacy seeds as example without losing an edited history version", () => {
    const draft = { ...untouchedDraft(), company: "示例供应商 · Proveedor de muestra", wechat: "demo-wechat" };
    const historyData = JSON.stringify({ ...draft, note: "Versión ingresada" });
    const storage = memoryStorage({ [draftKey]: JSON.stringify(draft), [historyKey]: JSON.stringify([{ t: 1, label: "Guardada", data: historyData }]) });
    expect(prepareFixtureOrigin(() => storage)).toEqual({ kind: "example", clearedLegacyContact: true });
    const saved = JSON.parse(JSON.parse(storage.getItem(historyKey)!)[0].data);
    expect(saved.note).toBe("Versión ingresada");
    expect(saved.company).toBe("");
    expect(saved.wechat).toBe("");
    expect(storage.getItem(draftKey)).toBeNull();
    expect(storage.getItem(historyKey)).not.toBeNull();
  });
});
