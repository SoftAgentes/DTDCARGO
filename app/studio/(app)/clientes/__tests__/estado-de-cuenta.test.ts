/**
 * SDD-0281 · El mapeo de facturas del Studio al ledger del estado de cuenta.
 *
 * Es una función de tres líneas y aun así es la que puede **inventar deuda**: si
 * un borrador o una anulada se cuelan, aparecen como cargo y el asesor le lee al
 * cliente por teléfono un saldo que no existe.
 *
 * El test además comprueba lo que da sentido a toda la pantalla: que el saldo
 * del ERP y el del portal salgan del MISMO cálculo. Por eso no compara contra
 * números escritos a mano, sino contra `buildStatementLedger` corriendo sobre
 * las mismas filas.
 */

import { describe, it, expect } from "vitest";
import { buildStatementLedger } from "@/lib/portal/statement-ledger";
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

  it("🔴 descarta las ANULADAS — dejaron de ser deuda", () => {
    const filas = filasParaLedger([
      mkInvoice({ id: "a", invoice_code: "F-1" }),
      mkInvoice({ id: "b", invoice_code: "F-2", status: "anulada" as InvoiceStatus }),
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
  it("una anulada no mueve el saldo que se le lee al cliente", () => {
    const vivas = [
      mkInvoice({ id: "a", invoice_code: "F-1", total_amount: 1000, paid_amount: 400 }),
      mkInvoice({ id: "b", invoice_code: "F-2", total_amount: 600 }),
    ];
    const conBasura = [
      ...vivas,
      mkInvoice({ id: "c", invoice_code: "F-3", total_amount: 9999, status: "anulada" as InvoiceStatus }),
      mkInvoice({ id: "d", invoice_code: "F-4", total_amount: 5555, status: "borrador" as InvoiceStatus }),
    ];

    const limpio = buildStatementLedger(filasParaLedger(vivas));
    const filtrado = buildStatementLedger(filasParaLedger(conBasura));

    expect(filtrado.balance).toBe(limpio.balance);
    expect(filtrado.balance).toBe(1200); // 1600 facturado − 400 abonado
    expect(filtrado.totalCargo).toBe(1600);
  });

  it("delega la moneda dominante al ledger compartido, no la decide acá", () => {
    // Dos monedas: el ledger se queda con la de mayor total facturado y lo
    // DICE. El mapeo no filtra por moneda a propósito — esa regla vive en un
    // solo lugar y es la misma que ve el cliente.
    const l = buildStatementLedger(
      filasParaLedger([
        mkInvoice({ id: "a", invoice_code: "F-1", currency: "USD", total_amount: 100 }),
        mkInvoice({ id: "b", invoice_code: "F-2", currency: "VES", total_amount: 900 }),
      ]),
    );
    expect(l.currency).toBe("VES");
    expect(l.mixedCurrencies).toBe(true);
  });
});
