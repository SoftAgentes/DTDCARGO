/**
 * SDD-0494 · Un cobro o una orden de pago anulados salen de los lectores.
 *
 * Anular acá NO es un status: `void_collection_receipt` (0467) y
 * `void_supplier_payment_order` (0468) marcan `deleted_at`, y ninguna de las
 * dos tablas tiene columna de estado. La RLS tampoco los esconde — la 0230
 * sacó `deleted_at is null` del USING de la policy FOR ALL (bloqueaba el propio
 * soft delete) y la 0470 conservó ese criterio para `payment_receipts`. O sea:
 * el `.is("deleted_at", null)` de la capa de consulta es lo ÚNICO que separa un
 * documento vivo de uno revertido.
 *
 * El doble APLICA `is("deleted_at", null)` sobre las filas, como PostgREST: si
 * un lector deja de pedirlo, la fila anulada del fixture entra y la aserción lo
 * delata. El fixture es INFELIZ a propósito — la anulada es siempre la más
 * reciente (encabeza los `order by ... desc`) y la de monto más grande (domina
 * cualquier suma), así que ninguna aserción pasa por casualidad. Los casos
 * «control del doble» comprueban justamente eso: sin el filtro, fallan.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentReceipt } from "../payment-types";
import type { SupplierBill, SupplierPayment } from "../treasury/types";
import {
  fundsSeparationSummary,
  getReceiptByCode,
  listReceipts,
  listUnidentifiedReceipts,
  searchReceipts,
} from "../payment-queries";
import {
  listPayments,
  payableForBill,
  treasuryKpis,
} from "../treasury/bill-queries";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

const TODAY = "2026-06-25";
const RANGO = { from: "2026-06-01", to: "2026-06-30" };

// ── Fixture: recibos de cobranza ──────────────────────────────

function rec(partial: Partial<PaymentReceipt> & { id: string }): PaymentReceipt {
  return {
    tenant_id: "t1",
    receipt_code: "R-2026-0000",
    invoice_id: "i1",
    client_markbox: "DTD-1001",
    client_name: "Cliente Demo",
    amount: 0,
    currency: "USD",
    fx_rate: null,
    method: "transferencia",
    cash_account_id: "c1",
    reference: "ref-demo",
    received_at: "2026-06-01",
    journal_entry_id: null,
    notes: null,
    payer_kind: "cliente",
    payer_name: null,
    payer_relation: null,
    licit_declared: true,
    application_status: "aplicado",
    identified_at: null,
    fund_class: "third_party",
    created_at: "2026-06-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  } as PaymentReceipt;
}

/** Cobro vivo sobre la factura i1. */
const COBRO_VIVO = rec({
  id: "r-vivo",
  receipt_code: "R-2026-0001",
  amount: 1000,
  received_at: "2026-06-10",
});

/** Cobro ANULADO: más reciente y 9× más grande que el vivo. */
const COBRO_ANULADO = rec({
  id: "r-anulado",
  receipt_code: "R-2026-0002",
  amount: 9000,
  received_at: "2026-06-11",
  deleted_at: "2026-06-12T00:00:00Z",
});

/** Sin identificar, vivo: sigue en la cuenta puente (cláusula 7.3). */
const SINREF_VIVO = rec({
  id: "r-sinref-vivo",
  receipt_code: "R-2026-0003",
  invoice_id: null,
  client_markbox: null,
  client_name: null,
  amount: 500,
  received_at: "2026-06-12",
  application_status: "recibido_sin_ref",
});

/** Sin identificar y ANULADO: el que encabezaba la bandeja amarilla. */
const SINREF_ANULADO = rec({
  id: "r-sinref-anulado",
  receipt_code: "R-2026-0004",
  invoice_id: null,
  client_markbox: null,
  client_name: null,
  amount: 7000,
  received_at: "2026-06-13",
  application_status: "recibido_sin_ref",
  deleted_at: "2026-06-14T00:00:00Z",
});

/**
 * Ingreso local vivo (la otra mitad de la separación de fondos). Cuelga de OTRA
 * factura a propósito: así el historial de i1 mide solo el par vivo/anulado.
 */
const LOCAL_VIVO = rec({
  id: "r-local-vivo",
  receipt_code: "R-2026-0005",
  invoice_id: "i2",
  amount: 200,
  received_at: "2026-06-08",
  fund_class: "local_revenue",
});

/** Ingreso local ANULADO. */
const LOCAL_ANULADO = rec({
  id: "r-local-anulado",
  receipt_code: "R-2026-0006",
  invoice_id: "i2",
  amount: 300,
  received_at: "2026-06-09",
  fund_class: "local_revenue",
  deleted_at: "2026-06-10T00:00:00Z",
});

const RECIBOS = [
  COBRO_VIVO,
  COBRO_ANULADO,
  SINREF_VIVO,
  SINREF_ANULADO,
  LOCAL_VIVO,
  LOCAL_ANULADO,
];

// ── Fixture: CxP y órdenes de pago ────────────────────────────

function bill(partial: Partial<SupplierBill> & { id: string }): SupplierBill {
  return {
    tenant_id: "t1",
    bill_code: "CXP-2026-0000",
    supplier_id: "s1",
    supplier_name: "Proveedor Demo",
    concept: "Flete",
    expense_account_id: "e1",
    currency: "USD",
    fx_rate: null,
    total_amount: 0,
    paid_amount: 0,
    status: "pendiente",
    bill_kind: "full",
    issue_date: "2026-05-01",
    due_date: "2026-06-01",
    reference: null,
    shipment_id: null,
    journal_entry_id: null,
    notes: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  } as SupplierBill;
}

/** SALDADA por su propia orden: fuera de la cola, y por eso inalcanzable. */
const CXP_SALDADA = bill({
  id: "b-saldada",
  bill_code: "CXP-2026-0001",
  total_amount: 400,
  paid_amount: 400,
  status: "pagada",
});

/** Con saldo: la única que la cola debe traer. */
const CXP_CON_SALDO = bill({
  id: "b-con-saldo",
  bill_code: "CXP-2026-0002",
  total_amount: 1000,
  paid_amount: 0,
  due_date: "2026-06-01",
});

/** Borrada: ni en la cola ni en consulta. */
const CXP_BORRADA = bill({
  id: "b-borrada",
  bill_code: "CXP-2026-0003",
  total_amount: 5000,
  paid_amount: 0,
  due_date: "2026-01-01",
  deleted_at: "2026-02-01T00:00:00Z",
});

function pay(
  partial: Partial<SupplierPayment> & { id: string },
): SupplierPayment {
  return {
    tenant_id: "t1",
    payment_code: "OP-2026-0000",
    bill_id: "b-saldada",
    supplier_id: "s1",
    supplier_name: "Proveedor Demo",
    amount: 0,
    currency: "USD",
    fx_rate: null,
    method: "transferencia",
    cash_account_id: "c1",
    reference: null,
    paid_at: "2026-06-01",
    journal_entry_id: null,
    notes: null,
    created_at: "2026-06-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  } as SupplierPayment;
}

/** Orden viva: la que de verdad saldó la CxP. */
const ORDEN_VIVA = pay({
  id: "p-viva",
  payment_code: "OP-2026-0001",
  amount: 400,
  paid_at: "2026-06-05",
});

/** Orden ANULADA: más reciente y 15× más grande que la viva. */
const ORDEN_ANULADA = pay({
  id: "p-anulada",
  payment_code: "OP-2026-0002",
  amount: 6000,
  paid_at: "2026-06-20",
  deleted_at: "2026-06-21T00:00:00Z",
});

// ── Doble de PostgREST ────────────────────────────────────────

/** Filtros que el doble vio, por tabla (para afirmar sobre ellos). */
let filtros: { table: string; op: string; col: string; val: unknown }[] = [];

beforeEach(() => {
  filtros = [];
});

/**
 * Doble encadenable. Aplica de verdad `is/eq/neq/in/gte/lte` sobre las filas y
 * corta en `limit`/`range` como PostgREST. `or` se registra pero NO filtra: así
 * el texto del ⌘K matchea las dos filas y lo único que puede dejar afuera a la
 * anulada es el `deleted_at`.
 *
 * Devuelve COPIAS de las filas: si entregara los objetos del store, una mutación
 * posterior cambiaría «lo ya leído» y el test mediría otra cosa.
 */
function stub(
  tablas: Record<string, Record<string, unknown>[]>,
): SupabaseClient {
  return {
    from(table: string) {
      let visibles = tablas[table] ?? [];
      let tope = Infinity;
      const salida = () =>
        visibles.slice(0, tope === Infinity ? undefined : tope).map((r) => ({ ...r }));

      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        is(col: string, val: unknown) {
          filtros.push({ table, op: "is", col, val });
          if (val === null) visibles = visibles.filter((r) => r[col] == null);
          return chain;
        },
        eq(col: string, val: unknown) {
          filtros.push({ table, op: "eq", col, val });
          visibles = visibles.filter((r) => r[col] === val);
          return chain;
        },
        neq(col: string, val: unknown) {
          filtros.push({ table, op: "neq", col, val });
          visibles = visibles.filter((r) => r[col] !== val);
          return chain;
        },
        in(col: string, vals: unknown[]) {
          filtros.push({ table, op: "in", col, val: vals });
          visibles = visibles.filter((r) => vals.includes(r[col]));
          return chain;
        },
        gte(col: string, val: string | number) {
          filtros.push({ table, op: "gte", col, val });
          visibles = visibles.filter((r) => (r[col] as string | number) >= val);
          return chain;
        },
        lte(col: string, val: string | number) {
          filtros.push({ table, op: "lte", col, val });
          visibles = visibles.filter((r) => (r[col] as string | number) <= val);
          return chain;
        },
        or(expr: string) {
          filtros.push({ table, op: "or", col: expr, val: null });
          return chain;
        },
        order() {
          return chain;
        },
        limit(n: number) {
          tope = n;
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: salida()[0] ?? null, error: null });
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que PostgREST.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const trozo = visibles
            .slice(desde, desde + Math.min(pedido, SERVER_CAP))
            .map((r) => ({ ...r }));
          return Promise.resolve({ data: trozo, error: null });
        },
        // Terminal directo: `await query` sin `.range()` ni `.maybeSingle()`.
        then(
          resolve: (v: { data: unknown; error: null }) => unknown,
          reject?: (e: unknown) => unknown,
        ) {
          return Promise.resolve({ data: salida(), error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const TABLAS = {
  payment_receipts: RECIBOS as unknown as Record<string, unknown>[],
  supplier_payments: [ORDEN_VIVA, ORDEN_ANULADA] as unknown as Record<
    string,
    unknown
  >[],
  supplier_bills: [
    CXP_SALDADA,
    CXP_CON_SALDO,
    CXP_BORRADA,
  ] as unknown as Record<string, unknown>[],
};

/** El mismo fixture, pero con TODO vivo: lo que vería un lector sin el filtro. */
const TABLAS_SIN_FILTRO = {
  payment_receipts: RECIBOS.map((r) => ({
    ...r,
    deleted_at: null,
  })) as unknown as Record<string, unknown>[],
  supplier_payments: [ORDEN_VIVA, ORDEN_ANULADA].map((p) => ({
    ...p,
    deleted_at: null,
  })) as unknown as Record<string, unknown>[],
  supplier_bills: TABLAS.supplier_bills,
};

// ── Hallazgo 1 · Cobranzas ────────────────────────────────────

describe("Cobranzas · un recibo anulado no se muestra ni se suma (SDD-0494)", () => {
  it("listReceipts deja fuera el anulado del historial de la factura", async () => {
    const recibos = await listReceipts(stub(TABLAS), { invoiceId: "i1" });

    expect(recibos.map((r) => r.receipt_code)).toEqual(["R-2026-0001"]);
    expect(filtros).toContainEqual({
      table: "payment_receipts",
      op: "is",
      col: "deleted_at",
      val: null,
    });
  });

  it("sin el filtro, el anulado ENCABEZARÍA el historial (control del doble)", async () => {
    const recibos = await listReceipts(stub(TABLAS_SIN_FILTRO), {
      invoiceId: "i1",
    });

    expect(recibos.map((r) => r.receipt_code)).toEqual([
      "R-2026-0001",
      "R-2026-0002",
    ]);
  });

  it("searchReceipts no devuelve el anulado al ⌘K", async () => {
    const hallados = await searchReceipts(stub(TABLAS), { q: "Cliente", limit: 5 });

    expect(hallados.map((r) => r.receipt_code)).not.toContain("R-2026-0002");
    expect(filtros).toContainEqual({
      table: "payment_receipts",
      op: "is",
      col: "deleted_at",
      val: null,
    });
  });

  it("getReceiptByCode no imprime el comprobante de un recibo anulado", async () => {
    const anulado = await getReceiptByCode(stub(TABLAS), {
      tenantId: "t1",
      code: "R-2026-0002",
    });
    expect(anulado).toBeNull();

    const vivo = await getReceiptByCode(stub(TABLAS), {
      tenantId: "t1",
      code: "R-2026-0001",
    });
    expect(vivo?.receipt_code).toBe("R-2026-0001");
  });

  it("sin el filtro, la URL del anulado lo abría igual (control del doble)", async () => {
    const anulado = await getReceiptByCode(stub(TABLAS_SIN_FILTRO), {
      tenantId: "t1",
      code: "R-2026-0002",
    });

    expect(anulado?.receipt_code).toBe("R-2026-0002");
  });

  it("listUnidentifiedReceipts saca el sin-ref anulado de la bandeja amarilla", async () => {
    const bandeja = await listUnidentifiedReceipts(stub(TABLAS));

    expect(bandeja.map((r) => r.receipt_code)).toEqual(["R-2026-0003"]);
  });

  it("fundsSeparationSummary no reparte plata de recibos anulados", async () => {
    const sep = await fundsSeparationSummary(stub(TABLAS), RANGO);

    expect(sep.thirdPartyUsd).toBe(1500); // 1000 del cobro vivo + 500 del sin-ref vivo
    expect(sep.localRevenueUsd).toBe(200);
    expect(sep.unidentifiedUsd).toBe(500);
    expect(sep.unidentifiedCount).toBe(1);
    expect(sep.receiptCount).toBe(3);
  });

  it("sin el filtro, la separación de fondos se infla 11× (control del doble)", async () => {
    const sep = await fundsSeparationSummary(stub(TABLAS_SIN_FILTRO), RANGO);

    expect(sep.thirdPartyUsd).toBe(17500);
    expect(sep.localRevenueUsd).toBe(500);
    expect(sep.unidentifiedUsd).toBe(7500);
    expect(sep.unidentifiedCount).toBe(2);
  });
});

// ── Hallazgo 2 · Tesorería ────────────────────────────────────

describe("Tesorería · una orden anulada no se lista ni se suma (SDD-0494)", () => {
  it("listPayments deja fuera la orden anulada", async () => {
    const ordenes = await listPayments(stub(TABLAS));

    expect(ordenes.map((p) => p.payment_code)).toEqual(["OP-2026-0001"]);
    expect(filtros).toContainEqual({
      table: "supplier_payments",
      op: "is",
      col: "deleted_at",
      val: null,
    });
  });

  it("listPayments filtrado por CxP tampoco la trae al historial del drawer", async () => {
    const ordenes = await listPayments(stub(TABLAS), { billId: "b-saldada" });

    expect(ordenes.map((p) => p.payment_code)).toEqual(["OP-2026-0001"]);
  });

  it("sin el filtro, la anulada ENCABEZARÍA el tab «Pagos» (control del doble)", async () => {
    const ordenes = await listPayments(stub(TABLAS_SIN_FILTRO));

    expect(ordenes.map((p) => p.payment_code)).toEqual([
      "OP-2026-0001",
      "OP-2026-0002",
    ]);
  });

  it("el KPI de pagado del mes no cuenta la orden anulada", async () => {
    const kpis = await treasuryKpis(stub(TABLAS), TODAY);

    expect(kpis.pagadoMes).toBe(400);
  });

  it("sin el filtro, el KPI pagaba 6.400 en vez de 400 (control del doble)", async () => {
    const kpis = await treasuryKpis(stub(TABLAS_SIN_FILTRO), TODAY);

    expect(kpis.pagadoMes).toBe(6400);
  });

  /**
   * Hallazgo lateral que destapó este mismo fixture: `listBills` tampoco pedía
   * `deleted_at is null`, así que una CxP borrada entraba a la cola y al KPI
   * «Por pagar». Hoy no hay camino en la app que ponga esa marca en una CxP
   * —anular es `status = 'anulada'`—, pero la base sí la trata como la de
   * liveness (índice parcial de la 0088, preflight de la 0468).
   */
  it("la cola de CxP no trae una CxP borrada", async () => {
    const kpis = await treasuryKpis(stub(TABLAS), TODAY);

    expect(kpis.porPagar).toBe(1000);
    expect(filtros).toContainEqual({
      table: "supplier_bills",
      op: "is",
      col: "deleted_at",
      val: null,
    });
  });

  it("sin el filtro, la CxP borrada sumaba 5.000 al «Por pagar» (control del doble)", async () => {
    const kpis = await treasuryKpis(
      stub({
        ...TABLAS,
        supplier_bills: TABLAS.supplier_bills.map((b) => ({
          ...b,
          deleted_at: null,
        })),
      }),
      TODAY,
    );

    expect(kpis.porPagar).toBe(6000);
  });
});

// ── Hallazgo 3 · la CxP saldada se puede consultar ────────────

describe("Tesorería · abrir una CxP saldada para anular su orden (SDD-0494)", () => {
  it("la cola NO trae la CxP saldada (por eso hacía falta la consulta)", async () => {
    const kpis = await treasuryKpis(stub(TABLAS), TODAY);

    // Solo la CxP con saldo: la saldada (400/400) y la borrada quedan fuera.
    expect(kpis.porPagar).toBe(1000);
    expect(kpis.proveedoresActivos).toBe(1);
  });

  it("payableForBill sí la trae, con saldo 0 y stage pagada", async () => {
    const payable = await payableForBill(stub(TABLAS), "b-saldada", TODAY);

    expect(payable?.bill.bill_code).toBe("CXP-2026-0001");
    expect(payable?.balance).toBe(0);
    expect(payable?.stage).toBe("pagada");
  });

  it("payableForBill devuelve null para una CxP borrada", async () => {
    const payable = await payableForBill(stub(TABLAS), "b-borrada", TODAY);

    expect(payable).toBeNull();
    expect(filtros).toContainEqual({
      table: "supplier_bills",
      op: "is",
      col: "deleted_at",
      val: null,
    });
  });

  it("payableForBill devuelve null sin id, sin consultar la base", async () => {
    const payable = await payableForBill(stub(TABLAS), "   ", TODAY);

    expect(payable).toBeNull();
    expect(filtros.filter((f) => f.table === "supplier_bills")).toEqual([]);
  });

  it("deriva el mismo stage que la cola para una CxP con saldo", async () => {
    const payable = await payableForBill(stub(TABLAS), "b-con-saldo", TODAY);

    // Vencía el 2026-06-01 y hoy es 2026-06-25.
    expect(payable?.balance).toBe(1000);
    expect(payable?.stage).toBe("vencida");
    expect(payable?.daysOverdue).toBe(24);
  });
});
