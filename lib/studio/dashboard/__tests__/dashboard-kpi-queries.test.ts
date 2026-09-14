/**
 * SDD-0465 · `financeInvoiceKpis` no cuenta una factura borrada.
 *
 * Es el bundle de finanzas del tablero (SDD-0114 · Slice C): facturado del
 * mes, vencidas, por cobrar y ticket promedio. Una factura eliminada que
 * entrara acá infla el mes y pone "requieren cobro" sobre una deuda que
 * Facturación ya no muestra.
 *
 * El doble APLICA `is("deleted_at", null)` sobre las filas, como PostgREST: si
 * el lector deja de pedirlo, la borrada del fixture (9.000) entra al KPI y las
 * cifras cambian.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { financeInvoiceKpis, money } from "../dashboard-kpi-queries";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

const NOW = new Date();
const YM = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;
const ESTE_MES = `${YM}-01`;
const VENCIDA_HACE_10_DIAS = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
})();

let filtros: { op: string; col: string; val: unknown }[] = [];

function stub(rows: Record<string, unknown>[]): SupabaseClient {
  filtros = [];
  return {
    from() {
      let visibles = rows;
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        is(col: string, val: unknown) {
          filtros.push({ op: "is", col, val });
          if (val === null) visibles = visibles.filter((r) => r[col] == null);
          return chain;
        },
        order() {
          return chain;
        },
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const trozo = visibles.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const VIVA = {
  status: "emitida",
  issued_at: ESTE_MES,
  due_date: VENCIDA_HACE_10_DIAS,
  total_amount: 800,
  paid_amount: 0,
  created_at: `${ESTE_MES}T00:00:00Z`,
  deleted_at: null,
};

const BORRADA = {
  status: "emitida",
  issued_at: ESTE_MES,
  due_date: VENCIDA_HACE_10_DIAS,
  total_amount: 9000,
  paid_amount: 0,
  created_at: `${ESTE_MES}T00:00:00Z`,
  deleted_at: `${ESTE_MES}T12:00:00Z`,
};

describe("financeInvoiceKpis · SDD-0465", () => {
  it("una borrada no suma al mes, no cuenta como vencida, no es saldo ni ticket", async () => {
    const k = await financeInvoiceKpis(stub([VIVA, BORRADA]));

    expect(k.monthRevenue.value).toBe(money(800));
    expect(k.invoicesDue.value).toBe("1");
    expect(k.pendingCollect.value).toBe(money(800));
    expect(k.avgTicket.value).toBe(money(800));
    expect(k.avgTicket.sub).toBe("1 factura(s) YTD");
    expect(filtros).toContainEqual({ op: "is", col: "deleted_at", val: null });
  });

  it("si la única factura está borrada, el tablero dice 'sin facturas'", async () => {
    const k = await financeInvoiceKpis(stub([BORRADA]));

    expect(k.monthRevenue).toEqual({ value: "$0", sub: "sin facturas", tone: "neutral" });
    expect(k.invoicesDue.value).toBe("0");
    expect(k.pendingCollect.value).toBe("$0");
  });

  it("sin el filtro la borrada inflaría el mes (control del doble)", async () => {
    // Prueba del propio fixture: con `deleted_at: null` la de 9.000 sí entra.
    const k = await financeInvoiceKpis(stub([VIVA, { ...BORRADA, deleted_at: null }]));

    expect(k.monthRevenue.value).toBe(money(9800));
    expect(k.invoicesDue.value).toBe("2");
  });
});
