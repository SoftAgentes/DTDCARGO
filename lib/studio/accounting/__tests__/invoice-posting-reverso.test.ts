// @vitest-environment node
/**
 * GO1 I3 · propuesta autoral NO EJECUTADA del adapter público existente.
 * Los nombres RPC/resultado vienen del contrato ratificado, no del catálogo.
 * El doble también soporta el camino legado completo para que el futuro ROJO
 * observe llamadas/resultado/efectos, sin import faltante ni TypeError.
 * No modela commit, transacciones, locks ni el presupuesto interno SQL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  postInvoiceJournalEntry,
  type InvoicePostingInput,
  type InvoicePostingResult,
} from "../invoice-posting";

const TENANT = "00000000-0000-4000-8000-000000000101";
const INVOICE = "00000000-0000-4000-8000-000000000201";
const OTHER_INVOICE = "00000000-0000-4000-8000-000000000202";
const ENTRY = "00000000-0000-4000-8000-000000000301";
const ENTRY_CODE = "A-2026-0042";
const ATOMIC_RPC = "post_invoice_journal_entry_atomic";

type DbError = { code?: string; message: string; hint?: string | null };
type DbResult = { data: unknown; error: DbError | null; count?: number | null };
type Row = Record<string, unknown>;
const rpcCalls: { fn: string; args: unknown }[] = [];
const fromTables: string[] = [];
const writes: { table: string; action: "insert" | "delete"; value?: unknown }[] = [];
let rpcData: unknown;
let rpcError: DbError | null;
let rpcReject: Error | null;
let legacyEntries: Row[];
let admin: ReturnType<typeof makeAdmin>;

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));

const INPUT: InvoicePostingInput = {
  tenantId: TENANT, invoiceId: INVOICE, invoiceCode: "F-2026-0042",
  baseAmount: 100, ivaAmount: 16, totalAmount: 116, entryDate: "2026-09-15",
};

function posted(patch: Row = {}): Row {
  return {
    version: 1, outcome: "posted", reason: "posted",
    invoice_id: INVOICE, entry_id: ENTRY, entry_code: ENTRY_CODE,
    entry_date: "2026-09-15", ...patch,
  };
}

function notPosted(reason: string): Row {
  return {
    version: 1, outcome: "not_posted", reason, invoice_id: INVOICE,
    entry_id: null, entry_code: null, entry_date: null,
  };
}

function makeAdmin() {
  const accounts = [
    { id: "ar", code: "1.1.2" }, { id: "income", code: "4.5" }, { id: "iva", code: "2.1.5" },
  ];
  return {
    from(table: string) {
      fromTables.push(table);
      if (!["journal_entries", "accounts", "journal_lines"].includes(table)) {
        throw new Error("Doble GO1: tabla no modelada: " + table);
      }
      const filters: [string, string, unknown][] = [];
      let inserted = false;
      function response(): DbResult {
        if (table === "accounts") return { data: accounts, error: null };
        if (table === "journal_entries" && !inserted) {
          const rows = legacyEntries.filter((row) => filters.every(([op, col, value]) =>
            op === "is" ? row[col] === value : row[col] === value));
          return { data: rows, count: rows.length, error: null };
        }
        return { data: null, error: null };
      }
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, value: unknown) => { filters.push(["eq", col, value]); return chain; },
        is: (col: string, value: unknown) => { filters.push(["is", col, value]); return chain; },
        in: () => chain,
        insert: (value: unknown) => {
          inserted = true;
          writes.push({ table, action: "insert", value });
          return chain;
        },
        delete: () => { writes.push({ table, action: "delete" }); return chain; },
        single: () => Promise.resolve({ data: { id: "legacy-header-go1" }, error: null }),
        then: <TResult1 = DbResult, TResult2 = never>(
          fulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
          rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => Promise.resolve().then(response).then(fulfilled, rejected),
      };
      return chain;
    },
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      // El correlativo anterior conserva una respuesta válida de string.
      if (fn === "next_entry_code") return Promise.resolve({ data: "A-2026-0001", error: null });
      if (fn !== ATOMIC_RPC) return Promise.reject(new Error("Doble GO1: RPC no modelada: " + fn));
      if (rpcReject) return Promise.reject(rpcReject);
      return Promise.resolve({ data: rpcData, error: rpcError });
    },
  };
}

beforeEach(() => {
  rpcCalls.length = 0;
  fromTables.length = 0;
  writes.length = 0;
  legacyEntries = [];
  rpcData = posted();
  rpcError = null;
  rpcReject = null;
  admin = makeAdmin();
});

async function call(input: InvoicePostingInput = INPUT): Promise<InvoicePostingResult> {
  return postInvoiceJournalEntry(input);
}

function expectOnlyAtomicCall() {
  expect(rpcCalls).toEqual([
    { fn: ATOMIC_RPC, args: { p_tenant_id: TENANT, p_invoice_id: INVOICE } },
  ]);
  expect(fromTables).toEqual([]);
  expect(writes).toEqual([]);
}

describe("GO1 I3 · autoridad y delegación del adapter", () => {
  it("envía sólo tenant/factura y reconoce posted validado sin writes directos", async () => {
    const result = await call();

    expect(result).toMatchObject({ ok: true, entryCode: ENTRY_CODE });
    expect(result.skipped).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    { nombre: "importes y código manipulados", patch: { invoiceCode: "F-CLIENTE", baseAmount: -999, ivaAmount: -1, totalAmount: -1000 } },
    { nombre: "fecha del caller distinta de la persistida", patch: { entryDate: "2099-12-31" } },
  ])("$nombre no sustituyen al documento persistido", async ({ patch }) => {
    const result = await call({ ...INPUT, ...patch });

    expect(result).toMatchObject({ ok: true, entryCode: ENTRY_CODE });
    expectOnlyAtomicCall();
  });

  it("referral_credit no se toma por una venta íntegra ya asentada", async () => {
    legacyEntries = [{
      id: "referral-go1", invoice_id: INVOICE, tenant_id: TENANT,
      source: "referral_credit", status: "asentado", deleted_at: null,
    }];

    const result = await call();

    expect(result).toMatchObject({ ok: true, entryCode: ENTRY_CODE });
    expect(result.skipped).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it("already_posted conserva el resultado público sin repetir generación ni inserts", async () => {
    rpcData = posted({ outcome: "already_posted", reason: "entry_already_exists" });

    const result = await call();

    expect(result).toMatchObject({ ok: true, skipped: "entry-already-exists" });
    expectOnlyAtomicCall();
  });

  it("cero persistido coherente es no-op explícito, no asiento confirmado", async () => {
    rpcData = notPosted("zero_total");

    const result = await call();

    expect(result).toMatchObject({ ok: true, skipped: "zero-total" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  // GO2 L1: contrato público propuesto para rechazos SQL conocidos.
  // Un adapter que convierta todos a unknown debe fallar estas expectativas;
  // es razonamiento de fuente, no un mutante ejecutado ni catálogo instalado.
  it.each([
    ["invoice_unavailable", "invoice-unavailable"],
    ["invoice_not_postable", "invoice-not-postable"],
    ["invalid_issue_date", "invalid-issue-date"],
    ["invalid_amounts", "invalid-amounts"],
    ["totals_mismatch", "totals-mismatch"],
    ["missing_accounts", "missing-accounts"],
    ["period_closed", "period-closed"],
    ["existing_sale_requires_review", "existing-sale-requires-review"],
  ])("%s rechaza sin confirmar asiento ni ejecutar el camino legado", async (reason, skipped) => {
    rpcData = notPosted(reason);

    const result = await call();

    expect(result.ok).toBe(false);
    expect(result.entryCode).toBeUndefined();
    expect(result.skipped).toEqual(expect.any(String));
    expect(result.skipped).toBe(skipped);
    expect(result.skipped).not.toBe("posting-state-unknown");
    expectOnlyAtomicCall();
    // El rechazo de esta operación no prueba ausencia de antecedentes.
  });
});

describe("GO1 I3 · resultado inválido o ambiguo no se convierte en éxito", () => {
  it.each([
    { nombre: "null", value: null },
    { nombre: "array vacío", value: [] },
    { nombre: "array con un resultado", value: [posted()] },
    { nombre: "versión incompatible", value: posted({ version: 2 }) },
    { nombre: "outcome desconocido", value: posted({ outcome: "done" }) },
    { nombre: "identidad de otra factura", value: posted({ invoice_id: OTHER_INVOICE }) },
    { nombre: "entry_id no UUID", value: posted({ entry_id: "no-es-uuid" }) },
    { nombre: "entry_code vacío", value: posted({ entry_code: "" }) },
    { nombre: "fecha civil imposible", value: posted({ entry_date: "2026-02-30" }) },
    { nombre: "posted sin fecha", value: posted({ entry_date: null }) },
    { nombre: "not_posted con campos de asiento", value: posted({ outcome: "not_posted", reason: "zero_total" }) },
    { nombre: "reason fuera del conjunto finito", value: notPosted("texto-libre-no-contractual") },
  ])("$nombre produce estado desconocido y no reintenta", async ({ value }) => {
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it("RPC ausente devuelve dependencia controlada sin fallback a INSERTs", async () => {
    rpcData = null;
    rpcError = { code: "PGRST202", message: "Could not find post_invoice_journal_entry_atomic in schema cache" };

    const result = await call();

    expect(result.ok).toBe(false);
    expect(result.entryCode).toBeUndefined();
    expect(Boolean(result.error || result.skipped)).toBe(true);
    expectOnlyAtomicCall();
  });

  it("desconexión después de posible commit es unknown; nunca retry automático general", async () => {
    rpcReject = new Error("fetch failed after possible commit go1");

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expect(String(result.error ?? "")).not.toMatch(/no existe.*asiento|no se creó.*asiento/i);
    expectOnlyAtomicCall();
    // No afirma que haya ocurrido un commit: modela únicamente la ambigüedad
    // observable del adapter. Locks/atomicidad/rollback se prueban en PG aparte.
  });
});

// I3-A: sufijo nuevo. Los 10454bytes anteriores, doble y28oráculos permanecen literales.
// Autoría de contrato, NO EJECUTADA; no acredita RPC instalada, commit o locks SQL.
describe("I3-A · contrato escalar estricto y señal segura", () => {
  it.each([
    { nombre: "posted con reason de reconocimiento", value: posted({ reason: "entry_already_exists" }) },
    { nombre: "posted con reason de cero", value: posted({ reason: "zero_total" }) },
    { nombre: "already_posted con reason posted", value: posted({ outcome: "already_posted", reason: "posted" }) },
    { nombre: "already_posted con rechazo", value: posted({ outcome: "already_posted", reason: "invoice_unavailable" }) },
    { nombre: "not_posted con reason posted", value: notPosted("posted") },
    { nombre: "not_posted con reason de reconocimiento", value: notPosted("entry_already_exists") },
  ])("$nombre no confirma un asiento ni reintenta", async ({ value }) => {
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    { field: "entry_id", mode: "ausente" },
    { field: "entry_id", mode: "undefined" },
    { field: "entry_id", mode: "no-null" },
    { field: "entry_code", mode: "ausente" },
    { field: "entry_code", mode: "undefined" },
    { field: "entry_code", mode: "no-null" },
    { field: "entry_date", mode: "ausente" },
    { field: "entry_date", mode: "undefined" },
    { field: "entry_date", mode: "no-null" },
  ])("zero_total con $field $mode no certifica no-op", async ({ field, mode }) => {
    const value = notPosted("zero_total");
    if (mode === "ausente") delete value[field];
    else value[field] = mode === "undefined" ? undefined : "valor-no-nulo";
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it("un rechazo conocido sin entry_date null no se valida sólo por su reason", async () => {
    const value = notPosted("period_closed");
    delete value.entry_date;
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it("zero_total sin ninguno de los tres campos no equivale a null explícito", async () => {
    const value = notPosted("zero_total");
    delete value.entry_id;
    delete value.entry_code;
    delete value.entry_date;
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    { nombre: "posted sin entry_id", value: posted({ entry_id: undefined }) },
    { nombre: "posted con salto final en UUID", value: posted({ entry_id: ENTRY + "\n" }) },
    { nombre: "already_posted sin entry_id", value: posted({ outcome: "already_posted", reason: "entry_already_exists", entry_id: undefined }) },
    { nombre: "posted con código blanco", value: posted({ entry_code: "   " }) },
    { nombre: "already_posted con código blanco", value: posted({ outcome: "already_posted", reason: "entry_already_exists", entry_code: "\n\t" }) },
    { nombre: "posted con código numérico", value: posted({ entry_code: 42 }) },
    { nombre: "already_posted sin fecha", value: posted({ outcome: "already_posted", reason: "entry_already_exists", entry_date: undefined }) },
    { nombre: "already_posted con fecha imposible", value: posted({ outcome: "already_posted", reason: "entry_already_exists", entry_date: "2026-02-30" }) },
  ])("$nombre requiere revisión sin código confirmado", async ({ value }) => {
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    { nombre: "booleano", value: false },
    { nombre: "número", value: 42 },
    { nombre: "string", value: "posted" },
    { nombre: "versión string", value: posted({ version: "1" }) },
    { nombre: "sin identidad", value: posted({ invoice_id: undefined }) },
    { nombre: "sin reason", value: posted({ reason: null }) },
  ])("respuesta $nombre no sustituye el objeto v1 identificable", async ({ value }) => {
    rpcData = value;

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    "0000-01-01", "2100-02-29", "1900-02-29", "2026-04-31",
    "2026-2-01", "2026-09-15T00:00:00Z", "2026-13-01", "2026-01-00", "2026-09-15\n",
  ])("fecha civil %s no se normaliza o reemplaza por hoy", async (entry_date) => {
    rpcData = posted({ entry_date });

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown" });
    expect(result.entryCode).toBeUndefined();
    expectOnlyAtomicCall();
  });

  it.each([
    { entry_date: "2000-02-29", outcome: "posted", reason: "posted" },
    { entry_date: "2024-02-29", outcome: "already_posted", reason: "entry_already_exists" },
    { entry_date: "1900-02-28", outcome: "posted", reason: "posted" },
    { entry_date: "0001-01-01", outcome: "already_posted", reason: "entry_already_exists" },
    { entry_date: "9999-12-31", outcome: "posted", reason: "posted" },
  ])("fecha civil válida $entry_date conserva $outcome sin writes", async ({ entry_date, outcome, reason }) => {
    rpcData = posted({ entry_date, outcome, reason });

    const result = await call();

    expect(result).toEqual({
      ok: true, entryCode: ENTRY_CODE,
      ...(outcome === "already_posted" ? { skipped: "entry-already-exists" } : {}),
    });
    expectOnlyAtomicCall();
  });

  it.each(["42883", "PGRST202"])("RPC ausente %s tiene código controlado y no filtra crudos", async (code) => {
    rpcData = null;
    rpcError = { code, message: "sql-interno-no-publicar", hint: "detalle-interno-no-publicar" };

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "atomic-posting-unavailable", error: expect.any(String) });
    expect(result.entryCode).toBeUndefined();
    expect(result.error).not.toContain("sql-interno-no-publicar");
    expect(result.error).not.toContain("detalle-interno-no-publicar");
    expectOnlyAtomicCall();
  });

  it.each(["23505", "57014", "ETIMEDOUT"])("error %s conserva unknown incluso con data de éxito", async (code) => {
    rpcData = posted();
    rpcError = { code, message: "sql-interno-no-publicar", hint: "detalle-interno-no-publicar" };

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown", error: expect.any(String) });
    expect(result.entryCode).toBeUndefined();
    expect(result.error).not.toContain("sql-interno-no-publicar");
    expect(result.error).not.toContain("detalle-interno-no-publicar");
    expectOnlyAtomicCall();
  });

  it("excepción con detalle interno conserva unknown sin publicar mensaje o repetir RPC", async () => {
    rpcReject = new Error("sql-interno-no-publicar");

    const result = await call();

    expect(result).toMatchObject({ ok: false, skipped: "posting-state-unknown", error: expect.any(String) });
    expect(result.entryCode).toBeUndefined();
    expect(result.error).not.toContain("sql-interno-no-publicar");
    expectOnlyAtomicCall();
  });
});
