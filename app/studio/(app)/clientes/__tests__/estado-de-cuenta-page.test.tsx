/**
 * SDD-0558 · La pantalla del estado de cuenta del Studio muestra las MISMAS
 * notas que el portal y el PDF: los pagos recibidos en facturas anuladas
 * (`notaPagosEnAnuladas`) y lo pagado de más (`notaSobrepagos`, en el libro).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/studio/invoice-types";

const state = vi.hoisted(() => ({ invoices: [] as Partial<Invoice>[] }));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ requireModuleView: async () => undefined }));
vi.mock("@/lib/studio/client-queries", () => ({
  getClientByMarkbox: async () => ({ id: "c1", markbox: "DTD-0001", name: "Cliente sintético" }),
}));
vi.mock("@/lib/studio/invoice-queries", () => ({
  listInvoices: async () => state.invoices,
}));

import EstadoDeCuentaPage from "../[markbox]/estado-de-cuenta/page";

afterEach(cleanup);

function inv(over: Partial<Invoice>): Partial<Invoice> {
  return {
    id: "i1", invoice_code: "F-1", status: "emitida", currency: "USD",
    total_amount: 1000, paid_amount: 0, issued_at: "2026-08-01", due_date: "2026-08-31",
    shipment_code: null, ...over,
  };
}

async function montar() {
  render(await EstadoDeCuentaPage({ params: Promise.resolve({ markbox: "DTD-0001" }) }));
}

describe("Estado de cuenta del Studio · notas del portal (SDD-0558)", () => {
  it("una anulada con abono aparece en el libro y su pago en la nota, sin descontarse", async () => {
    state.invoices = [
      inv({ id: "a", invoice_code: "F-1" }),
      inv({ id: "b", invoice_code: "F-2", status: "anulada", total_amount: 800, paid_amount: 300 }),
    ];
    await montar();
    expect(screen.getByText("Lo que el cliente ve en su portal y en el PDF")).toBeTruthy();
    expect(screen.getByText(/Recibimos USD 300\.00 en pagos de facturas que después se anularon \(F-2\)/)).toBeTruthy();
    expect(screen.getByText("Factura F-2 · anulada")).toBeTruthy();
  });

  it("un sobrepago se explica con la nota del libro", async () => {
    state.invoices = [
      inv({ id: "a", invoice_code: "F-1", status: "pagada", total_amount: 100, paid_amount: 150 }),
      inv({ id: "b", invoice_code: "F-2", total_amount: 80 }),
    ];
    await montar();
    expect(screen.getByText(/Este saldo ya descuenta USD 50\.00 pagados de más/)).toBeTruthy();
    expect(screen.getByText(/lo que falta pagar es USD 80\.00/)).toBeTruthy();
  });

  it("sin anuladas con abono ni sobrepagos no hay nota", async () => {
    state.invoices = [inv({ id: "a", invoice_code: "F-1" })];
    await montar();
    expect(screen.queryByText("Lo que el cliente ve en su portal y en el PDF")).toBeNull();
  });
});
