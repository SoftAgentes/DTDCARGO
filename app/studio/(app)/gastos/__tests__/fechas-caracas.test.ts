// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ client: vi.fn(), guard: vi.fn(), post: vi.fn(), void: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: io.client }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: io.guard, capabilityDenial: vi.fn() }));
vi.mock("@/lib/studio/accounting/expense-posting", () => ({ syncExpenseEntry: io.post, voidExpenseEntriesForExpense: io.void }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/attachments/pilot-gate", () => ({ attachmentsPilotState: () => ({ enabled: false }) }));
import { createExpenseAction, updateExpenseAction } from "../actions";

const tenant = "tenant-c1", expense = "expense-c1";
type Row = Record<string, unknown>;
function setup(options: { settings?: Row[]; entries?: Row[]; transportEntries?: unknown[]; origin?: Row[]; errorTable?: string; errorCode?: string; crossMidnight?: boolean } = {}) {
  const mutations: { table: string; patch: Row }[] = [];
  const reads: { table: string; filters: [string, unknown][]; columns: string }[] = [];
  const original = { id: expense, tenant_id: tenant, deleted_at: null, expense_code: "G-C1", amount_usd: 10.25, account_id: "cost", method: "cash", occurred_at: "2026-10-21T02:30:00Z" };
  const live = { id: "entry-c1", tenant_id: tenant, expense_id: expense, source: "expense", status: "asentado", entry_date: "2026-10-21", deleted_at: null };
  const rows: Record<string, Row[]> = {
    user_tenants: [{ tenant_id: tenant }], accounts: [{ id: "cost", is_postable: true }],
    expenses: options.origin ?? [original],
    accounting_settings: options.settings ?? [{ tenant_id: tenant, closing_date: null }],
    journal_entries: options.entries ?? [live],
  };
  const rpc = vi.fn(async () => ({ data: "G-2026-0001", error: null }));
  const upload = vi.fn(async () => ({ error: null }));
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "actor-c1" } }, error: null }) }, rpc,
    storage: { from: () => ({ upload, remove: vi.fn() }) },
    from(table: string) {
      let patch: Row | null = null, columns = "*", limit = Infinity;
      const filters: [string, unknown][] = [];
      const execute = () => {
        if (patch) { mutations.push({ table, patch }); return { data: [{ ...original, ...patch }], error: null }; }
        reads.push({ table, filters: [...filters], columns });
        if (table === options.errorTable) return { data: null, error: { code: options.errorCode ?? "PGRST205", message: "synthetic failure" } };
        // Account code lookup is a synthetic seeded account; all domain filters
        // on origins/config/journals are actually applied and observed.
        const data = (rows[table] ?? []).filter(r => table === "accounts" || filters.every(([k,v]) => r[k] === v)).slice(0, limit);
        // Malformación de transporte DESPUÉS de ejecutar la query: no lanzar
        // en el filtro r[k] ni fabricar un rechazo antes del guard del handler.
        return { data: table === "journal_entries" && options.transportEntries !== undefined ? options.transportEntries as Row[] : data, error: null };
      };
      const single = async () => { const r = execute(); return { ...r, data: r.data?.length === 1 ? r.data[0] : null, error: r.error ?? (r.data && r.data.length > 1 ? { code: "PGRST116", message: "multiple" } : null) }; };
      const q = { select: (value: string) => { columns = value; return q; },
        eq: (k:string,v:unknown) => { filters.push([k,v]); return q; }, is: (k:string,v:unknown) => { filters.push([k,v]); return q; },
        limit: (n:number) => { limit=n; return q; },
        update: (value: Row) => { patch=value; return q; }, insert: (value:Row) => { patch=value; return q; },
        maybeSingle: single, single,
        then: (resolve: (r: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return q;
    },
  };
  io.client.mockResolvedValue(client);
  io.guard.mockImplementation(async () => { if (options.crossMidnight) vi.setSystemTime(new Date("2026-10-21T04:00:00Z")); return null; });
  return { mutations, reads, rpc, upload, original, live };
}
function form(amount = "20.25") {
  const f = new FormData();
  for (const [key,value] of Object.entries({ amount, currency:"USD", fx_rate:"1", category:"otro", scope:"external", method:"cash", note:"gasto sintético" })) f.set(key,value);
  return f;
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake:["Date"] }); vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z")); io.post.mockResolvedValue({ ok:true }); io.void.mockResolvedValue({ ok:true }); });
afterEach(() => vi.useRealTimers());

describe("C1 · gastos nuevos y guarda de historia", () => {
  it.each([null, false, 0, ""])("fila de asiento malformada %j no equivale a []", async value => {
    const state=setup({ transportEntries: [value] });
    expect(await updateExpenseAction(expense, {}, form())).toMatchObject({ error: expect.any(String) });
    expect(state.reads.find(r => r.table === "journal_entries")?.filters).toEqual([
      ["tenant_id",tenant],["expense_id",expense],["status","asentado"],["deleted_at",null],
    ]);
    expect(state.mutations).toEqual([]); expect(state.rpc).not.toHaveBeenCalled(); expect(state.upload).not.toHaveBeenCalled();
    expect(io.void).not.toHaveBeenCalled(); expect(io.post).not.toHaveBeenCalled();
  });
  it("una fila válida con fecha histórica coincidente conserva fecha al repostear", async () => {
    const state=setup({ entries: [{ id:"live",tenant_id:tenant,expense_id:expense,source:"expense",status:"asentado",entry_date:"2026-10-20",deleted_at:null }] });
    expect(await updateExpenseAction(expense, {}, form())).toMatchObject({ ok:true });
    expect(state.mutations).toHaveLength(1); expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate:"2026-10-20" }));
  });
  it("persiste instante capturado antes del guard y asienta su día Caracas", async () => {
    const state = setup({ crossMidnight:true });
    expect(await createExpenseAction({},form())).toMatchObject({ ok:true });
    expect(state.mutations[0].patch).toMatchObject({ occurred_at:"2026-10-21T03:59:59.999Z", amount_usd:20.25 });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate:"2026-10-20", amountUsd:20.25 }));
  });
  it("cierre del día Caracas bloquea antes de correlativo/evidencia/insert", async () => {
    const state = setup({ settings:[{ tenant_id:tenant, closing_date:"2026-10-20" }] });
    expect(await createExpenseAction({},form())).toMatchObject({ error:expect.stringMatching(/cerrado/) });
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.upload).not.toHaveBeenCalled(); expect(state.mutations).toEqual([]);
  });
  it("no refechar asiento histórico al editar importe", async () => {
    const state=setup();
    expect(await updateExpenseAction(expense,{},form())).toMatchObject({ error:expect.stringMatching(/fecha|hist[oó]ric|gobernad/i) });
    expect(state.mutations).toEqual([]); expect(io.void).not.toHaveBeenCalled(); expect(io.post).not.toHaveBeenCalled();
  });
  it.each(["PGRST205","42P01","PGRST116"])("error %s al leer cierre no significa período abierto", async errorCode => {
    const state=setup({ errorTable:"accounting_settings",errorCode });
    expect(await updateExpenseAction(expense,{},form())).toMatchObject({ error:expect.any(String) });
    expect(state.mutations).toEqual([]); expect(io.void).not.toHaveBeenCalled();
  });
  it("dos asientos vivos no se ocultan mediante limit1", async () => {
    const entry={ id:"a",tenant_id:tenant,expense_id:expense,source:"expense",status:"asentado",entry_date:"2026-10-20",deleted_at:null };
    const state=setup({ entries:[entry,{...entry,id:"b"}] });
    expect(await updateExpenseAction(expense,{},form())).toMatchObject({ error:expect.any(String) });
    expect(state.mutations).toEqual([]); expect(io.void).not.toHaveBeenCalled();
  });
  it("ausencia válida de asiento conserva cierre y autoriza repostear con fecha del origen", async () => {
    const state=setup({ entries:[],settings:[] });
    expect(await updateExpenseAction(expense,{},form())).toMatchObject({ ok:true });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate:"2026-10-20" }));
    const originRead=state.reads.find(r=>r.table==="expenses");
    expect(originRead?.filters).toEqual(expect.arrayContaining([["id",expense],["tenant_id",tenant],["deleted_at",null]]));
  });
  it("edición descriptiva conserva fecha y no repostea historia", async () => {
    setup();
    expect(await updateExpenseAction(expense,{},form("10.25"))).toMatchObject({ ok:true });
    expect(io.void).not.toHaveBeenCalled(); expect(io.post).not.toHaveBeenCalled();
  });
  it.each([null, "", "  ", true])("importe de origen malformado %j no autoriza reescritura de historia", async amount_usd => {
    const original = { id: expense, tenant_id: tenant, deleted_at: null, expense_code: "G-C1", amount_usd, account_id: "cost", method: "cash", occurred_at: "2026-10-21T02:30:00Z" };
    const state = setup({ origin: [original], entries: [] });
    expect(await updateExpenseAction(expense, {}, form())).toMatchObject({ error: expect.any(String) });
    expect(state.mutations).toEqual([]); expect(io.void).not.toHaveBeenCalled(); expect(io.post).not.toHaveBeenCalled();
  });
});
