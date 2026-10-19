/**
 * SDD-0281 · El mapeo de facturas del Studio al ledger del estado de cuenta.
 *
 * Es una función de tres líneas y aun así es la que puede **inventar deuda**: si
 * un borrador se cuela, aparece como cargo y el asesor le lee al cliente por
 * teléfono un saldo que no existe.
 *
 * SDD-0558: el estado de cuenta del Studio es IGUAL al del portal. Las anuladas
 * emitidas ya no se descartan acá: llegan al ledger compartido, que las pone
 * en 0 y saca lo que se les pagó a `voidedPayments` (la regla pasó al ledger
 * con SDD-0556). Descartarlas hacía desaparecer un abono real. Las anuladas
 * que nunca se emitieron se descartan, como en el portal.
 *
 * El test además comprueba lo que da sentido a toda la pantalla: que el saldo
 * del ERP y el del portal salgan del MISMO cálculo. Por eso no compara contra
 * números escritos a mano, sino contra `buildStatementLedger` corriendo sobre
 * las mismas filas.
 */

import { describe, it, expect } from "vitest";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
import { notaPagosEnAnuladas } from "@/lib/portal/saldo-de-cuenta";
import type { Invoice, InvoiceStatus } from "@/lib/studio/invoice-types";
import { filasParaLedger } from "../[markbox]/estado-de-cuenta/page";

function mkInvoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "i1",
    tenant_id: "t1",
    invoice_code: "F-2026-0001",
    client_markbox: "DTD-1234",
    client_name: "Cliente",
    shipment_id: null,
    shipment_code: "SHP-1",
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    iva_mode: null,
    base_amount: 1000,
    iva_amount: 0,
    total_amount: 1000,
    status: "emitida",
    issued_at: "2026-08-01",
    due_date: "2026-08-31",
    paid_amount: 0,
    last_payment_at: null,
    lines: [],
    notes: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as Invoice;
}

describe("filasParaLedger", () => {
  it("🔴 descarta los BORRADORES — un borrador no es deuda", () => {
    const filas = filasParaLedger([
      mkInvoice({ id: "a", invoice_code: "F-1" }),
      mkInvoice({ id: "b", invoice_code: "F-2", status: "borrador" as InvoiceStatus }),
    ]);
    expect(filas.map((f) => f.code)).toEqual(["F-1"]);
  });

  it("🔴 conserva las ANULADAS emitidas: el ledger compartido decide que no son deuda", () => {
    const filas = filasParaLedger([
      mkInvoice({ id: "a", invoice_code: "F-1" }),
      mkInvoice({ id: "b", invoice_code: "F-2", status: "anulada" as InvoiceStatus }),
    ]);
    expect(filas.map((f) => [f.code, f.status])).toEqual([
      ["F-1", "emitida"],
      ["F-2", "anulada"],
    ]);
  });

  it("descarta la anulada que nunca se emitió, como el portal", () => {
    const filas = filasParaLedger([
      mkInvoice({ id: "a", invoice_code: "F-1" }),
      mkInvoice({ id: "b", invoice_code: "F-2", status: "anulada" as InvoiceStatus, issued_at: null }),
    ]);
    expect(filas.map((f) => f.code)).toEqual(["F-1"]);
  });

  it("conserva emitidas, parciales, pagadas y vencidas", () => {
    const estados: InvoiceStatus[] = ["emitida", "parcial", "pagada", "vencida"];
    const filas = filasParaLedger(
      estados.map((s, i) => mkInvoice({ id: `i${i}`, invoice_code: `F-${i}`, status: s })),
    );
    expect(filas).toHaveLength(4);
  });

  it("traduce los nombres de columna sin perder el envío ni las fechas", () => {
    const [fila] = filasParaLedger([
      mkInvoice({ total_amount: 1500, paid_amount: 500, shipment_code: "SHP-9" }),
    ]);
    expect(fila).toEqual({
      id: "i1",
      code: "F-2026-0001",
      status: "emitida",
      currency: "USD",
      total: 1500,
      paid: 500,
      issuedAt: "2026-08-01",
      dueDate: "2026-08-31",
      shipmentCode: "SHP-9",
    });
  });
});

describe("el saldo del ERP = el saldo del portal", () => {
  it("una anulada se conserva y el ledger no la cuenta como deuda", () => {
    const vivas = [
      mkInvoice({ id: "a", invoice_code: "F-1", total_amount: 1000, paid_amount: 400 }),
      mkInvoice({ id: "b", invoice_code: "F-2", total_amount: 600 }),
    ];
    const conOtras = [
      ...vivas,
      mkInvoice({ id: "c", invoice_code: "F-3", total_amount: 9999, status: "anulada" as InvoiceStatus }),
      mkInvoice({ id: "d", invoice_code: "F-4", total_amount: 5555, status: "borrador" as InvoiceStatus }),
    ];

    const limpio = buildStatementLedger(filasParaLedger(vivas));
    const conAnulada = buildStatementLedger(filasParaLedger(conOtras));

    expect(conAnulada.balance).toBe(limpio.balance);
    expect(conAnulada.balance).toBe(1200); // 1600 facturado − 400 abonado
    expect(conAnulada.totalCargo).toBe(1600);
    // La anulada está en el libro, con cargo 0.
    expect(conAnulada.moves.find((m) => m.concept === "Factura F-3 · anulada")?.amount).toBe(0);
  });

  it("⭐ una anulada CON abono no desaparece: su pago va aparte y no se descuenta", () => {
    const ledger = buildStatementLedger(
      filasParaLedger([
        mkInvoice({ id: "a", invoice_code: "F-1", total_amount: 1000, paid_amount: 0 }),
        mkInvoice({ id: "b", invoice_code: "F-2", total_amount: 800, paid_amount: 300,
          status: "anulada" as InvoiceStatus }),
      ]),
    );
    expect(ledger.balance).toBe(1000);
    expect(ledger.voidedPayments).toEqual([
      { code: "F-2", reference: "SHP-1", amount: 300, currency: "USD" },
    ]);
    expect(notaPagosEnAnuladas(ledger.voidedPayments)).toContain("USD 300.00");
  });

  it("delega la moneda al ledger compartido, que sigue a la DEUDA, no al mayor facturado", () => {
    // Dos monedas: VES tiene el mayor total facturado, pero ya está pagada; la
    // deuda está en USD. El ledger (`monedaDominante`, SDD-0556) se queda con
    // la moneda que lleva la deuda y lo DICE. El mapeo no filtra por moneda a
    // propósito: esa regla vive en un solo lugar y es la misma que ve el cliente.
    const l = buildStatementLedger(
      filasParaLedger([
        mkInvoice({ id: "a", invoice_code: "F-1", currency: "USD", total_amount: 100 }),
        mkInvoice({ id: "b", invoice_code: "F-2", currency: "VES", total_amount: 900, paid_amount: 900,
          status: "pagada" as InvoiceStatus }),
      ]),
    );
    expect(l.currency).toBe("USD");
    expect(l.mixedCurrencies).toBe(true);
  });
});
