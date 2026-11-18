// @vitest-environment node
/** SDD-0573 UI/B1: acciones y moduleEditGate reales; transporte sintético, no prueba SQL/RLS/D2. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";

const state = vi.hoisted(() => ({
  client: null as unknown as SupabaseClient,
  userId: "u1" as string | null,
  overrides: {} as Record<string, { view: boolean; edit: boolean }>,
  tables: {} as Record<string, Fila[]>,
  reads: [] as string[],
  updates: [] as { table: string; values: Fila; options: unknown; filters: { column: string; value: unknown }[]; matched: number }[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcReply: undefined as { data: unknown; error: unknown } | undefined,
  writeReply: undefined as { data?: unknown; error?: unknown; count?: unknown } | undefined,
  writeReject: false,
  rpcReject: false,
  beforeMutation: null as (() => void) | null,
  revalidate: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => state.client }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidate }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => state.overrides }));
// No se mockea rbac-guard: sesión/membresía/rol/disabled/scope/matriz son reales.
import { postEntry, softDeleteEntry, voidEntry } from "../actions";

const raw = (id: string, patch: Fila = {}): Fila => ({
  id, tenant_id: "t1", entry_code: "A-2026-0001", source: "manual", status: "borrador", entry_date: "2026-10-20",
  deleted_at: null, invoice_id: null, reverses_entry_id: null, ...patch,
});
const EXCEPTION = { superclave: "CLAVE_FICTICIA_CENTINELA", motivo: "Corrección de prueba" };
const OPS = [
  { name: "post", status: "borrador", invoke: (id: string) => postEntry(id, EXCEPTION) },
  { name: "delete", status: "borrador", invoke: (id: string) => softDeleteEntry(id, EXCEPTION) },
  { name: "void", status: "asentado", invoke: (id: string) => voidEntry(id, EXCEPTION.motivo, EXCEPTION.superclave) },
] as const;

function makeClient() {
  const base = dobleListados(state.tables, { proyectar: true, serverCap: 2 });
  const client = {
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null }, error: null }) },
    from(table: string) {
      state.reads.push(table);
      return {
        ...base.client.from(table),
        update(values: Fila, options?: unknown) {
          const filters: { column: string; value: unknown }[] = [];
          const query = {
            eq(column: string, value: unknown) { filters.push({ column, value }); return query; },
            is(column: string, value: unknown) { filters.push({ column, value }); return query; },
            then(resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) {
              return Promise.resolve().then(() => {
                state.beforeMutation?.();
                const matched = (state.tables[table] ?? []).filter((r) => filters.every((f) => r[f.column] === f.value));
                state.updates.push({ table, values, options, filters: [...filters], matched: matched.length });
                if (state.writeReject) throw new Error("SQL_PRIVADO_CLAVE_FICTICIA_CENTINELA");
                const response = state.writeReply ?? { data: null, error: null, count: matched.length };
                // Un acuse ilegible no prueba rollback: puede haber aplicado el cambio.
                if (response.error === null) for (const row of matched) Object.assign(row, values);
                return response;
              }).then(resolve, reject);
            },
            // Sin .select(): la ruta positiva exige respuesta mínima, no releer la fila.
          };
          return query;
        },
      };
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ fn, args });
      if (fn === "estado_cierre_contable") return { data: { closing_date: "2026-10-31", closing_mode: "superclave", superclave_definida: true, bloqueada_hasta: null }, error: null };
      if (state.rpcReject) throw new Error("SQL_PRIVADO_CLAVE_FICTICIA_CENTINELA");
      return state.rpcReply ?? { data: fn === "void_journal_entry_with_audit_reason" ? true : { ok: true }, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, filters: base.filtros };
}
let filters: ReturnType<typeof makeClient>["filters"];
beforeEach(() => {
  state.userId = "u1";
  state.overrides = {};
  state.reads = []; state.updates = []; state.rpcCalls = []; state.revalidate.mockReset();
  state.rpcReply = undefined; state.writeReply = undefined; state.beforeMutation = null;
  state.writeReject = false; state.rpcReject = false;
  state.tables = {
    user_tenants: [{ tenant_id: "t1", user_id: "u1", role: "admin", disabled_at: null, warehouse_scope: "all" }],
    journal_entries: [raw("m")],
    journal_lines: [{ id: "l1", entry_id: "m", debit: 10, credit: 0 }, { id: "l2", entry_id: "m", debit: 0, credit: 10 }],
    accounting_settings: [{ tenant_id: "t1", closing_date: null }],
  };
  const d = makeClient(); state.client = d.client; filters = d.filters;
});
const operational = () => state.rpcCalls.filter((r) => r.fn !== "estado_cierre_contable");
function expectNoEffects(result: { ok?: boolean; error?: string }) {
  expect(result.ok).not.toBe(true); expect(result.error?.trim()).toBeTruthy();
  expect(state.updates).toEqual([]); expect(operational()).toEqual([]); expect(state.revalidate).not.toHaveBeenCalled();
  expect(state.reads).not.toContain("journal_lines"); expect(state.reads).not.toContain("accounting_settings");
}

describe.each(OPS)("SDD-0573 · $name con protección fresca", (op) => {
  it.each([
    ["venta automática", { source: "invoice", invoice_id: "f1" }],
    ["reverso automático", { source: "invoice_reversal", invoice_id: "f1", reverses_entry_id: "otro" }],
    ["manual con backlink", { reverses_entry_id: "otro" }],
    ["source ausente", { source: undefined }],
    ["backlink ausente", { reverses_entry_id: undefined }],
    ["tenant ajeno", { tenant_id: "t2" }],
    ["borrado", { deleted_at: "2026-10-21" }],
    ["fecha ilegible", { entry_date: undefined }],
  ] as const)("%s bloquea antes de líneas/cierre/efectos aun con superclave", async (_name, patch) => {
    state.tables.journal_entries = [raw("m", { status: op.status, ...patch })];
    state.tables.accounting_settings[0].closing_date = "2026-10-31";
    expectNoEffects(await op.invoke("m"));
  });

  it("inverso borrado/anulado protege al manual; no hay filtro que lo oculte", async () => {
    state.tables.journal_entries = [raw("m", { status: op.status }), raw("r", { source: "manual", reverses_entry_id: "m", status: "anulado", deleted_at: "2026-10-21" })];
    expectNoEffects(await op.invoke("m"));
    expect(filters.some((f) => f.col === "reverses_entry_id" && f.op === "in")).toBe(true);
  });

  it("target inexistente no alcanza efectos ni la excepción", async () => {
    expectNoEffects(await op.invoke("inexistente"));
  });

  it("preestado inelegible se rechaza antes de consultar el cierre", async () => {
    state.tables.journal_entries[0].status = op.status === "borrador" ? "asentado" : "borrador";
    expectNoEffects(await op.invoke("m"));
  });

  it.each(["sin sesión", "disabled", "otro usuario", "sin tenant", "rol operativo"])("gate real %s rechaza sin leer el target", async (kind) => {
    state.tables.journal_entries[0].status = op.status;
    if (kind === "sin sesión") state.userId = null;
    if (kind === "disabled") state.tables.user_tenants[0].disabled_at = "2026-10-21";
    if (kind === "otro usuario") state.tables.user_tenants[0].user_id = "u2";
    if (kind === "sin tenant") state.tables.user_tenants[0].tenant_id = null;
    if (kind === "rol operativo") { state.tables.user_tenants[0].role = "operations"; state.overrides = { "operations:accounting": { view: true, edit: true } }; }
    expectNoEffects(await op.invoke("m"));
    expect(state.reads).not.toContain("journal_entries");
  });

  it("la membresía cambia entre invocaciones y no se reutiliza la autorización previa", async () => {
    state.tables.journal_entries[0].status = op.status;
    expect((await op.invoke("m")).ok).toBe(true);
    state.reads = []; state.updates = []; state.rpcCalls = []; state.revalidate.mockClear();
    state.tables.user_tenants[0].disabled_at = "2026-10-21";
    expectNoEffects(await op.invoke("m"));
  });

  it("manual accounting conserva su scope no geográfico y obtiene acuse positivo", async () => {
    state.tables.user_tenants[0].role = "accounting";
    state.tables.user_tenants[0].warehouse_scope = "cn"; // accounting no es módulo geográfico en la matriz real.
    state.tables.journal_entries[0].status = op.status;
    expect(await op.invoke("m")).toEqual({ ok: true });
    expect(state.revalidate).toHaveBeenCalledExactlyOnceWith("/studio/contabilidad");
    expect(filters).toContainEqual({ table: "user_tenants", op: "eq", col: "user_id", val: "u1" });
    expect(filters).toContainEqual({ table: "user_tenants", op: "is", col: "disabled_at", val: null });
    if (op.name !== "void") {
      expect(state.updates).toHaveLength(1);
      expect(state.updates[0].options).toEqual({ count: "exact" });
      expect(state.updates[0].filters).toEqual([
        { column: "id", value: "m" }, { column: "tenant_id", value: "t1" },
        { column: "status", value: "borrador" }, { column: "deleted_at", value: null },
      ]);
      if (op.name === "post") expect(state.tables.journal_entries[0]).toMatchObject({ status: "asentado", posted_at: expect.any(String) });
      else expect(state.tables.journal_entries[0].deleted_at).toEqual(expect.any(String));
    } else expect(operational()).toEqual([{ fn: "void_journal_entry_with_audit_reason", args: { p_id: "m", p_reason: EXCEPTION.motivo } }]);
  });

  it.each([true, false, { ok: "true" }, [], "ok", 1, null, undefined])("0493 no acepta acuse truthy/ilegible %j", async (data) => {
    state.tables.journal_entries[0].status = op.status;
    state.tables.accounting_settings[0].closing_date = "2026-10-31";
    state.rpcReply = { data, error: null };
    const result = await op.invoke("m");
    expect(result.ok).not.toBe(true); expect(result.error?.trim()).toBeTruthy();
    expect(state.revalidate).not.toHaveBeenCalled(); expect(state.updates).toEqual([]);
    expect(operational()).toHaveLength(1);
    expect(operational()[0].args).toMatchObject({ p_entry_id: "m", p_clave: EXCEPTION.superclave, p_motivo: EXCEPTION.motivo });
  });

  it("0493 JSONoktrue confirma sólo la excepción manual legítima", async () => {
    state.tables.journal_entries[0].status = op.status;
    state.tables.accounting_settings[0].closing_date = "2026-10-31";
    state.rpcReply = { data: { ok: true }, error: null };
    expect(await op.invoke("m")).toEqual({ ok: true });
    expect(state.revalidate).toHaveBeenCalledTimes(1); expect(operational()).toHaveLength(1);
  });

  it("respuesta RPC perdida no reintenta ni filtra detalles privados", async () => {
    state.tables.journal_entries[0].status = op.status;
    state.tables.accounting_settings[0].closing_date = "2026-10-31";
    state.rpcReject = true;
    const result = await op.invoke("m");
    expect(result.ok).not.toBe(true); expect(result.error?.trim()).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("CENTINELA");
    expect(operational()).toHaveLength(1); expect(state.rpcCalls).toHaveLength(2); expect(state.revalidate).not.toHaveBeenCalled();
  });
});

describe.each(OPS.slice(0, 2))("SDD-0573 · $name acuse minimal", (op) => {
  it.each([
    ["cero", { data: null, error: null, count: 0 }], ["null", { data: null, error: null, count: null }],
    ["ausente", { data: null, error: null }], ["string", { data: null, error: null, count: "1" }],
    ["objeto", { data: null, error: null, count: {} }], ["dos", { data: null, error: null, count: 2 }],
    ["NaN", { data: null, error: null, count: NaN }], ["error", { data: null, error: { message: "CENTINELA" }, count: 1 }],
    ["error ausente", { data: null, count: 1 }],
  ] as const)("count %s no confirma, aunque el preflight fue favorable", async (_label, response) => {
    state.writeReply = response;
    const result = await op.invoke("m");
    expect(result.ok).not.toBe(true); expect(result.error?.trim()).toBeTruthy();
    expect(state.updates).toHaveLength(1); expect(state.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("CENTINELA");
  });

  it.each([
    ["otro ID", { id: "otro" }], ["otro tenant", { tenant_id: "t2" }],
    ["estado cambiado", { status: "asentado" }], ["ya borrado", { deleted_at: "2026-10-21" }],
  ] as const)("%s entre lectura y PATCH produce count0 y ningún éxito", async (_label, change) => {
    state.beforeMutation = () => Object.assign(state.tables.journal_entries[0], change);
    expect((await op.invoke("m")).ok).not.toBe(true);
    expect(state.updates[0].matched).toBe(0); expect(state.revalidate).not.toHaveBeenCalled();
    expect(state.updates[0].values).not.toHaveProperty("tenant_id");
  });

  it("PATCH rechazado no se reenvía ni afirma rollback", async () => {
    state.writeReject = true;
    const result = await op.invoke("m");
    expect(result).toEqual({ error: "No se pudo confirmar el cambio. Recarga el diario antes de volver a intentarlo." });
    expect(state.updates).toHaveLength(1); expect(state.revalidate).not.toHaveBeenCalled();
  });
});

describe("SDD-0573 · ABI boolean de anulación", () => {
  it.each([false, null, undefined, 1, "true", { ok: true }, []])("data %j no sustituye booleantrue", async (data) => {
    state.tables.journal_entries[0].status = "asentado"; state.rpcReply = { data, error: null };
    expect((await voidEntry("m", EXCEPTION.motivo)).ok).not.toBe(true);
    expect(operational()).toHaveLength(1); expect(state.revalidate).not.toHaveBeenCalled();
  });
  it("booleantrue junto con error no es éxito", async () => {
    state.tables.journal_entries[0].status = "asentado"; state.rpcReply = { data: true, error: { message: "CENTINELA" } };
    expect((await voidEntry("m", EXCEPTION.motivo)).ok).not.toBe(true);
    expect(state.revalidate).not.toHaveBeenCalled();
  });
  it("pérdida del boolean tras RPC abierta no reintenta ni revela la excepción", async () => {
    state.tables.journal_entries[0].status = "asentado"; state.rpcReject = true;
    expect(await voidEntry("m", EXCEPTION.motivo)).toEqual({ error: "No se pudo confirmar el cambio. Recarga el diario antes de volver a intentarlo." });
    expect(operational()).toHaveLength(1); expect(state.revalidate).not.toHaveBeenCalled();
  });
});

describe("SDD-0573 · balance manual conservado", () => {
  it.each(["una sola línea", "desbalance"])("%s no alcanza PATCH", async (kind) => {
    if (kind === "una sola línea") state.tables.journal_lines.pop();
    else state.tables.journal_lines[1].credit = 9;
    const result = await postEntry("m");
    expect(result.ok).not.toBe(true);
    expect(result.error).toContain(kind === "una sola línea" ? "al menos 2 líneas" : "no balancea");
    expect(state.updates).toEqual([]); expect(state.revalidate).not.toHaveBeenCalled();
  });
});
