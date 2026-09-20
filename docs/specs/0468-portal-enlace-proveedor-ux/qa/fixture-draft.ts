import { packlistDraftKey, packlistHistoryKey, sanitizePacklistDraft } from "@/lib/studio/prealertas/packlist-draft";

export const FIXTURE_TOKEN = "local-fixture-only-0468";
type FixtureStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type FixtureOrigin = { kind: "example" | "restored" | "unavailable" | "invalid"; clearedLegacyContact?: boolean };
const textFields = ["folio", "company", "email", "wechat", "address", "city", "docDate", "note"];

// Keep this baseline aligned with isoToday()/emptyRow() in PackingListFormSection.
// An untouched form is still autosaved, so the presence of a key is not evidence
// of an edit. Missing fields in older partial drafts retain those same defaults.
function hasDraftChanges(data: Record<string, unknown>): boolean {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = [now.getFullYear(), month, day].join("-");
  if (textFields.some(key => key !== "docDate" && typeof data[key] === "string" && data[key] !== "")) return true;
  if (typeof data.docDate === "string" && data.docDate !== today) return true;
  if (data.currency === "RMB" || data.currency === "EUR" || data.lang === "en") return true;
  if (Array.isArray(data.rows)) {
    if (data.rows.length !== 1) return true;
    const row = data.rows[0] as Record<string, unknown>;
    const emptyFields = ["brand", "code", "zh", "es", "hs", "carton", "ctns", "perctn", "unit", "wkg", "cbm"];
    if (emptyFields.some(key => row[key] !== undefined && row[key] !== "")) return true;
    if (row.same !== undefined && row.same !== false) return true;
    if (row.qtyDirect !== undefined && row.qtyDirect !== "") return true;
  }
  return false;
}

function cleanDraft(raw: string) {
  const data = JSON.parse(sanitizePacklistDraft(raw)) as Record<string, unknown>;
  const hasKnownValue = textFields.some(key => typeof data[key] === "string") || ["USD", "RMB", "EUR"].includes(String(data.currency)) || ["es", "en"].includes(String(data.lang)) || (Array.isArray(data.rows) && data.rows.length > 0);
  if (!hasKnownValue) throw new Error("No restorable draft fields");
  if (Array.isArray(data.rows) && data.rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid draft rows");
  // Older versions of this demo persisted these seeds as values. Keep entered data,
  // but remove only those exact example contacts, including saved history versions.
  let clearedLegacyContact = false;
  if (data.company === "示例供应商 · Proveedor de muestra") { data.company = ""; clearedLegacyContact = true; }
  if (data.wechat === "demo-wechat") { data.wechat = ""; clearedLegacyContact = true; }
  return { raw: JSON.stringify(data), clearedLegacyContact, hasChanges: hasDraftChanges(data) };
}

/** Inspect exactly the draft restored by the real form. Never seed a new draft. */
export function prepareFixtureOrigin(getStorage: () => FixtureStorage): FixtureOrigin {
  let storage: FixtureStorage;
  let raw: string | null;
  let history: string | null;
  try {
    storage = getStorage();
    raw = storage.getItem(packlistDraftKey(FIXTURE_TOKEN));
    history = storage.getItem(packlistHistoryKey(FIXTURE_TOKEN));
  } catch { return { kind: "unavailable" }; }
  let clean: ReturnType<typeof cleanDraft> | undefined;
  try { if (raw) clean = cleanDraft(raw); }
  catch { return { kind: "invalid" }; }
  let clearedLegacyContact = clean?.clearedLegacyContact ?? false;
  try {
    // Match the real form's sanitization/write before restoration. A failed write
    // means it cannot restore the draft, so never announce it as restored.
    if (clean?.hasChanges) storage.setItem(packlistDraftKey(FIXTURE_TOKEN), clean.raw);
    // Remove only an untouched current demo draft. Otherwise the real form would
    // hydrate it and announce a restored draft while this fixture says example.
    else if (clean) storage.removeItem(packlistDraftKey(FIXTURE_TOKEN));
    if (history) {
      let entries: unknown;
      try { entries = JSON.parse(history); } catch { entries = null; }
      if (Array.isArray(entries)) {
        const safeEntries = entries.flatMap(entry => {
          try {
            const saved = cleanDraft(entry.data);
            clearedLegacyContact ||= saved.clearedLegacyContact;
            return [{ ...entry, data: saved.raw }];
          } catch { return []; }
        });
        storage.setItem(packlistHistoryKey(FIXTURE_TOKEN), JSON.stringify(safeEntries));
      }
    }
    return { kind: clean?.hasChanges ? "restored" : "example", clearedLegacyContact };
  } catch { return { kind: "unavailable" }; }
}

/** Reset only this demo purchase. A partial/blocked reset must not claim success. */
export function resetFixtureDraft(getStorage: () => FixtureStorage): boolean {
  try {
    const storage = getStorage();
    storage.removeItem(packlistDraftKey(FIXTURE_TOKEN));
    storage.removeItem(packlistHistoryKey(FIXTURE_TOKEN));
    return storage.getItem(packlistDraftKey(FIXTURE_TOKEN)) === null && storage.getItem(packlistHistoryKey(FIXTURE_TOKEN)) === null;
  } catch { return false; }
}
