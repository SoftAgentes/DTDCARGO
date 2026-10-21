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

  it.each([
    "invoice_unavailable", "invoice_not_postable", "invalid_issue_date",
    "invalid_amounts", "totals_mismatch", "missing_accounts",
    "period_closed", "existing_sale_requires_review",
  ])("%s rechaza sin confirmar asiento ni ejecutar el camino legado", async (reason) => {
    rpcData = notPosted(reason);

    const result = await call();

    expect(result.ok).toBe(false);
    expect(result.entryCode).toBeUndefined();
    expect(result.skipped).toEqual(expect.any(String));
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
