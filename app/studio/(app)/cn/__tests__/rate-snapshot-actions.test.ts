// @vitest-environment node
/**
 * SDD-0571 · Acciones de la tarifa congelada: eligen la fuente, llaman a la RPC
 * con los parámetros correctos y muestran SOLO los errores propios de la 0496
 * (`hint = 'dtd-tarifa'`, ERR-01). El doble de Supabase filtra de verdad
 * (`eq`, `in`, `is`) y devuelve copias, como PostgREST; la RPC es un espía con
 * respuestas por recepción.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const RID = (n: number) => `0f0e0d0c-0b0a-4900-8000-${String(n).padStart(12, "0")}`;
const RATE = "0f0e0d0c-0b0a-4900-8000-0000000000aa";

const estado = vi.hoisted(() => ({
  role: "warehouse" as string | null,
  editDenial: null as string | null,
  viewDenial: null as string | null,
  tablas: {} as Record<string, Record<string, unknown>[]>,
  rpcCalls: [] as Record<string, unknown>[],
  rpcRespuesta: ((): { data: unknown; error: unknown } => ({ data: [], error: null })) as (args: Record<string, unknown>) => { data: unknown; error: unknown },
  propuestas: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: vi.fn(async () => estado.editDenial),
  moduleViewDenial: vi.fn(async () => estado.viewDenial),
  getStudioAccess: vi.fn(async () => ({ role: estado.role })),
}));
vi.mock("@/lib/studio/rate-snapshots/propuesta", () => ({
  proponerTarifa: vi.fn(async (_s: unknown, receipt: { client_markbox: string }) =>
    estado.propuestas[receipt.client_markbox] ?? { kind: "ninguna", motivo: "sin_tarifa" }),
  listAcceptedQuotesForMarkbox: vi.fn(async () => []),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn !== "congelar_tarifa_recepcion") throw new Error("rpc inesperada " + fn);
      estado.rpcCalls.push(args);
      return estado.rpcRespuesta(args);
    }),
    from: (tabla: string) => {
      const filtros: ((r: Record<string, unknown>) => boolean)[] = [];
      const c: Record<string, unknown> = {};
      const filas = () => (estado.tablas[tabla] ?? []).filter((r) => filtros.every((f) => f(r))).map((r) => ({ ...r }));
      c.select = () => c;
      c.eq = (col: string, v: unknown) => (filtros.push((r) => r[col] === v), c);
      c.in = (col: string, vs: unknown[]) => (filtros.push((r) => vs.includes(r[col])), c);
      c.is = (col: string, v: null) => (filtros.push((r) => (r[col] ?? null) === v), c);
      c.order = () => c;
      c.maybeSingle = async () => ({ data: filas()[0] ?? null, error: null });
      c.then = (ok: (v: unknown) => unknown) => ok({ data: filas(), error: null });
      return c;
    },
  })),
}));

import { revalidatePath } from "next/cache";
import {
  freezePendingRatesAction,
  freezeRateAction,
  loadRateDrawerAction,
  previewRateAction,
} from "../rate-snapshot-actions";

const fila = (receiptId: string, extra: Record<string, unknown> = {}) => ({
  id: "snap-" + receiptId.slice(-2), receipt_id: receiptId, source: "casa", rate_origin: null,
  per_cbm: "850.00", min_charge: "50.00", cbm: "2.000", weight_kg: null, amount_to_invoice: "1700.00",
  excess_weight_kg: "0.00", included_kg_per_cbm: 500, superseded_at: null, frozen_at: "2026-10-20T15:00:00Z", ...extra,
});
const recepcion = (n: number, markbox: string) => ({
  id: RID(n), receipt_code: `WR-2026-${String(n).padStart(4, "0")}`, client_markbox: markbox,
  destination_city: "Valencia", sales_order_id: null, total_cbm: 2, is_orphan: false, deleted_at: null,
});

beforeEach(() => {
  estado.role = "warehouse";
  estado.editDenial = null;
  estado.viewDenial = null;
  estado.tablas = {};
  estado.rpcCalls = [];
  estado.rpcRespuesta = (args) => ({ data: [fila(String(args.p_receipt_id))], error: null });
  estado.propuestas = {};
  vi.mocked(revalidatePath).mockClear();
});

describe("freezeRateAction", () => {
  it("sin permiso de edición del módulo no llama a la RPC", async () => {
    estado.editDenial = "No tienes permiso para editar esto.";
    const r = await freezeRateAction({ receiptId: RID(1), source: "tarifario", rateId: RATE });
    expect(r).toEqual({ ok: false, error: "No tienes permiso para editar esto." });
    expect(estado.rpcCalls).toHaveLength(0);
  });

  it("datos inválidos vuelven al campo sin llamar a la RPC", async () => {
    const r = await freezeRateAction({ receiptId: RID(1), source: "manual", perCbm: "800" });
    expect(r).toEqual({ ok: false, fieldErrors: { reason: "warehouse_cn.rate.err.reason_required" } });
    expect(estado.rpcCalls).toHaveLength(0);
  });

  it("congela: manda la fila (no números) y refresca el Almacén", async () => {
    const r = await freezeRateAction({ receiptId: RID(1), source: "tarifario", rateId: RATE, perCbm: "1" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.snapshot.amount_to_invoice).toBe(1700);
    expect(estado.rpcCalls).toEqual([expect.objectContaining({
      p_receipt_id: RID(1), p_source: "tarifario", p_rate_id: RATE, p_per_cbm: null, p_dry_run: false,
    })]);
    expect(revalidatePath).toHaveBeenCalledWith("/studio/cn");
  });

  it("un error propio de la 0496 se traduce por su código", async () => {
    estado.rpcRespuesta = () => ({ data: null, error: { code: "23505", message: "TARIFA_YA_CONGELADA: ya tiene", hint: "dtd-tarifa" } });
    const r = await freezeRateAction({ receiptId: RID(1), source: "tarifario", rateId: RATE });
    expect(r).toEqual({ ok: false, errorKey: "warehouse_cn.rate.err.already_frozen" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un error ajeno de la base no se muestra tal cual (ERR-01)", async () => {
    estado.rpcRespuesta = () => ({ data: null, error: { code: "XX000", message: "detalle interno de la base", hint: null } });
    const r = await freezeRateAction({ receiptId: RID(1), source: "tarifario", rateId: RATE });
    expect(r).toEqual({ ok: false, errorKey: "warehouse_cn.rate.err.generic" });
  });

  it("sin la 0496 dice «no disponible»", async () => {
    estado.rpcRespuesta = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    const r = await freezeRateAction({ receiptId: RID(1), source: "tarifario", rateId: RATE });
    expect(r).toEqual({ ok: false, errorKey: "warehouse_cn.rate.unavailable" });
  });
});

describe("previewRateAction", () => {
  it("es una vista previa (p_dry_run) y no exige motivo", async () => {
    const r = await previewRateAction({ receiptId: RID(1), source: "manual", perCbm: "900" });
    expect(r.ok).toBe(true);
    expect(estado.rpcCalls).toEqual([expect.objectContaining({ p_source: "manual", p_per_cbm: 900, p_dry_run: true, p_reason: null })]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("freezePendingRatesAction", () => {
  beforeEach(() => {
    estado.tablas.warehouse_receipts_cn = [recepcion(1, "DTD-0001"), recepcion(2, "DTD-0002"), recepcion(3, "DTD-0003")];
    estado.tablas.shipment_rate_snapshots = [
      fila(RID(1)),
      fila(RID(2), { superseded_at: "2026-10-19T00:00:00Z" }), // reemplazada: no cuenta como viva
    ];
    estado.propuestas = {
      "DTD-0002": { kind: "tarifario", rateId: RATE, origen: "casa", bookName: null, service: "puerta_a_puerta_DDP" },
    };
  });

  it("congela solo las pendientes con propuesta y nombra las demás", async () => {
    const r = await freezePendingRatesAction([RID(1), RID(2), RID(3)]);
    expect(r).toEqual({
      ok: true,
      frozen: 1,
      alreadyFrozen: 1,
      skipped: [{ code: "WR-2026-0003", reasonKey: "warehouse_cn.rate.none.sin_tarifa" }],
    });
    expect(estado.rpcCalls).toEqual([expect.objectContaining({
      p_receipt_id: RID(2), p_source: "tarifario", p_rate_id: RATE, p_included_kg_per_cbm: 500, p_reason: null, p_dry_run: false,
    })]);
    expect(revalidatePath).toHaveBeenCalledWith("/studio/cn");
  });

  it("sin permiso en la base, corta en la primera", async () => {
    estado.propuestas["DTD-0003"] = { kind: "estimado", quoteId: RATE, quoteCode: "EST-1", service: "puerta_a_puerta_DDP" };
    estado.rpcRespuesta = () => ({ data: null, error: { code: "42501", message: "TARIFA_SIN_PERMISO: no", hint: "dtd-tarifa" } });
    const r = await freezePendingRatesAction([RID(2), RID(3)]);
    expect(r).toEqual({ ok: false, errorKey: "warehouse_cn.rate.err.forbidden" });
    expect(estado.rpcCalls).toHaveLength(1);
  });

  it("más de 100 no se aceptan", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => RID(1000 + i));
    expect(await freezePendingRatesAction(ids)).toEqual({ ok: false, errorKey: "warehouse_cn.rate.err.too_many" });
  });
});

describe("loadRateDrawerAction", () => {
  beforeEach(() => {
    estado.tablas.warehouse_receipts_cn = [recepcion(2, "DTD-0002")];
    estado.tablas.shipment_rate_snapshots = [];
    estado.propuestas = {
      "DTD-0002": { kind: "tarifario", rateId: RATE, origen: "casa", bookName: null, service: "puerta_a_puerta_DDP" },
    };
  });

  it("trae la propuesta con su vista previa; warehouse congela pero no eleva", async () => {
    const r = await loadRateDrawerAction(RID(2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.live).toBeNull();
    expect(r.preview?.per_cbm).toBe(850);
    expect(estado.rpcCalls).toEqual([expect.objectContaining({ p_rate_id: RATE, p_dry_run: true })]);
    expect(r.canFreeze).toBe(true);
    expect(r.canElevate).toBe(false);
  });

  it("support ve pero no congela; accounting eleva", async () => {
    estado.role = "support";
    const s = await loadRateDrawerAction(RID(2));
    expect(s.ok && s.canFreeze).toBe(false);
    estado.role = "accounting";
    const a = await loadRateDrawerAction(RID(2));
    expect(a.ok && a.canElevate).toBe(true);
  });

  it("sin permiso de ver el módulo, nada", async () => {
    estado.viewDenial = "No tienes permiso para ver esto.";
    expect(await loadRateDrawerAction(RID(2))).toEqual({ ok: false, error: "No tienes permiso para ver esto." });
  });
});
