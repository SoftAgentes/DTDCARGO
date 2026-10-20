/**
 * SDD-0571 · La propuesta automática (estimado aceptado → lista o casa) y la
 * comparación del Shipping Mark como la RPC: `upper(btrim())` (revisión de
 * seguridad, punto 8). El doble filtra de verdad: `eq`, `is`, `ilike` (sin
 * mayúsculas, con `%` y escapes), orden y páginas; devuelve copias.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const resolver = vi.hoisted(() => ({ ultimo: null as unknown, respuesta: null as unknown }));
vi.mock("../../price-books/price-book-queries", () => ({
  resolveRateForClient: vi.fn(async (_s: unknown, params: unknown) => {
    resolver.ultimo = params;
    return resolver.respuesta;
  }),
}));

import { listAcceptedQuotesForMarkbox, proponerTarifa } from "../propuesta";

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};

/** ILIKE de Postgres: sin mayúsculas, `%` y `_` comodines, `\` escapa. */
function ilike(valor: unknown, patron: string): boolean {
  let re = "";
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === "\\") re += patron[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is").test(String(valor ?? ""));
}

function doble(): SupabaseClient {
  return {
    from: (tabla: string) => {
      const filtros: ((r: Fila) => boolean)[] = [];
      let tope = Infinity;
      let desde = 0;
      const orden: { col: string; ascending: boolean; nullsFirst: boolean }[] = [];
      const filas = () => (tablas[tabla] ?? [])
        .filter((r) => filtros.every((f) => f(r)))
        .sort((a, b) => {
          for (const o of orden) {
            const av = a[o.col], bv = b[o.col];
            if (av == null && bv == null) continue;
            if (av == null) return o.nullsFirst ? -1 : 1;
            if (bv == null) return o.nullsFirst ? 1 : -1;
            const comparacion = String(av).localeCompare(String(bv));
            if (comparacion) return o.ascending ? comparacion : -comparacion;
          }
          return 0;
        })
        .slice(desde, desde + tope)
        .map((r) => ({ ...r }));
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (col: string, v: unknown) => (filtros.push((r) => r[col] === v), c);
      c.is = (col: string, v: null) => (filtros.push((r) => (r[col] ?? null) === v), c);
      c.not = (col: string, op: string, v: null) => {
        if (op !== "is" || v !== null) throw new Error("not() no soportado");
        filtros.push((r) => r[col] != null);
        return c;
      };
      c.ilike = (col: string, p: string) => (filtros.push((r) => ilike(r[col], p)), c);
      c.order = (col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => (
        orden.push({ col, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst ?? false }), c
      );
      c.limit = (n: number) => ((tope = n), c);
      c.range = (inicio: number, fin: number) => ((desde = inicio), (tope = fin - inicio + 1), c);
      c.maybeSingle = async () => ({ data: filas()[0] ?? null, error: null });
      c.then = (ok: (v: unknown) => unknown) => ok({ data: filas(), error: null });
      return c;
    },
  } as unknown as SupabaseClient;
}

const recepcion = (markbox: string, extra: Partial<Parameters<typeof proponerTarifa>[1]> = {}) => ({
  client_markbox: markbox, destination_city: "Valencia", sales_order_id: null, total_cbm: 1, is_orphan: false, ...extra,
});

beforeEach(() => {
  tablas = {
    clients: [
      { id: "c1", markbox: " dtd-0001 ", deleted_at: null },
      { id: "c12", markbox: "DTD-00012", deleted_at: null },
      { id: "c-borrado", markbox: "DTD-0003", deleted_at: "2026-10-01" },
    ],
    sales_orders: [{ id: "ov1", quote_id: "q1", deleted_at: null }],
    quotes: [
      { id: "q1", quote_code: "EST-1", client_markbox: "DTD-0001 ", service: "puerta_a_puerta_DDP", rate_per_cbm: "820", status: "accepted", deleted_at: null },
      { id: "q2", quote_code: "EST-2", client_markbox: "dtd-00012", service: "puerta_a_puerta_DDP", rate_per_cbm: 700, status: "accepted", deleted_at: null },
      { id: "q3", quote_code: "EST-3", client_markbox: "DTD-0001", service: "puerta_a_puerta_DDP", rate_per_cbm: 600, status: "draft", deleted_at: null },
    ],
  };
  resolver.ultimo = null;
  resolver.respuesta = { rate: { per_cbm: 850 }, rateId: "r-casa", origen: "casa", bookName: "Casa" };
});

describe("proponerTarifa", () => {
  it("encuentra al cliente por el Shipping Mark sin mayúsculas ni espacios, y no confunde DTD-0001 con DTD-00012", async () => {
    const p = await proponerTarifa(doble(), recepcion("DTD-0001"), "puerta_a_puerta_DDP");
    expect(p).toEqual({ kind: "tarifario", rateId: "r-casa", origen: "casa", bookName: "Casa", service: "puerta_a_puerta_DDP" });
    expect(resolver.ultimo).toEqual({ service: "puerta_a_puerta_DDP", destination: "Valencia", clientId: "c1" });
  });

  it("un cliente borrado o un Shipping Mark que no existe: sin cliente", async () => {
    expect(await proponerTarifa(doble(), recepcion("DTD-0003"), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cliente" });
    expect(await proponerTarifa(doble(), recepcion("DTD-9999"), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cliente" });
  });

  it("dos fichas con el mismo Shipping Mark normalizado: sin cliente (la RPC exige una)", async () => {
    tablas.clients.push({ id: "c1-dup", markbox: "DTD-0001", deleted_at: null });
    expect(await proponerTarifa(doble(), recepcion("DTD-0001"), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cliente" });
  });

  it("encuentra el cliente exacto después de 50 candidatos parciales", async () => {
    tablas.clients = Array.from({ length: 50 }, (_, i) => ({
      id: `a-${String(i).padStart(3, "0")}`, markbox: `DTD-0001-${i}`, deleted_at: null,
    }));
    tablas.clients.push({ id: "z-exacto", markbox: " dtd-0001 ", deleted_at: null });
    expect((await proponerTarifa(doble(), recepcion("DTD-0001"), "puerta_a_puerta_DDP")).kind).toBe("tarifario");
    expect(resolver.ultimo).toMatchObject({ clientId: "z-exacto" });
  });

  it("una segunda coincidencia exacta en otra página sigue siendo ambigua", async () => {
    tablas.clients = [
      { id: "a-exacto", markbox: "DTD-0001", deleted_at: null },
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `b-${String(i).padStart(3, "0")}`, markbox: `DTD-0001-${i}`, deleted_at: null,
      })),
      { id: "z-duplicado", markbox: " dtd-0001 ", deleted_at: null },
    ];
    expect(await proponerTarifa(doble(), recepcion("DTD-0001"), "puerta_a_puerta_DDP"))
      .toEqual({ kind: "ninguna", motivo: "sin_cliente" });
    expect(resolver.ultimo).toBeNull();
  });

  it("un comodín en el Shipping Mark se busca tal cual", async () => {
    expect(await proponerTarifa(doble(), recepcion("DTD-000_"), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cliente" });
  });

  it("el estimado aceptado de la orden ligada manda, con su servicio", async () => {
    const p = await proponerTarifa(doble(), recepcion("dtd-0001", { sales_order_id: "ov1" }), "consolidado_lcl");
    expect(p).toEqual({ kind: "estimado", quoteId: "q1", quoteCode: "EST-1", service: "puerta_a_puerta_DDP" });
    expect(resolver.ultimo).toBeNull();
  });

  it("sin destino, sin CBM, huérfana o sin tarifa por CBM", async () => {
    expect(await proponerTarifa(doble(), recepcion("DTD-0001", { destination_city: " " }), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_destino" });
    expect(await proponerTarifa(doble(), recepcion("DTD-0001", { total_cbm: 0 }), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cbm" });
    expect(await proponerTarifa(doble(), recepcion("DTD-0001", { is_orphan: true }), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_cliente" });
    resolver.respuesta = { rate: { per_cbm: null }, rateId: "r-fcl", origen: "casa", bookName: "Casa" };
    expect(await proponerTarifa(doble(), recepcion("DTD-0001"), "puerta_a_puerta_DDP")).toEqual({ kind: "ninguna", motivo: "sin_tarifa" });
  });
});

describe("listAcceptedQuotesForMarkbox", () => {
  it("solo los aceptados del mismo Shipping Mark normalizado", async () => {
    const qs = await listAcceptedQuotesForMarkbox(doble(), "dtd-0001");
    expect(qs.map((q) => q.id)).toEqual(["q1"]);
    expect(qs[0].rate_per_cbm).toBe(820);
  });

  it("encuentra el estimado exacto aunque haya 20 parciales más recientes", async () => {
    tablas.quotes = Array.from({ length: 20 }, (_, i) => ({
      id: `parcial-${i}`, quote_code: `EST-P-${i}`, client_markbox: "DTD-00012",
      service: "puerta_a_puerta_DDP", rate_per_cbm: 900, status: "accepted",
      deleted_at: null, accepted_at: "2026-10-20T15:00:00Z",
    }));
    tablas.quotes.push({
      id: "exacto", quote_code: "EST-E", client_markbox: " dtd-0001 ",
      service: "puerta_a_puerta_DDP", rate_per_cbm: 820, status: "accepted",
      deleted_at: null, accepted_at: "2026-10-19T15:00:00Z",
    });
    expect((await listAcceptedQuotesForMarkbox(doble(), "DTD-0001")).map((q) => q.id)).toEqual(["exacto"]);
  });

  it("el tope cuenta 20 estimados exactos válidos, ordenados con desempate estable", async () => {
    const exactos = Array.from({ length: 25 }, (_, i) => ({
      id: `e-${String(i).padStart(2, "0")}`, quote_code: `EST-E-${i}`, client_markbox: "DTD-0001",
      service: "puerta_a_puerta_DDP", rate_per_cbm: 800 + i, status: "accepted",
      deleted_at: null, accepted_at: "2026-10-19T15:00:00Z",
    }));
    tablas.quotes = [
      ...exactos.slice().reverse(),
      ...Array.from({ length: 21 }, (_, i) => ({
        id: `p-${i}`, quote_code: `EST-P-${i}`, client_markbox: "DTD-00012",
        service: "puerta_a_puerta_DDP", rate_per_cbm: 900, status: "accepted",
        deleted_at: null, accepted_at: "2026-10-20T15:00:00Z",
      })),
      { ...exactos[0], id: "cero", rate_per_cbm: 0, accepted_at: "2026-10-21T15:00:00Z" },
    ];
    expect((await listAcceptedQuotesForMarkbox(doble(), "DTD-0001")).map((q) => q.id))
      .toEqual(exactos.slice(0, 20).map((q) => q.id));
  });
});
