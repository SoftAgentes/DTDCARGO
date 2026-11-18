// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeExpenseKpis, listMonthExpensesForExport, listTenantExpenses, sumMyExpensesTodayUsd } from "../expense-queries";

type Row = { id: string; occurred_at: string; amount_usd: number; scope: string; deleted_at: string | null };
/** Ejecuta filtros/paginación sobre filas sintéticas; el agregador real no se simula. */
function db(rows: Row[]) {
  return { from: () => {
    const predicates: ((r: Row) => boolean)[] = [];
    let lower = 0, upper = Infinity;
    const q = {
      select: () => q, order: () => q,
      is: (key: keyof Row, value: unknown) => { predicates.push(r => r[key] === value); return q; },
      eq: (key: keyof Row, value: unknown) => { predicates.push(r => r[key] === value); return q; },
      gte: (key: keyof Row, value: string) => { predicates.push(r => String(r[key]) >= value); return q; },
      lt: (key: keyof Row, value: string) => { predicates.push(r => String(r[key]) < value); return q; },
      range: (from: number, to: number) => { lower = from; upper = to + 1; return q; },
      limit: (n: number) => { upper = n; return q; },
      then: (resolve: (result: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows.filter(r => predicates.every(p => p(r))).slice(lower, upper), error: null }).then(resolve),
    };
    return q;
  } } as unknown as SupabaseClient;
}
const row = (id: string, occurred_at: string, amount_usd: number, scope = "shipment"): Row => ({ id, occurred_at, amount_usd, scope, deleted_at: null });
afterEach(() => vi.useRealTimers());

describe("C1 · gastos en intervalos Caracas", () => {
  it("hoy incluye inicio y excluye fin/futuro sin depender del TZ del proceso", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T02:30:00Z"));
    const client = db([
      row("prev", "2026-10-20T03:59:59.999Z", 1000),
      row("start", "2026-10-20T04:00:00.000Z", 10.25),
      row("end-1", "2026-10-21T03:59:59.999Z", 20.25),
      row("end", "2026-10-21T04:00:00.000Z", 2000),
      row("future", "2026-10-25T12:00:00.000Z", 4000),
    ]);
    // Conserva el redondeo histórico del KPI, no redefine importes.
    expect(await sumMyExpensesTodayUsd(client)).toEqual({ total: 31, count: 2 });
  });
  it("mes actual y mes explícito usan ambos límites para lista, export y KPI", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T02:30:00Z"));
    const client = db([
      row("prev", "2026-10-01T03:59:59.999Z", 1000),
      row("start", "2026-10-01T04:00:00.000Z", 10.25),
      row("end-1", "2026-11-01T03:59:59.999Z", 20.25),
      row("end", "2026-11-01T04:00:00.000Z", 2000),
    ]);
    expect((await listTenantExpenses(client, { scope: "shipment" })).map(r => r.id)).toEqual(["start", "end-1"]);
    expect((await listMonthExpensesForExport(client, "2026-10")).map(r => r.id)).toEqual(["start", "end-1"]);
    expect(await computeExpenseKpis(client, "2026-10")).toEqual({ shipmentTotalUsd: 31, externalTotalUsd: 0, count: 2 });
  });
  it.each(["2026-13", "2026-00", "2026-2", "", "2026-02-30"])("mes inválido no se normaliza: %j", async month => {
    await expect(listMonthExpensesForExport(db([]), month)).rejects.toThrow();
  });
});
