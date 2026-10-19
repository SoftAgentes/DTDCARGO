/**
 * SDD-0556 · Una sola definición de deuda para el portal.
 *
 * El módulo es nuevo, así que su control rojo está en los consumidores (Inicio,
 * Facturas, Finanzas, ledger) y en los mutantes de la tarea: quitar la anulada
 * de lo facturado o de lo que falta pagar, pesar la moneda con las anuladas o
 * sumar en lo pagado lo de las anuladas tiene que dejar algún caso en rojo.
 *
 * El contrato con `buildStatementLedger` ata las dos lecturas: si los KPIs y el
 * libro se separan, el cliente ve un saldo arriba y otro abajo.
 */
import { describe, expect, it } from "vitest";
import {
  esAnulada,
  esAnuladaSinEmitir,
  monedaDominante,
  notaPagosEnAnuladas,
  pagosEnAnuladas,
  resumenDeCuenta,
  saldoPorPagar,
} from "../saldo-de-cuenta";
import { buildStatementLedger } from "../statement-ledger";
import type { PortalInvoiceRow } from "../portal-types";

function inv(over: Partial<PortalInvoiceRow> = {}): PortalInvoiceRow {
  return {
    id: "i1",
    code: "F-2026-0001",
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 0,
    issuedAt: "2026-07-01",
    dueDate: "2026-07-31",
    shipmentCode: "DTD-2026-0311",
    ...over,
  };
}

const VIVA = inv({ id: "v", code: "F-VIVA", total: 1000, paid: 400 });
const ANULADA_SIN_PAGO = inv({ id: "a1", code: "F-ANULADA-1", status: "anulada", total: 9999 });
const ANULADA_CON_PAGO = inv({ id: "a2", code: "F-ANULADA-2", status: "anulada", total: 500, paid: 300 });

describe("esAnulada / esAnuladaSinEmitir", () => {
  it("sólo el estado «anulada» es anulada", () => {
    expect(esAnulada(inv({ status: "anulada" }))).toBe(true);
    for (const status of ["emitida", "parcial", "pagada", "vencida"] as const) {
      expect(esAnulada(inv({ status }))).toBe(false);
    }
  });

  it("una anulada sin fecha de emisión es un borrador anulado; con fecha, no", () => {
    expect(esAnuladaSinEmitir(inv({ status: "anulada", issuedAt: null }))).toBe(true);
    expect(esAnuladaSinEmitir(inv({ status: "anulada", issuedAt: "2026-07-01" }))).toBe(false);
    expect(esAnuladaSinEmitir(inv({ status: "emitida", issuedAt: null }))).toBe(false);
  });
});

describe("saldoPorPagar", () => {
  it("una anulada no se debe, se le haya pagado algo o no", () => {
    expect(saldoPorPagar(inv({ status: "anulada", total: 1000, paid: 0 }))).toBe(0);
    expect(saldoPorPagar(inv({ status: "anulada", total: 1000, paid: 300 }))).toBe(0);
  });

  it("una viva debe total − pagado, y un sobrepago no es deuda negativa", () => {
    expect(saldoPorPagar(inv({ total: 1000, paid: 400 }))).toBe(600);
    expect(saldoPorPagar(inv({ total: 1000, paid: 1200 }))).toBe(0);
  });
});

describe("monedaDominante", () => {
  it("una anulada VES de 9999 no le gana a un USD vivo de 500, ni dispara «otras monedas»", () => {
    const r = monedaDominante([
      inv({ currency: "VES", status: "anulada", total: 9999 }),
      inv({ currency: "USD", total: 500 }),
    ]);
    expect(r).toEqual({ currency: "USD", mixed: false });
  });

  it("dos monedas vigentes sí son mixtas, y gana la de mayor total", () => {
    expect(
      monedaDominante([
        inv({ currency: "USD", total: 100 }),
        inv({ currency: "VES", total: 900 }),
      ]),
    ).toEqual({ currency: "VES", mixed: true });
  });

  it("sólo anuladas: la moneda de la primera fila; sin filas: USD", () => {
    expect(
      monedaDominante([
        inv({ currency: "VES", status: "anulada" }),
        inv({ currency: "USD", status: "anulada" }),
      ]),
    ).toEqual({ currency: "VES", mixed: false });
    expect(monedaDominante([])).toEqual({ currency: "USD", mixed: false });
  });

  it("a igual peso gana la moneda que tiene facturas vigentes", () => {
    // Una viva de 0 (raro, pero existe) en USD contra una anulada VES primero
    // en la lista: el ledger no puede quedar en la moneda de la anulada.
    expect(
      monedaDominante([
        inv({ currency: "VES", status: "anulada", total: 50 }),
        inv({ currency: "USD", total: 0 }),
      ]).currency,
    ).toBe("USD");
  });
});

describe("resumenDeCuenta", () => {
  it("con [viva 1000/400, anulada 9999/0, anulada 500/300] sólo la viva es deuda", () => {
    const r = resumenDeCuenta([VIVA, ANULADA_SIN_PAGO, ANULADA_CON_PAGO]);
    expect(r).toMatchObject({
      currency: "USD",
      mixedCurrencies: false,
      facturado: 1000,
      pagado: 400,
      porPagar: 600,
      facturasPorPagar: 1,
    });
    expect(r.pagosEnAnuladas).toEqual([
      { code: "F-ANULADA-2", reference: "DTD-2026-0311", amount: 300, currency: "USD" },
    ]);
  });

  it("sólo anuladas: nada facturado ni por pagar, y la moneda de la primera fila", () => {
    const r = resumenDeCuenta([
      inv({ currency: "VES", status: "anulada", total: 800, paid: 0 }),
      inv({ code: "F-2", currency: "USD", status: "anulada", total: 100, paid: 20 }),
    ]);
    expect(r).toMatchObject({ currency: "VES", facturado: 0, pagado: 0, porPagar: 0, facturasPorPagar: 0 });
    expect(r.pagosEnAnuladas.map((p) => p.currency)).toEqual(["USD"]);
  });

  it("los pagos en anuladas se reúnen de TODAS las monedas, cada uno con la suya", () => {
    // Una anulada VES 500/200 con USD dominante sigue en la nota.
    const r = resumenDeCuenta([
      inv({ code: "F-USD", currency: "USD", total: 1000 }),
      inv({ code: "F-VES", currency: "VES", status: "anulada", total: 500, paid: 200 }),
    ]);
    expect(r.currency).toBe("USD");
    expect(r.mixedCurrencies).toBe(false);
    expect(r.pagosEnAnuladas).toEqual([
      { code: "F-VES", reference: "DTD-2026-0311", amount: 200, currency: "VES" },
    ]);
  });

  it("facturasPorPagar cuenta en todas las monedas; los montos, sólo en la dominante", () => {
    const r = resumenDeCuenta([
      inv({ code: "F-1", currency: "USD", total: 1000, paid: 0 }),
      inv({ code: "F-2", currency: "VES", total: 300, paid: 0 }),
    ]);
    expect(r.currency).toBe("USD");
    expect(r.porPagar).toBe(1000);
    expect(r.facturasPorPagar).toBe(2);
  });

  it("el saldo pendiente recorta el sobrepago por factura (lo que falta pagar, no un neto)", () => {
    const r = resumenDeCuenta([
      inv({ code: "F-1", total: 1000, paid: 1200 }),
      inv({ code: "F-2", total: 500, paid: 0 }),
    ]);
    expect(r.porPagar).toBe(500);
  });
});

describe("contrato: KPIs y ledger salen de la misma definición", () => {
  const FIXTURES: PortalInvoiceRow[][] = [
    [VIVA, ANULADA_SIN_PAGO, ANULADA_CON_PAGO],
    [
      inv({ code: "U1", currency: "USD", total: 700, paid: 100 }),
      inv({ code: "V1", currency: "VES", total: 9000, status: "anulada", paid: 50 }),
      inv({ code: "V2", currency: "VES", total: 200 }),
      inv({ code: "U2", currency: "USD", total: 300, status: "anulada", paid: 300 }),
    ],
    [inv({ code: "S1", status: "anulada", total: 10, paid: 10 })],
    [],
  ];

  it.each(FIXTURES.map((f, i) => [i, f] as const))("fixture %i", (_i, facturas) => {
    const r = resumenDeCuenta(facturas);
    const l = buildStatementLedger(facturas);
    expect(r.currency).toBe(l.currency);
    expect(r.mixedCurrencies).toBe(l.mixedCurrencies);
    expect(r.facturado).toBe(l.totalCargo);
    expect(r.pagado).toBe(l.totalAbono);
    expect(r.pagosEnAnuladas).toEqual(l.voidedPayments);
  });
});

describe("pagosEnAnuladas / notaPagosEnAnuladas", () => {
  it("sin pagos en anuladas no hay nota", () => {
    expect(pagosEnAnuladas([VIVA, ANULADA_SIN_PAGO])).toEqual([]);
    expect(notaPagosEnAnuladas([])).toBeNull();
  });

  it("una sola moneda: monto, códigos y que no se descuenta", () => {
    expect(notaPagosEnAnuladas(pagosEnAnuladas([VIVA, ANULADA_CON_PAGO]))).toBe(
      "Recibimos USD 300.00 en pagos de facturas que después se anularon (F-ANULADA-2). " +
        "No se descuentan de tu saldo pendiente: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución.",
    );
  });

  it("varias monedas: un monto por moneda, nunca sumados entre sí", () => {
    const nota = notaPagosEnAnuladas([
      { code: "F-1", reference: null, amount: 100, currency: "USD" },
      { code: "F-2", reference: null, amount: 200, currency: "VES" },
      { code: "F-3", reference: null, amount: 50, currency: "USD" },
    ]);
    expect(nota).toMatch(/^Recibimos USD 150\.00 y VES 200\.00 en pagos de facturas que después se anularon \(F-1, F-2, F-3\)\./);
    expect(nota).not.toMatch(/saldo a favor/i);
  });
});
