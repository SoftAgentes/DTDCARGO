// @vitest-environment node
/**
 * Tests de emisión/anulación de la Rendición (stub Supabase, sin red ni DB).
 * Cubren los criterios de aceptación §5:
 *
 *  - emitRenditionFor: snapshot con los totales del RE-CHECK server-side +
 *    inserta el puente + marca los recibos aplicado→rendido.
 *  - guard admin: un no-admin NO puede emitir/anular.
 *  - guard período vacío: sin recibos elegibles, no emite (idempotencia: un
 *    período ya rendido tiene 0 recibos en 'aplicado' → preview vacío).
 *  - voidRenditionFor: status→anulada + void_reason + revierte rendido→aplicado;
 *    motivo obligatorio.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { emitRenditionFor, voidRenditionFor } from "../actions-helpers";

type Row = Record<string, unknown>;

/** Tope por request del doble de prueba: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

/**
 * Stub chainable de Supabase para el camino de emit/void. Soporta:
 *  - auth.getUser()
 *  - from(t).select(...).eq(...).gte/lte(...).is(...).limit(...) → lista
 *  - from(t).select(...).eq(...).maybeSingle() → fila
 *  - from(t).select(...).in(...).limit(...) → lista filtrada por id∈
 *  - from(t).insert(payload).select().single() → captura + id sintético
 *  - from(t).insert(rows) (sin select) → captura (bulk)
 *  - from(t).update(payload).in/eq(...) terminal → captura
 *  - rpc(name, args)
 */
function makeStub(opts: {
  userId?: string | null;
  role?: string;
  receipts?: Row[];
  invoices?: Row[];
  renditions?: Row[];
  renditionReceipts?: Row[];
  nextCode?: string;
}) {
  const captured = {
    inserts: [] as { table: string; payload: unknown }[],
    updates: [] as { table: string; payload: Row; filters: Row }[],
  };
  const tables: Record<string, Row[]> = {
    payment_receipts: opts.receipts ?? [],
    invoices: opts.invoices ?? [],
    renditions: opts.renditions ?? [],
    rendition_receipts: opts.renditionReceipts ?? [],
    user_tenants: [{ tenant_id: "t1", role: opts.role ?? "admin" }],
  };

  function from(table: string) {
    const filters: Row = {};
    const inFilters: Record<string, unknown[]> = {};

    /** Las filas de la tabla tras aplicar los filtros eq + in acumulados. */
    const filtradas = (): Row[] => {
      let rows = tables[table] ?? [];
      for (const [k, v] of Object.entries(filters)) {
        rows = rows.filter((r) => r[k] === v);
      }
      for (const [k, vals] of Object.entries(inFilters)) {
        rows = rows.filter((r) => vals.includes(r[k]));
      }
      return rows;
    };

    const api: Row = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return api;
      },
      gte() {
        return api;
      },
      lte() {
        return api;
      },
      is() {
        return api;
      },
      order() {
        return api;
      },
      in(col: string, vals: unknown[]) {
        inFilters[col] = vals;
        return api;
      },
      limit() {
        // Terminal de lista: aplica filtros eq + in.
        return Promise.resolve({ data: filtradas(), error: null });
      },
      // Terminal paginado. Corta en SERVER_CAP por request igual que PostgREST:
      // si el doble fuera más generoso que el servidor, un test saldría verde
      // con código que en producción trunca — que es cómo este bug sobrevivió.
      range(desde: number, hasta: number) {
        const rows = filtradas();
        const pedido = hasta - desde + 1;
        const trozo = rows.slice(desde, desde + Math.min(pedido, SERVER_CAP));
        return Promise.resolve({ data: trozo, error: null });
      },
      maybeSingle() {
        let rows = tables[table] ?? [];
        for (const [k, v] of Object.entries(filters)) {
          rows = rows.filter((r) => r[k] === v);
        }
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      insert(payload: unknown) {
        captured.inserts.push({ table, payload });
        return {
          select() {
            return {
              single() {
                return Promise.resolve({
                  data: { id: `${table}-new` },
                  error: null,
                });
              },
            };
          },
          // insert sin .select() (bulk del puente): es un thenable.
          then(resolve: (v: { error: null }) => void) {
            resolve({ error: null });
          },
        };
      },
      update(payload: Row) {
        const updFilters: Row = {};
        let pushed = false;
        // Terminal de update: chainable .in()/.eq() y, a la vez, thenable — el
        // código encadena .update(...).in(...).eq(...). Cada filtro acumula; el
        // capture se hace una sola vez al resolver (await) la cadena.
        const term: Row = {
          in(col: string, vals: unknown[]) {
            updFilters[col] = vals;
            return term;
          },
          eq(col: string, val: unknown) {
            updFilters[col] = val;
            return term;
          },
          then(resolve: (v: { error: null }) => void) {
            if (!pushed) {
              captured.updates.push({ table, payload, filters: updFilters });
              pushed = true;
            }
            resolve({ error: null });
          },
        };
        return term;
      },
    };
    return api;
  }

  const stub = {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId === null ? null : { id: opts.userId ?? "u1" } },
      }),
    },
    from,
    rpc: async () => ({ data: opts.nextCode ?? "RND-2026-0001", error: null }),
  };

  return { stub: stub as unknown as SupabaseClient, captured };
}

const PERIOD = { from: "2026-06-16", to: "2026-06-30" };

describe("emitRenditionFor", () => {
  it("congela el snapshot del re-check + inserta puente + marca recibos rendido", async () => {
    const { stub, captured } = makeStub({
      receipts: [
        {
          id: "r1",
          receipt_code: "R-2026-0001",
          invoice_id: "i1",
          client_markbox: "DTD-0001",
          client_name: "Acme",
          amount: 600,
          currency: "USD",
          fx_rate: null,
          received_at: "2026-06-20",
          application_status: "aplicado",
          fund_class: "third_party",
        },
        {
          id: "r2",
          receipt_code: "R-2026-0002",
          invoice_id: "i2",
          client_markbox: "DTD-0002",
          client_name: "Beta",
          amount: 400,
          currency: "USD",
          fx_rate: null,
          received_at: "2026-06-22",
          application_status: "aplicado",
          fund_class: "third_party",
        },
      ],
      invoices: [
        { id: "i1", invoice_code: "F-2026-0001" },
        { id: "i2", invoice_code: "F-2026-0002" },
      ],
    });

    const res = await emitRenditionFor(stub, PERIOD);
    expect(res.ok).toBe(true);
    expect(res.renditionCode).toBe("RND-2026-0001");
    expect(res.receiptCount).toBe(2);

    // Cabecera con totales congelados (1000 terceros, 0 local, 1000 neto).
    const header = captured.inserts.find((i) => i.table === "renditions");
    expect(header).toBeTruthy();
    const hp = header!.payload as Row;
    expect(hp.third_party_usd).toBe(1000);
    expect(hp.local_revenue_usd).toBe(0);
    expect(hp.net_to_operadora_usd).toBe(1000);
    expect(hp.receipt_count).toBe(2);
    expect(hp.status).toBe("emitida");

    // Puente con 2 recibos.
    const bridge = captured.inserts.find(
      (i) => i.table === "rendition_receipts",
    );
    expect(Array.isArray(bridge!.payload)).toBe(true);
    expect((bridge!.payload as unknown[]).length).toBe(2);

    // UPDATE de recibos → rendido.
    const upd = captured.updates.find(
      (u) => u.table === "payment_receipts",
    );
    expect(upd?.payload.application_status).toBe("rendido");
  });

  it("no-admin no puede emitir", async () => {
    const { stub } = makeStub({ role: "operador", receipts: [] });
    const res = await emitRenditionFor(stub, PERIOD);
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/administrador/i);
  });

  it("período sin recibos elegibles → no emite (idempotencia visible)", async () => {
    const { stub, captured } = makeStub({
      receipts: [
        // ya rendido → no está en 'aplicado' → el filtro de la query lo excluye.
        {
          id: "r1",
          receipt_code: "R-2026-0001",
          invoice_id: "i1",
          client_markbox: "DTD-0001",
          client_name: "Acme",
          amount: 600,
          currency: "USD",
          fx_rate: null,
          received_at: "2026-06-20",
          application_status: "rendido",
          fund_class: "third_party",
        },
      ],
    });
    const res = await emitRenditionFor(stub, PERIOD);
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/nada que rendir/i);
    expect(captured.inserts.find((i) => i.table === "renditions")).toBeFalsy();
  });

  // SDD-0572 (decisiones 1 y 2 del Director por delegación de Sam, 2026-10-20): con un cobro sin tasa la rendición no se emite.
  it("un cobro sin tasa en el período → no emite y no toca la DB", async () => {
    const { stub, captured } = makeStub({
      receipts: [
        {
          id: "r1",
          receipt_code: "R-2026-0001",
          invoice_id: "i1",
          client_markbox: "DTD-0001",
          client_name: "Acme",
          amount: 3600,
          currency: "VES",
          fx_rate: null,
          received_at: "2026-06-20",
          application_status: "aplicado",
          fund_class: "third_party",
        },
      ],
      invoices: [{ id: "i1", invoice_code: "F-2026-0001" }],
    });
    const res = await emitRenditionFor(stub, PERIOD);
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/1 cobro\(s\).*no tienen tasa/);
    expect(captured.inserts.find((i) => i.table === "renditions")).toBeFalsy();
    expect(captured.updates.find((u) => u.table === "payment_receipts")).toBeFalsy();
  });

  it("una factura local sin tasa bloquea aunque todos los cobros tengan USD", async () => {
    const { stub, captured } = makeStub({
      receipts: [{
        id: "r1", receipt_code: "R-2026-0001", invoice_id: "i1",
        client_markbox: "DTD-0001", client_name: "Acme",
        amount: 600, currency: "USD", fx_rate: null,
        received_at: "2026-06-20", application_status: "aplicado", fund_class: "third_party",
      }],
      invoices: [
        { id: "i1", invoice_code: "F-2026-0001" },
        {
          id: "local1", invoice_code: "F-2026-0002", fund_class: "local_revenue",
          status: "emitida", issued_at: "2026-06-20", total_amount: 700,
          currency: "CNY", fx_rate: null,
        },
      ],
    });
    const res = await emitRenditionFor(stub, PERIOD);
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/0 cobro\(s\).*1 factura\(s\) local\(es\).*no tienen tasa/);
    expect(captured.inserts).toEqual([]);
    expect(captured.updates).toEqual([]);
  });

  it("rango inválido → error sin tocar la DB", async () => {
    const { stub, captured } = makeStub({});
    const res = await emitRenditionFor(stub, { from: "2026-06-30", to: "2026-06-01" });
    expect(res.error).toBeTruthy();
    expect(captured.inserts).toHaveLength(0);
  });
});

describe("voidRenditionFor", () => {
  it("anula (status→anulada + motivo) y revierte recibos rendido→aplicado", async () => {
    const { stub, captured } = makeStub({
      renditions: [
        { id: "rend1", rendition_code: "RND-2026-0001", status: "emitida" },
      ],
      renditionReceipts: [
        { rendition_id: "rend1", receipt_id: "r1" },
        { rendition_id: "rend1", receipt_id: "r2" },
      ],
    });

    const res = await voidRenditionFor(stub, "rend1", "Período mal cortado");
    expect(res.ok).toBe(true);
    expect(res.renditionCode).toBe("RND-2026-0001");

    const voidUpd = captured.updates.find(
      (u) => u.table === "renditions",
    );
    expect(voidUpd?.payload.status).toBe("anulada");
    expect(voidUpd?.payload.void_reason).toBe("Período mal cortado");

    const revert = captured.updates.find(
      (u) => u.table === "payment_receipts",
    );
    expect(revert?.payload.application_status).toBe("aplicado");
  });

  it("motivo obligatorio", async () => {
    const { stub } = makeStub({
      renditions: [
        { id: "rend1", rendition_code: "RND-2026-0001", status: "emitida" },
      ],
    });
    const res = await voidRenditionFor(stub, "rend1", "   ");
    expect(res.error).toMatch(/motivo/i);
  });

  it("no-admin no puede anular", async () => {
    const { stub } = makeStub({
      role: "operador",
      renditions: [
        { id: "rend1", rendition_code: "RND-2026-0001", status: "emitida" },
      ],
    });
    const res = await voidRenditionFor(stub, "rend1", "x");
    expect(res.error).toMatch(/administrador/i);
  });

  it("una rendición ya anulada no se vuelve a anular", async () => {
    const { stub } = makeStub({
      renditions: [
        { id: "rend1", rendition_code: "RND-2026-0001", status: "anulada" },
      ],
    });
    const res = await voidRenditionFor(stub, "rend1", "x");
    expect(res.error).toMatch(/ya está anulada/i);
  });
});
