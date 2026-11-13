// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), denial: vi.fn(), post: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: io.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: io.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: io.denial, capabilityDenial: vi.fn() }));
vi.mock("@/lib/studio/accounting/invoice-posting", () => ({ postInvoiceJournalEntry: io.post }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: io.mail }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/expense-alerts-queries", () => ({
  findOrCreateConsolidationShipment: vi.fn(async () => ({ shipmentId: "container", code: "CONT-C1" })),
  ensureActiveAlert: vi.fn(async () => ({ created: false })), revertAlertIfShipmentEmpty: vi.fn(),
}));
import { changeReceiptStatusAction } from "../actions";

type Row = Record<string, unknown>;
const TENANT = "11111111-1111-4111-8111-111111111111";
const INVOICE = "22222222-2222-4222-8222-222222222222";
const emitted = { outcome: "invoiced", invoice_id: INVOICE, invoice_code: "F-C1", base_amount: 10.25, iva_amount: 0, total_amount: 10.25 };
function setup(payload: Row, options: { readError?: boolean; rpcError?: boolean; tenant?: string | null } = {}) {
  const tenant = options.tenant === undefined ? TENANT : options.tenant;
  const events: Row[] = [], writes: Row[] = [], reads: Row[] = [];
  const receipt: Row = { id: "receipt", tenant_id: TENANT, status: "pendiente_consolidacion", receipt_code: "WR-C1", destination_city: null,
    shipment_id: null, is_orphan: false, boxes: 1, total_cbm: 1, total_weight_kg: 10, prealerta_id: "box", invoice_verified_at: "2026-10-20T12:00:00Z", deleted_at: null };
  const rpc = vi.fn(async (name: string, args: Row) => {
    expect(name).toBe("sales_order_claim_and_invoice"); expect(args).toEqual({ p_tenant_id: TENANT, p_receipt_id: "receipt" });
    return options.rpcError ? { data: null, error: { message: "rechazo sintético" } } : { data: structuredClone(payload), error: null };
  });
  const db = { rpc, from(table: string) {
    let columns = "*", op = "select", values: Row = {}, limit = Infinity;
    const filters: [string, unknown][] = [];
    function result(single = false) {
      if (op === "insert" && table === "warehouse_receipt_events") { events.push({ ...values }); return { data: null, error: null }; }
      if (op === "update" && table === "warehouse_receipts_cn") {
        if (!filters.every(([k,v]) => receipt[k] === v)) return { data: null, error: { message: "receipt mismatch" } };
        writes.push({ ...values }); Object.assign(receipt, values); return { data: null, error: null };
      }
      const rows = table === "user_tenants" ? (tenant ? [{ tenant_id: tenant }] : [])
        : table === "warehouse_receipts_cn" ? [receipt]
        : table === "prealerta_documents" ? [{ prealerta_id: "box", tenant_id: TENANT, deleted_at: null, doc_type: "packing" }]
        : table === "invoices" ? [] : null;
      if (!rows) throw new Error("unexpected IO " + table + ":" + op);
      if (table === "invoices") reads.push({ columns, filters: [...filters], limit });
      const data = (rows as Row[]).filter(row => filters.every(([k,v]) => row[k] === v)).slice(0, limit)
        .map(row => columns === "*" ? { ...row } : Object.fromEntries(columns.split(",").map(c => c.trim()).filter(c => c in row).map(c => [c, row[c]])));
      return { data: single ? data[0] ?? null : data, error: table === "invoices" && options.readError ? { code: "57014" } : null };
    }
    const q = { select: (s: string) => { columns = s; return q; }, eq: (k: string,v: unknown) => { filters.push([k,v]); return q; },
      is: (k: string,v: unknown) => { filters.push([k,v]); return q; }, limit: (n: number) => { limit=n; return q; },
      update: (v: Row) => { op="update"; values=v; return q; }, insert: (v: Row) => { op="insert"; values=v; return q; },
      maybeSingle: async () => result(true), then: (fn: (v: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(fn) };
    return q;
  } };
  io.client.mockResolvedValue(db); io.admin.mockReturnValue(db);
  return { rpc, events, writes, reads };
}
beforeEach(() => { vi.clearAllMocks(); io.denial.mockResolvedValue(null); io.post.mockResolvedValue({ ok: true }); });
const run = () => changeReceiptStatusAction("receipt", "consolidado", { destinationCity: "Caracas" });
describe("C1 · caller CN conserva el estado real de emisión", () => {
  it.each(["fecha presente inválida", "readback fallido"])("%s: evento emitida/asiento pendiente sin prefijo contradictorio", async kind => {
    const state=setup(kind === "fecha presente inválida" ? { ...emitted, issued_at: "2026-02-30" } : emitted, { readError: true });
    expect(await run()).toEqual({ ok: true });
    expect(state.events.find(e => e.event_type === "note")?.description).toBe("Factura F-C1 emitida; asiento pendiente: no se pudo confirmar su fecha de emisión. Requiere revisión contable.");
    expect(state.events.every(e => e.tenant_id === TENANT && e.receipt_id === "receipt")).toBe(true);
    expect(state.rpc).toHaveBeenCalledOnce(); expect(io.post).not.toHaveBeenCalled(); expect(io.mail).not.toHaveBeenCalled();
    expect(state.writes).toEqual([{ status: "consolidado", destination_city: "Caracas", shipment_id: "container" }]);
    expect(state.reads).toHaveLength(kind === "fecha presente inválida" ? 0 : 1);
  });
  it("emisión completa conserva evento, importe y fecha persistida del asiento", async () => {
    const state=setup({ ...emitted, issued_at: "2026-10-20" }); expect(await run()).toEqual({ ok: true });
    expect(state.events.find(e => e.event_type === "note")?.description).toBe("Factura F-C1 generada automáticamente · $10.25 (SDD-0072 Fase 2).");
    expect(io.post).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tenantId: TENANT, invoiceId: INVOICE, entryDate: "2026-10-20", totalAmount: 10.25 }));
    expect(state.rpc).toHaveBeenCalledOnce(); expect(state.reads).toEqual([]);
  });
  it("error RPC conserva no facturada, sin fabricar emisión ni posteo", async () => {
    const state=setup({}, { rpcError: true }); expect(await run()).toEqual({ ok: true });
    expect(state.events.find(e => e.event_type === "note")?.description).toBe("No se facturó automáticamente: no se pudo facturar: rechazo sintético");
    expect(state.rpc).toHaveBeenCalledOnce(); expect(io.post).not.toHaveBeenCalled(); expect(state.reads).toEqual([]);
  });
  it("no aplicable no agrega aviso financiero ni poster", async () => {
    const state=setup({ outcome: "no_sales_order" }); expect(await run()).toEqual({ ok: true });
    expect(state.events.filter(e => e.event_type === "note")).toEqual([]); expect(state.rpc).toHaveBeenCalledOnce(); expect(io.post).not.toHaveBeenCalled();
  });
  it("guard denegado precede al motor y todos los efectos", async () => {
    const state=setup(emitted); io.denial.mockResolvedValue("Acceso denegado"); expect(await run()).toEqual({ error: "Acceso denegado" });
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.events).toEqual([]); expect(state.writes).toEqual([]); expect(io.post).not.toHaveBeenCalled();
  });
  it("tenant no resuelto no invoca el cliente administrativo ni la RPC", async () => {
    const state=setup(emitted, { tenant: null }); expect(await run()).toEqual({ errorCode: "tenant_unresolved" });
    expect(io.admin).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled(); expect(state.events).toEqual([]); expect(state.writes).toEqual([]);
  });
});
