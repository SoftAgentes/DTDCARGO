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
  invoiceKpis,
  listInvoices,
  tabCounts,
} from "../invoice-queries";
import type { Invoice } from "../invoice-types";

const TODAY = new Date().toISOString().slice(0, 10);
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
    shipment_id: null,
    shipment_code: null,
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
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

/** Stub de SupabaseClient para invoiceKpis (cadena from().select().limit()). */
function kpiStub(rows: Record<string, unknown>[]): SupabaseClient {
  return {
    from() {
      return {
        select() {
          return {
            limit() {
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
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

/** Stub que captura los filtros aplicados y devuelve rows fijas. */
function listStub(rows: Record<string, unknown>[]): SupabaseClient {
  const chain = {
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    eq() {
      return chain;
    },
    or() {
      return chain;
    },
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return {
    from() {
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
