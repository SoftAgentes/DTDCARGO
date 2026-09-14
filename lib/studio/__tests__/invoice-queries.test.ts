/**
 * Tests del módulo Facturación (SDD-0021) — capa `invoice-queries`.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec:
 *  - filterByTab (all/pending/overdue/paid) + tabCounts
 *  - invoiceKpis agrega billedYtd / outstanding / overdue por tenant
 *  - listInvoices respeta el filtro de tab sobre lo que devuelve la query
 *  - next_invoice_code: el formato F-YYYY-NNNN (contrato de la RPC SQL)
 *
 * `invoiceKpis` y `listInvoices` reciben un SupabaseClient — usamos un stub
 * mínimo con la cadena `.from().select()...` que esas funciones encadenan.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterByTab,
  getInvoiceByCode,
  invoiceKpis,
  listInvoices,
  tabCounts,
} from "../invoice-queries";
import type { Invoice } from "../invoice-types";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

const YEAR = new Date().getFullYear();
const past = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
})();
const future = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
})();

function inv(partial: Partial<Invoice>): Invoice {
  return {
    id: partial.id ?? crypto.randomUUID(),
    tenant_id: "t1",
    invoice_code: partial.invoice_code ?? "F-2026-0001",
    client_markbox: partial.client_markbox ?? "DTD-1001",
    client_name: partial.client_name ?? "Cliente",
    client_rif: null,
    client_doc_kind: null,
    shipment_id: null,
    shipment_code: null,
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    iva_mode: partial.iva_mode ?? null,
    base_amount: partial.total_amount ?? 1000,
    iva_amount: 0,
    total_amount: partial.total_amount ?? 1000,
    status: partial.status ?? "emitida",
    issued_at: partial.issued_at ?? `${YEAR}-01-15`,
    due_date: partial.due_date ?? future,
    paid_amount: partial.paid_amount ?? 0,
    last_payment_at: null,
    lines: [],
    notes: null,
    created_at: partial.created_at ?? `${YEAR}-01-15T00:00:00Z`,
    updated_at: `${YEAR}-01-15T00:00:00Z`,
    deleted_at: null,
    ...partial,
  };
}

const SET: Invoice[] = [
  inv({ invoice_code: "F-2026-0001", status: "emitida", due_date: future, total_amount: 1000 }), // pending
  inv({ invoice_code: "F-2026-0002", status: "emitida", due_date: past, total_amount: 2000 }), // overdue
  inv({ invoice_code: "F-2026-0003", status: "parcial", due_date: future, total_amount: 3000, paid_amount: 1000 }), // pending (saldo 2000)
  inv({ invoice_code: "F-2026-0004", status: "pagada", due_date: past, total_amount: 4000, paid_amount: 4000 }), // paid
  inv({ invoice_code: "F-2026-0005", status: "borrador", due_date: null, total_amount: 500 }), // ni pending ni overdue ni paid
  inv({ invoice_code: "F-2026-0006", status: "anulada", due_date: past, total_amount: 999 }), // excluida
];

describe("filterByTab", () => {
  it("all devuelve todo", () => {
    expect(filterByTab(SET, "all")).toHaveLength(SET.length);
  });

  it("overdue = vencidas (due < hoy, no pagada/anulada)", () => {
    const r = filterByTab(SET, "overdue");
    expect(r.map((i) => i.invoice_code)).toEqual(["F-2026-0002"]);
  });

  it("paid = pagadas", () => {
    const r = filterByTab(SET, "paid");
    expect(r.map((i) => i.invoice_code)).toEqual(["F-2026-0004"]);
  });

  it("pending = saldo > 0, no vencida, no pagada/anulada/borrador-vencida", () => {
    const r = filterByTab(SET, "pending");
    expect(r.map((i) => i.invoice_code).sort()).toEqual([
      "F-2026-0001",
      "F-2026-0003",
      "F-2026-0005", // borrador con saldo, sin due_date → no vencida → pending
    ]);
  });
});

describe("tabCounts", () => {
  it("cuenta cada pestaña", () => {
    const c = tabCounts(SET);
    expect(c.all).toBe(6);
    expect(c.overdue).toBe(1);
    expect(c.paid).toBe(1);
    expect(c.pending).toBe(3);
  });
});

/**
 * Stub de SupabaseClient para invoiceKpis: `from().select().order().range()`.
 *
 * El `range` corta en SERVER_CAP por request igual que PostgREST. Sin ese tope
 * el doble sería más generoso que el servidor y el test saldría verde con
 * código que en producción trunca — que es exactamente cómo el bug del tope de
 * 1.000 filas sobrevivió meses en este repo.
 */
function kpiStub(rows: Record<string, unknown>[]): SupabaseClient {
  return {
    from() {
      // `is(col, null)` se APLICA sobre las filas, como PostgREST (SDD-0465):
      // si el lector deja de pedir `deleted_at is null`, la factura borrada
      // del fixture entra al KPI y la aserción lo delata. Un doble que
      // ignorara el filtro daría verde con código que suma eliminadas.
      let visibles = rows;
      const chain: Record<string, unknown> = {
        select: () => chain,
        is: (col: string, val: unknown) => {
          if (val === null) visibles = visibles.filter((r) => r[col] == null);
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: visibles, error: null }),
        range: (desde: number, hasta: number) => {
          const pedido = hasta - desde + 1;
          const trozo = visibles.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("invoiceKpis", () => {
  it("agrega billedYtd, outstanding y overdue", async () => {
    const rows = [
      // emitida, año actual, saldo 1000, vence futuro → outstanding (no overdue)
      { status: "emitida", issued_at: `${YEAR}-02-01`, due_date: future, total_amount: 1000, paid_amount: 0, created_at: `${YEAR}-02-01` },
      // emitida, vencida, saldo 2000 → outstanding + overdue
      { status: "emitida", issued_at: `${YEAR}-01-01`, due_date: past, total_amount: 2000, paid_amount: 0, created_at: `${YEAR}-01-01` },
      // parcial, saldo 500, futuro → outstanding
      { status: "parcial", issued_at: `${YEAR}-03-01`, due_date: future, total_amount: 1500, paid_amount: 1000, created_at: `${YEAR}-03-01` },
      // pagada → cuenta para billedYtd, no outstanding
      { status: "pagada", issued_at: `${YEAR}-01-10`, due_date: past, total_amount: 4000, paid_amount: 4000, created_at: `${YEAR}-01-10` },
      // borrador → no cuenta para billedYtd ni outstanding
      { status: "borrador", issued_at: null, due_date: null, total_amount: 800, paid_amount: 0, created_at: `${YEAR}-01-20` },
      // anulada → excluida de todo
      { status: "anulada", issued_at: `${YEAR}-01-05`, due_date: past, total_amount: 999, paid_amount: 0, created_at: `${YEAR}-01-05` },
      // emitida pero año pasado → no cuenta para billedYtd
      { status: "emitida", issued_at: `${YEAR - 1}-12-01`, due_date: `${YEAR - 1}-12-31`, total_amount: 7000, paid_amount: 0, created_at: `${YEAR - 1}-12-01` },
    ];
    const kpis = await invoiceKpis(kpiStub(rows));

    // billedYtd: 1000 + 2000 + 1500 + 4000 = 8500
    // (excluye borrador/anulada y la emitida del año pasado — billedYtd SÍ
    //  filtra por año; outstanding/overdue NO, una deuda vieja sigue debida).
    expect(kpis.billedYtd).toBe(8500);
    // outstanding: 1000 + 2000 + 500 + 7000 (la del año pasado sigue por cobrar)
    expect(kpis.outstanding).toBe(10500);
    // overdue: 2000 (vencida del año) + 7000 (vencida año pasado). La anulada se excluye.
    expect(kpis.overdue).toBe(9000);
  });

  it("todo en cero sin facturas", async () => {
    const kpis = await invoiceKpis(kpiStub([]));
    expect(kpis).toEqual({ billedYtd: 0, outstanding: 0, overdue: 0 });
  });
});

/** Filtros que el doble vio en la última query (para afirmar sobre ellos). */
let filtrosVistos: { op: string; col: string; val: unknown }[] = [];

/**
 * Stub que captura los filtros aplicados y devuelve rows fijas.
 *
 * `eq` e `is(col, null)` se APLICAN sobre las filas, como haría PostgREST: así
 * una factura borrada del fixture sólo desaparece si el lector pidió
 * `deleted_at is null` (SDD-0465). El resto de la cadena es no-op.
 */
function listStub(rows: Record<string, unknown>[]): SupabaseClient {
  return {
    from() {
      filtrosVistos = [];
      let visibles = rows ?? [];
      const chain = {
        order() {
          return chain;
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST. Un doble más generoso que el servidor deja pasar
        // código que en producción trunca.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const trozo = visibles.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
        },
        limit() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filtrosVistos.push({ op: "eq", col, val });
          visibles = visibles.filter((r) => r[col] === val);
          return chain;
        },
        is(col: string, val: unknown) {
          filtrosVistos.push({ op: "is", col, val });
          if (val === null) visibles = visibles.filter((r) => r[col] == null);
          return chain;
        },
        or() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: visibles[0] ?? null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: visibles, error: null }).then(resolve);
        },
      };
      return { select: () => chain };
    },
  } as unknown as SupabaseClient;
}

describe("listInvoices", () => {
  it("aplica el filtro de tab sobre lo devuelto por la query (overdue)", async () => {
    const rows = SET as unknown as Record<string, unknown>[];
    const result = await listInvoices(listStub(rows), { tab: "overdue" });
    expect(result.map((i) => i.invoice_code)).toEqual(["F-2026-0002"]);
  });

  it("tab=all devuelve todo lo cargado", async () => {
    const rows = SET as unknown as Record<string, unknown>[];
    const result = await listInvoices(listStub(rows), { tab: "all" });
    expect(result).toHaveLength(SET.length);
  });

  it("coacciona numéricos provenientes como string", async () => {
    const rows = [
      {
        ...inv({ invoice_code: "F-2026-0099" }),
        total_amount: "1234.50",
        paid_amount: "200",
        iva_rate: "16.00",
      },
    ] as unknown as Record<string, unknown>[];
    const result = await listInvoices(listStub(rows), { tab: "all" });
    expect(result[0].total_amount).toBe(1234.5);
    expect(result[0].paid_amount).toBe(200);
    expect(result[0].iva_rate).toBe(16);
  });
});

/**
 * SDD-0465 · Una factura con `deleted_at` no existe para estos lectores.
 *
 * La RLS de equipo dejó de ocultarlas (0230), así que el filtro vive en cada
 * lector. Los dobles APLICAN `is("deleted_at", null)`: si alguien quita ese
 * filtro del lector, la borrada del fixture vuelve a listarse, a abrirse y a
 * sumar, y estas pruebas caen.
 */
describe("SDD-0465 · facturas borradas fuera de los lectores", () => {
  const BORRADA = inv({
    invoice_code: "F-2026-0100",
    status: "emitida",
    due_date: past,
    total_amount: 5000,
    deleted_at: `${YEAR}-02-01T00:00:00Z`,
  });
  const VIVA = inv({
    invoice_code: "F-2026-0101",
    status: "emitida",
    due_date: past,
    total_amount: 700,
  });

  it("listInvoices no lista una borrada, ni siquiera en `all`, y pide el filtro a la base", async () => {
    const rows = [BORRADA, VIVA] as unknown as Record<string, unknown>[];
    const result = await listInvoices(listStub(rows), { tab: "all" });
    expect(result.map((i) => i.invoice_code)).toEqual(["F-2026-0101"]);
    expect(filtrosVistos).toContainEqual({ op: "is", col: "deleted_at", val: null });
  });

  it("listInvoices tampoco la cuenta como vencida", async () => {
    const rows = [BORRADA, VIVA] as unknown as Record<string, unknown>[];
    const result = await listInvoices(listStub(rows), { tab: "overdue" });
    expect(result.map((i) => i.invoice_code)).toEqual(["F-2026-0101"]);
  });

  it("getInvoiceByCode devuelve null para el código de una borrada", async () => {
    const rows = [BORRADA] as unknown as Record<string, unknown>[];
    expect(await getInvoiceByCode(listStub(rows), "F-2026-0100")).toBeNull();
    expect(filtrosVistos).toContainEqual({ op: "is", col: "deleted_at", val: null });
  });

  it("getInvoiceByCode sigue abriendo una viva", async () => {
    const rows = [VIVA] as unknown as Record<string, unknown>[];
    const r = await getInvoiceByCode(listStub(rows), "F-2026-0101");
    expect(r?.invoice_code).toBe("F-2026-0101");
  });

  it("invoiceKpis no suma una borrada a facturado, por cobrar ni vencido", async () => {
    const rows = [
      // emitida, vencida, saldo 5000 — pero BORRADA: no cuenta en nada
      { status: "emitida", issued_at: `${YEAR}-02-01`, due_date: past, total_amount: 5000, paid_amount: 0, created_at: `${YEAR}-02-01`, deleted_at: `${YEAR}-02-02T00:00:00Z` },
      // emitida, vencida, saldo 700 — viva: cuenta en los tres
      { status: "emitida", issued_at: `${YEAR}-02-01`, due_date: past, total_amount: 700, paid_amount: 0, created_at: `${YEAR}-02-01`, deleted_at: null },
    ];
    const kpis = await invoiceKpis(kpiStub(rows));
    expect(kpis).toEqual({ billedYtd: 700, outstanding: 700, overdue: 700 });
  });
});

/**
 * Contrato de next_invoice_code (la RPC vive en SQL · 0077_invoices.sql).
 * Replicamos el formato F-YYYY-NNNN para fijar el invariante del padding
 * y de la extracción del counter por regex, que es lo que la RPC garantiza.
 */
describe("next_invoice_code (formato F-YYYY-NNNN)", () => {
  const RE = /^F-\d{4}-(\d+)$/;

  function nextCode(existing: string[], year = YEAR): string {
    let max = 0;
    for (const c of existing) {
      const m = c.match(RE);
      if (m && c.startsWith(`F-${year}-`)) {
        max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return `F-${year}-${String(max + 1).padStart(4, "0")}`;
  }

  it("la 1ª del año es F-YYYY-0001", () => {
    expect(nextCode([])).toBe(`F-${YEAR}-0001`);
  });

  it("incrementa sobre el máximo existente", () => {
    expect(nextCode([`F-${YEAR}-0001`, `F-${YEAR}-0002`])).toBe(`F-${YEAR}-0003`);
  });

  it("padding de 4 dígitos", () => {
    expect(nextCode([`F-${YEAR}-0041`])).toMatch(/^F-\d{4}-0042$/);
  });

  it("ignora códigos de otros años", () => {
    expect(nextCode([`F-${YEAR - 1}-0099`], YEAR)).toBe(`F-${YEAR}-0001`);
  });

  it("se extiende más allá de 9999", () => {
    expect(nextCode([`F-${YEAR}-9999`])).toBe(`F-${YEAR}-10000`);
  });
});
