// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  client: vi.fn(), account: vi.fn(), post: vi.fn(), void: vi.fn(), revalidate: vi.fn(),
  role: vi.fn(async () => "commercial"), admin: { current: null as unknown },
}));
vi.mock("@/lib/db/server", () => ({ createClient: io.client }));
// SDD-0624: el asiento histórico se lee con el cliente de servicio (la 0528 se
// lo oculta a comercial); el doble devuelve el mismo cliente para ver la lectura.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => io.admin.current }));
vi.mock("@/lib/studio/rbac-guard", async (orig) => ({
  ...(await orig<typeof import("@/lib/studio/rbac-guard")>()),
  getStudioRole: io.role,
}));
vi.mock("@/lib/studio/expense-queries", () => ({ resolveExpenseAccountId: io.account }));
vi.mock("@/lib/studio/accounting/expense-posting", () => ({
  syncExpenseEntry: io.post, voidExpenseEntriesForExpense: io.void,
}));
vi.mock("next/cache", () => ({ revalidatePath: io.revalidate }));

import { createExpenseAction, updateExpenseAction } from "../actions";

const T = "10000000-0000-4000-8000-000000000001";
const U = "20000000-0000-4000-8000-000000000001";
const G = "30000000-0000-4000-8000-000000000001";
const A = "40000000-0000-4000-8000-000000000001";
const B = "40000000-0000-4000-8000-000000000002";
const J = "50000000-0000-4000-8000-000000000001";
const OTHER = "90000000-0000-4000-8000-000000000001";
type Row = Record<string, unknown>;
type Envelope = { data: unknown; error: unknown };
type Read = { table: string; columns: string; filters: [string, unknown][]; limit: number; terminal: string };
type Effect = { kind: string; value?: unknown };
type Options = {
  authenticated?: boolean;
  tenant?: unknown;
  tenantError?: unknown;
  tenantThrows?: boolean;
  settings?: Row[];
  origin?: Row[];
  entries?: Row[];
  transport?: Record<string, Envelope>;
  throws?: string;
  account?: string | null;
  returnedAt?: string;
  uploadError?: { message: string };
  updateError?: { message: string };
};

function deferred<TValue>() {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(options: Options = {}) {
  const reads: Read[] = [], effects: Effect[] = [], order: string[] = [];
  const original: Row = {
    id: G, tenant_id: T, user_id: U, deleted_at: null, expense_code: "EXP-fixture",
    receipt_path: T + "/" + U + "/EXP-fixture.jpg", amount_usd: 25,
    account_id: A, method: "cash", occurred_at: "2026-10-21T02:30:00.000Z",
  };
  const live: Row = {
    id: J, tenant_id: T, expense_id: G, source: "expense",
    entry_date: "2026-10-20", status: "asentado", deleted_at: null,
  };
  const rows: Record<string, Row[]> = {
    user_tenants: [{ tenant_id: T, user_id: U, disabled_at: null }],
    accounting_settings: options.settings ?? [{
      tenant_id: T, closing_date: null, locked_by: null, locked_at: null, updated_at: null,
    }],
    expenses: options.origin ?? [original],
    journal_entries: options.entries ?? [live],
  };
  const project = (row: Row, columns: string): Row => columns === "*" ? { ...row } :
    Object.fromEntries(columns.split(",").map((key) => key.trim()).map((key) => [key, row[key]]));
  const client = {
    auth: {
      getUser: vi.fn(async () => {
        order.push("auth");
        return { data: { user: options.authenticated === false ? null : { id: U } }, error: null };
      }),
    },
    rpc: vi.fn(async (name: string, args?: unknown) => {
      order.push(name);
      if (name === "get_user_tenant_id") {
        if (options.tenantThrows) throw new Error("synthetic tenant transport");
        return {
          data: Object.prototype.hasOwnProperty.call(options, "tenant") ? options.tenant : T,
          error: options.tenantError ?? null,
        };
      }
      if (name !== "next_expense_code") throw new Error("Unexpected synthetic RPC: " + name);
      effects.push({ kind: "code", value: args });
      return { data: "EXP-fixture", error: null };
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string, file: File, settings: unknown) => {
          order.push("upload"); effects.push({ kind: "upload", value: { path, file, settings } });
          return { error: options.uploadError ?? null };
        }),
        remove: vi.fn(async (paths: string[]) => {
          order.push("remove"); effects.push({ kind: "remove", value: paths }); return { error: null };
        }),
      })),
    },
    from(table: string) {
      let columns = "*", max = Infinity, mode = "read", patch: Row = {};
      const filters: [string, unknown][] = [];
      const execute = (terminal: string): Envelope => {
        order.push(table + ":" + mode);
        if (mode !== "read") {
          effects.push({ kind: mode, value: { table, patch: { ...patch }, filters: [...filters] } });
          if (mode === "update" && options.updateError) return { data: null, error: options.updateError };
          const returned = { ...original, ...patch, occurred_at: options.returnedAt ?? "2026-10-22T12:00:00.000Z" };
          return { data: [project(returned, columns)], error: null };
        }
        reads.push({ table, columns, filters: [...filters], limit: max, terminal });
        if (options.throws === table) throw new Error("synthetic read transport");
        const filtered = (rows[table] ?? [])
          .filter((row) => filters.every(([key, value]) => row[key] === value))
          .slice(0, max).map((row) => project(row, columns));
        // Deliberately AFTER filters: malformed transport must reach the real reader.
        if (Object.prototype.hasOwnProperty.call(options.transport ?? {}, table)) return options.transport![table];
        return { data: filtered, error: null };
      };
      const single = async (required: boolean): Promise<Envelope> => {
        const result = execute(required ? "single" : "maybeSingle");
        if (result.error || !Array.isArray(result.data)) return result;
        if (result.data.length === 1) return { data: result.data[0], error: null };
        return {
          data: null,
          error: result.data.length > 1 || required ? { code: "PGRST116", message: "synthetic cardinality" } : null,
        };
      };
      const query = {
        select(value: string) { columns = value; return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        is(key: string, value: unknown) { filters.push([key, value]); return query; },
        limit(value: number) { max = value; return query; },
        insert(value: Row) { mode = "insert"; patch = value; return query; },
        update(value: Row) { mode = "update"; patch = value; return query; },
        maybeSingle: () => single(false),
        single: () => single(true),
        then(onFulfilled: (value: Envelope) => unknown, onRejected?: (error: unknown) => unknown) {
          return Promise.resolve().then(() => execute("array")).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };
  io.client.mockResolvedValue(client);
  io.admin.current = client;
  io.account.mockImplementation(async () => { order.push("account"); return "account" in options ? options.account : A; });
  io.post.mockImplementation(async (value) => { order.push("post"); effects.push({ kind: "post", value }); });
  io.void.mockImplementation(async (...value) => { order.push("void"); effects.push({ kind: "void", value }); });
  io.revalidate.mockImplementation((value) => { order.push("revalidate"); effects.push({ kind: "revalidate", value }); });
  return { client, reads, effects, order, original, live, rows };
}

function form(values: Record<string, string> = {}, file?: File) {
  const data = new FormData();
  Object.entries({
    amount: "30", currency: "USD", fx_rate: "1", category: "taxi", method: "cash",
    note: "Traslado ficticio", location: "Ubicación ficticia", billable: "true", ...values,
  }).forEach(([key, value]) => data.set(key, value));
  if (file) data.set("receipt", file);
  return data;
}
const photo = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 3, 7, 11])], "c3-ficticio.png", { type: "image/png" });
const invoke = (action: "create" | "edit", data = form()) => action === "create"
  ? createExpenseAction({}, data) : updateExpenseAction(G, {}, data);
function noEffects(context: ReturnType<typeof setup>) {
  expect(context.effects).toEqual([]);
  expect(io.post).not.toHaveBeenCalled();
  expect(io.void).not.toHaveBeenCalled();
  expect(io.revalidate).not.toHaveBeenCalled();
}
async function blocked(context: ReturnType<typeof setup>, action: "create" | "edit", data = form({}, photo())) {
  await expect(invoke(action, data)).resolves.toMatchObject({ error: expect.any(String) });
  noEffects(context);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z"));
});
afterEach(() => { vi.useRealTimers(); });

describe("C3 · ancla de alta y día Caracas", () => {
  it("A01/A05 captura antes del PRIMER await y no fecha desde el retorno del insert", async () => {
    const context = setup();
    const gate = deferred<typeof context.client>();
    io.client.mockReturnValueOnce(gate.promise);
    const pending = createExpenseAction({}, form());
    vi.setSystemTime(new Date("2026-10-21T04:00:00.000Z"));
    gate.resolve(context.client);
    await expect(pending).resolves.toMatchObject({ ok: true });
    const inserted = context.effects.find((event) => event.kind === "insert")!.value as { patch: Row };
    expect(inserted.patch).toMatchObject({ occurred_at: "2026-10-21T03:59:59.999Z", amount_usd: 30 });
    expect(inserted.patch).not.toHaveProperty("created_at");
    expect(inserted.patch).not.toHaveProperty("updated_at");
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20" }));
  });
  it("A02 cierre del día capturado bloquea aunque la primera espera cruce medianoche Caracas", async () => {
    const context = setup({ settings: [{ tenant_id: T, closing_date: "2026-10-20" }] });
    const gate = deferred<typeof context.client>();
    io.client.mockReturnValueOnce(gate.promise);
    const pending = createExpenseAction({}, form({}, photo()));
    vi.setSystemTime(new Date("2026-10-21T04:00:00.000Z"));
    gate.resolve(context.client);
    await expect(pending).resolves.toMatchObject({ error: expect.stringMatching(/cerrado/i) });
    noEffects(context);
  });
  it.each([
    ["2026-10-21T02:30:00.000Z", "2026-10-20"],
    ["2026-10-21T03:59:59.999Z", "2026-10-20"],
    ["2026-10-21T04:00:00.000Z", "2026-10-21"],
    ["2026-01-01T02:30:00.000Z", "2025-12-31"],
    ["2024-03-01T02:30:00.000Z", "2024-02-29"],
    ["2010-01-01T04:15:00.000Z", "2009-12-31"],
  ])("A03/A04 %s conserva instante y asienta %s", async (instant, day) => {
    vi.setSystemTime(new Date(instant));
    const context = setup();
    await expect(createExpenseAction({}, form())).resolves.toMatchObject({ ok: true });
    expect((context.effects.find((event) => event.kind === "insert")!.value as { patch: Row }).patch.occurred_at).toBe(instant);
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: day }));
  });
});

describe.each(["create", "edit"] as const)("C3 · autoridad y cierre estricto · %s", (action) => {
  it("B01 sin sesión no consulta tenant ni historia", async () => {
    const context = setup({ authenticated: false });
    await blocked(context, action);
    expect(context.client.rpc).not.toHaveBeenCalled();
    expect(context.reads).toEqual([]);
  });
  it.each([null, undefined, [], {}, 0, false, "", " ", "tenant", " " + T, T + " "].map((tenant) => ({ tenant })))(
    "B03 tenant malformado %j falla cerrado", async ({ tenant }) => {
      const context = setup({ tenant });
      await blocked(context, action);
      expect(context.reads).toEqual([]);
    },
  );
  it.each([{ tenantError: { message: "synthetic SQL secret must not escape" } }, { tenantThrows: true }])(
    "B03 error/excepción de RPC falla cerrado %j", async (options) => {
      const context = setup(options);
      const result = await invoke(action);
      expect(result.error).toEqual(expect.any(String));
      expect(result.error).not.toMatch(/synthetic|SQL|secret/i);
      noEffects(context);
    },
  );
  it("B02 usa RPC sin argumentos e ignora tenant/actor del formulario", async () => {
    const context = setup({ entries: [] });
    await expect(invoke(action, form({ tenant_id: OTHER, user_id: OTHER }))).resolves.toMatchObject({ ok: true });
    expect(context.client.rpc).toHaveBeenCalledWith("get_user_tenant_id");
    expect(context.reads.some((read) => read.table === "user_tenants")).toBe(false);
    const write = context.effects.find((event) => event.kind === (action === "create" ? "insert" : "update"))!.value as { patch: Row };
    if (action === "create") expect(write.patch).toMatchObject({ tenant_id: T, user_id: U });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ tenantId: T }));
  });
  it("B03 UUID canónico no v4 conserva autoridad válida", async () => {
    const tenant = "10000000-0000-1000-8000-000000000001";
    const context = setup({ tenant, settings: [], entries: [] });
    context.rows.expenses[0].tenant_id = tenant;
    await expect(invoke(action)).resolves.toMatchObject({ ok: true });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }));
  });
  it.each([[], [{ tenant_id: T, closing_date: null }]].map((settings) => ({ settings })))("B05 ausencia válida/null explícito abiertos %j", async ({ settings }) => {
    setup({ settings, entries: [] });
    await expect(invoke(action)).resolves.toMatchObject({ ok: true });
  });
  it("B05 consulta cierre por tenant con array y límite2", async () => {
    const context = setup();
    await expect(invoke(action)).resolves.toMatchObject({ ok: true });
    const read = context.reads.find((value) => value.table === "accounting_settings")!;
    expect(read).toMatchObject({ limit: 2, terminal: "array" });
    expect(read.filters).toContainEqual(["tenant_id", T]);
    expect(read.columns.split(",").map((value) => value.trim())).toEqual(["tenant_id", "closing_date"]);
  });
  it.each(["PGRST116", "PGRST205", "42P01", "08006"])("B06 error %s no significa abierto", async (code) => {
    const context = setup({ transport: { accounting_settings: { data: null, error: { code, message: "synthetic hidden SQL" } } } });
    await blocked(context, action);
  });
  it.each([null, undefined, {}, [null], [false], [0], [""], [[]],
    [{ tenant_id: OTHER, closing_date: null }],
    [{ tenant_id: T, closing_date: null }, { tenant_id: T, closing_date: null }],
  ].map((data) => ({ data })))("B07 settings malformado %j no significa abierto", async ({ data }) => {
    const context = setup({ transport: { accounting_settings: { data, error: null } } });
    await blocked(context, action);
  });
  it.each([undefined, "", " ", "2026-02-30", "2025-02-29", "2026-10-20T00:00:00Z"])(
    "B08 calendario inválido %j falla cerrado", async (closing_date) => {
      const context = setup({ transport: { accounting_settings: { data: [{ tenant_id: T, closing_date }], error: null } } });
      await blocked(context, action);
    },
  );
  it("B06 excepción de settings se vuelve rechazo recuperable sin efectos", async () => {
    const context = setup({ throws: "accounting_settings" });
    await blocked(context, action);
  });
});

describe("C3 · origen y asiento histórico antes de efectos", () => {
  it("C01 filtra y valida origen propio activo, selecciona identidad y detecta límite2", async () => {
    const context = setup();
    await expect(updateExpenseAction(G, {}, form())).resolves.toMatchObject({ ok: true });
    const read = context.reads.find((value) => value.table === "expenses")!;
    expect(read.filters).toEqual(expect.arrayContaining([
      ["id", G], ["tenant_id", T], ["user_id", U], ["deleted_at", null],
    ]));
    expect(read.limit).toBe(2);
    expect(read.columns.split(",").map((value) => value.trim())).toEqual(expect.arrayContaining(["id", "deleted_at", "occurred_at"]));
  });
  it.each([null, undefined, {}, [], [null], [false], [0], [""], [[]]].map((data) => ({ data })))(
    "C02 origen malformado %j bloquea antes de foto", async ({ data }) => {
      const context = setup({ transport: { expenses: { data, error: null } } });
      await blocked(context, "edit");
    },
  );
  it.each([
    { id: OTHER }, { tenant_id: OTHER }, { user_id: OTHER }, { deleted_at: "2026-01-01T00:00:00Z" },
    { occurred_at: "2026-10-20" }, { occurred_at: "2026-02-30T00:00:00Z" },
    { occurred_at: null }, { amount_usd: null }, { amount_usd: "" }, { amount_usd: false },
  ])("C02 respuesta incoherente de origen %j bloquea tras filtros", async (delta) => {
    const context = setup();
    const forged = { ...context.original, ...delta };
    const candidate = setup({ transport: { expenses: { data: [forged], error: null } } });
    await blocked(candidate, "edit");
  });
  it("C02 dos orígenes y error de lectura no autorizan", async () => {
    const fixture = setup();
    const context = setup({ origin: [fixture.original, { ...fixture.original }] });
    await blocked(context, "edit");
    const failed = setup({ transport: { expenses: { data: null, error: { code: "08006" } } } });
    await blocked(failed, "edit");
  });
  it.each(["25", "30"])("C03 origen Caracas cerrado bloquea cambio con importe %s", async (amount) => {
    const context = setup({ settings: [{ tenant_id: T, closing_date: "2026-10-20" }] });
    await blocked(context, "edit", form({ amount }, photo()));
  });
  it.each([{ amount: "30" }, { method: "transfer" }, { category: "combustible" }] as Record<string, string>[])(
    "C04 asiento cerrado bloquea antes de upload/update/void/post %j", async (values) => {
      const first = setup();
      const context = setup({
        settings: [{ tenant_id: T, closing_date: "2026-10-20" }],
        origin: [{ ...first.original, occurred_at: "2026-10-21T12:00:00Z" }],
        entries: [{ ...first.live, entry_date: "2026-10-20" }],
        account: "category" in values ? B : A,
      });
      await blocked(context, "edit", form({ amount: "25", ...values, remove_receipt: "true" }, photo()));
      expect(context.order.indexOf("account")).toBeGreaterThan(-1);
    },
  );
  it("C05 ambas fechas abiertas pero distintas no se re-fechan", async () => {
    const first = setup();
    const context = setup({
      settings: [{ tenant_id: T, closing_date: "2026-10-19" }],
      entries: [{ ...first.live, entry_date: "2026-10-21" }],
    });
    await blocked(context, "edit");
    expect(context.rows.journal_entries[0].entry_date).toBe("2026-10-21");
    expect(context.original.receipt_path).toBe(T + "/" + U + "/EXP-fixture.jpg");
  });
  it.each([[], null, undefined, {}, [null], [false], [0], [""], [[]]].map((data) => ({ data })))(
    "C06/C08 live-entry transporte %j distingue ausencia válida", async ({ data }) => {
      const context = setup({ transport: { journal_entries: { data, error: null } } });
      if (Array.isArray(data) && data.length === 0) {
        await expect(updateExpenseAction(G, {}, form())).resolves.toMatchObject({ ok: true });
        expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20" }));
      } else await blocked(context, "edit");
    },
  );
  it("C07 asiento coherente conserva fecha y filtros estrictos al repostear", async () => {
    const context = setup();
    await expect(updateExpenseAction(G, {}, form())).resolves.toMatchObject({ ok: true });
    const read = context.reads.find((value) => value.table === "journal_entries")!;
    expect(read?.limit).toBe(2);
    expect(read?.filters).toEqual(expect.arrayContaining([
      ["tenant_id", T], ["expense_id", G], ["status", "asentado"], ["deleted_at", null],
    ]));
    expect(read?.columns.split(",").map((value) => value.trim())).toEqual(expect.arrayContaining([
      "id", "tenant_id", "expense_id", "source", "entry_date", "status", "deleted_at",
    ]));
    const patch = (context.effects.find((event) => event.kind === "update")!.value as { patch: Row }).patch;
    expect(patch).not.toHaveProperty("occurred_at");
    expect(patch).not.toHaveProperty("created_at");
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20", amountUsd: 30 }));
  });
  it.each([
    { id: "" }, { tenant_id: OTHER }, { expense_id: OTHER }, { source: "manual" },
    { status: "borrador" }, { deleted_at: "2026-01-01T00:00:00Z" },
    { entry_date: undefined }, { entry_date: "2026-02-30" }, { entry_date: "2026-10-20T00:00:00Z" },
  ])("C09 asiento incoherente %j llega al guard tras filtros", async (delta) => {
    const first = setup();
    const context = setup({ transport: { journal_entries: { data: [{ ...first.live, ...delta }], error: null } } });
    await blocked(context, "edit");
  });
  it("C08 dos asientos y error/excepción no acreditan ausencia", async () => {
    const first = setup();
    const contexts = [
      setup({ entries: [first.live, { ...first.live, id: OTHER }] }),
      setup({ transport: { journal_entries: { data: [], error: { code: "08006" } } } }),
      setup({ throws: "journal_entries" }),
    ];
    for (const context of contexts) {
      io.client.mockResolvedValue(context.client);
      io.admin.current = context.client;
      await blocked(context, "edit");
    }
  });
  it("C10 descriptivo abierto no consulta asiento ni void/post", async () => {
    const context = setup({ throws: "journal_entries" });
    await expect(updateExpenseAction(G, {}, form({ amount: "25", note: "Descripción ficticia nueva" }))).resolves.toMatchObject({ ok: true });
    expect(context.reads.some((read) => read.table === "journal_entries")).toBe(false);
    expect(io.void).not.toHaveBeenCalled();
    expect(io.post).not.toHaveBeenCalled();
  });
  it("C11 categoría que resuelve misma cuenta no fuerza repost; cuenta null sigue permitida", async () => {
    setup({ account: A });
    await expect(updateExpenseAction(G, {}, form({ amount: "25", category: "hotel" }))).resolves.toMatchObject({ ok: true });
    expect(io.post).not.toHaveBeenCalled();
    const context = setup({ account: null, entries: [] });
    await expect(updateExpenseAction(G, {}, form())).resolves.toMatchObject({ ok: true });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ accountId: null }));
    expect(context.order.indexOf("account")).toBeLessThan(context.order.indexOf("expenses:update"));
  });
  it.each(["image/jpeg", "image/png"])("C13 negativa histórica conserva evidencia también con %s y remove", async (type) => {
    const first = setup();
    const context = setup({ entries: [{ ...first.live, entry_date: "2026-10-21" }] });
    const file = new File([new Uint8Array([4, 5, 6])], "ficticio", { type });
    await blocked(context, "edit", form({ remove_receipt: "true" }, file));
  });
  it.each([["1000", "40", false], ["1200", "40", true]] as const)(
    "C12 edición VES %s/%s mantiene comparación amount_usd, repost=%s", async (amount, fx_rate, repost) => {
      const context = setup();
      await expect(updateExpenseAction(G, {}, form({ amount, fx_rate, currency: "VES" }))).resolves.toMatchObject({ ok: true });
      expect(io.post).toHaveBeenCalledTimes(repost ? 1 : 0);
      expect(context.reads.some((value) => value.table === "journal_entries")).toBe(repost);
    },
  );
  it("C14 upload fallido posterior a guardas no alcanza UPDATE ni void/post", async () => {
    const context = setup({ uploadError: { message: "Fallo ficticio de Storage" } });
    await expect(updateExpenseAction(G, {}, form({}, photo()))).resolves.toMatchObject({ error: expect.stringMatching(/recibo/i) });
    expect(context.effects.map((value) => value.kind)).toEqual(["upload"]);
    expect(context.order.indexOf("journal_entries:read")).toBeLessThan(context.order.indexOf("upload"));
    expect(io.void).not.toHaveBeenCalled();
    expect(io.post).not.toHaveBeenCalled();
  });
  it("C14 UPDATE fallido posterior a upload no anuncia éxito ni borra evidencia vieja", async () => {
    const context = setup({ updateError: { message: "Fallo ficticio de UPDATE" } });
    await expect(updateExpenseAction(G, {}, form({}, photo()))).resolves.toMatchObject({ error: expect.stringMatching(/guardar/i) });
    expect(context.effects.map((value) => value.kind)).toEqual(["upload", "update"]);
    expect(io.void).not.toHaveBeenCalled();
    expect(io.post).not.toHaveBeenCalled();
    expect(io.revalidate).not.toHaveBeenCalled();
    // This documents the existing uncertain-write boundary; no atomicity claim.
  });
});

describe("C3 · conservación monetaria y de adjuntos", () => {
  it.each([["USD", "25", "1", 25], ["VES", "1000", "40", 25], ["CNY", "175", "7", 25]])(
    "A06/C12 %s conserva monto, tasa y conversión real", async (currency, amount, fx_rate, amountUsd) => {
      setup();
      await expect(createExpenseAction({}, form({ currency, amount, fx_rate }))).resolves.toMatchObject({ ok: true });
      expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ amountUsd }));
    },
  );
  it.each(["0", "-1", "invalid"])("A06 monto inválido %s conserva fieldErrors sin efectos", async (amount) => {
    const context = setup();
    await expect(createExpenseAction({}, form({ amount }))).resolves.toMatchObject({ fieldErrors: { amount: expect.any(String) } });
    noEffects(context);
  });
  it.each([
    new File(["ficticio"], "ficticio.txt", { type: "text/plain" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "ficticio.png", { type: "image/png" }),
  ])("A06 MIME/límite adjunto conserva error y cero correlativo", async (file) => {
    const context = setup();
    await expect(createExpenseAction({}, form({}, file))).resolves.toMatchObject({ fieldErrors: { receipt: expect.any(String) } });
    noEffects(context);
  });
});
