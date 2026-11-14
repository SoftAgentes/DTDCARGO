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
 *
 * SDD-0557: «Ingresos del mes» y «Ticket promedio» usan la cifra oficial
 * (base sin IVA en USD, por emisión, `resumirIngreso`), con el mes en UTC como
 * se graba `issued_at`. Los fixtures traen `base_amount` y `currency`.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { financeInvoiceKpis, money } from "../dashboard-kpi-queries";
import {
  FACTURAS_DEL_MES,
  HOY,
} from "@/lib/studio/accounting/__tests__/ingreso-fixture";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

const NOW = new Date();
// En UTC, como `issued_at` y el `hoy` por defecto del lector.
const YM = NOW.toISOString().slice(0, 7);
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
  base_amount: 800,
  currency: "USD",
  fx_rate: null,
  total_amount: 800,
  paid_amount: 0,
  created_at: `${ESTE_MES}T00:00:00Z`,
  deleted_at: null,
};

const BORRADA = {
  status: "emitida",
  issued_at: ESTE_MES,
  due_date: VENCIDA_HACE_10_DIAS,
  base_amount: 9000,
  currency: "USD",
  fx_rate: null,
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
    // VIVA no trae fund_class: es de terceros (default de la 0122) y se dice.
    expect(k.avgTicket.sub).toBe("1 factura(s) en el año · sin IVA · 100 % del facturado del año es de terceros");
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

describe("financeInvoiceKpis · cifra oficial (SDD-0557)", () => {
  it("con el fixture del mes: la misma cifra que Contabilidad, Reportes y Dirección", async () => {
    // HOY es un día lejos de la fecha real: si el lector usara el reloj en vez
    // de `hoy`, el mes sería otro y daría $0.
    const k = await financeInvoiceKpis(stub(FACTURAS_DEL_MES), HOY);
    expect(k.monthRevenue.value).toBe(money(3000));
    // F2 y F6 (1000 cada una; F6 en yuanes con tasa, SDD-0572) son de terceros:
    // la cifra las incluye y el subtítulo lo dice.
    expect(k.monthRevenue.sub).toBe("facturado del mes sin IVA · 2 sin convertir · incluye $2.0K de terceros");
  });

  it("una factura con IVA aporta su base, no el total; si es propia, no hay aviso de terceros", async () => {
    const f1 = FACTURAS_DEL_MES.filter((f) => f.id === "f1");
    const k = await financeInvoiceKpis(stub(f1), HOY);
    expect(k.monthRevenue.value).toBe(money(1000));
    expect(k.monthRevenue.sub).toBe("facturado del mes sin IVA");
    expect(k.avgTicket.sub).toBe("1 factura(s) en el año · sin IVA");
  });

  it("terceros casi todo el año: el porcentaje no se pierde en el redondeo a miles", async () => {
    // Con «$X de los $Y», 2260 de 2340 se leía «$2.3K de los $2.3K».
    const propia = { ...FACTURAS_DEL_MES[0], id: "p1", fund_class: "local_revenue", base_amount: 80 };
    const terceros = { ...FACTURAS_DEL_MES[0], id: "t1", fund_class: "third_party", base_amount: 2260 };
    const k = await financeInvoiceKpis(stub([propia, terceros]), HOY);
    expect(k.avgTicket.sub).toBe("2 factura(s) en el año · sin IVA · 97 % del facturado del año es de terceros");
  });

  it("una factura third_party: el mes y el ticket dicen cuánto es de terceros", async () => {
    const terceros = { ...FACTURAS_DEL_MES[0], id: "f9", fund_class: "third_party", base_amount: 400 };
    const k = await financeInvoiceKpis(stub([FACTURAS_DEL_MES[0], terceros]), HOY);
    expect(k.monthRevenue.value).toBe(money(1400));
    expect(k.monthRevenue.sub).toBe("facturado del mes sin IVA · incluye $400 de terceros");
    expect(k.avgTicket.sub).toBe("2 factura(s) en el año · sin IVA · 29 % del facturado del año es de terceros");
  });

  it("el ticket promedio usa la misma base: F1 + F2 + F5 + F6 en el año = 3300 / 4", async () => {
    const k = await financeInvoiceKpis(stub(FACTURAS_DEL_MES), HOY);
    expect(k.avgTicket.value).toBe(money(3300 / 4));
    // Terceros del año: F2 (1000) + F5 (300, enero) + F6 (1000), de los 3300 del año. Se
    // dicen contra el total del que sale el promedio, no colgados del ticket.
    expect(k.avgTicket.sub).toBe("4 factura(s) en el año · sin IVA · 70 % del facturado del año es de terceros");
    expect(k.avgTicket.sub).not.toMatch(/incluye/);
  });
});
