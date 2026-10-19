/**
 * SDD-0556 · El estado de cuenta del portal con facturas anuladas.
 *
 * La anulada sale en el libro como fila en 0 y no mueve el saldo. Lo que se
 * pagó en ella no desaparece: va en una nota bajo la tabla, con el mismo texto
 * que los KPIs y el PDF. Antes la anulada entraba como cargo completo y su pago
 * como abono, y el saldo mezclaba una deuda que ya no existe.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import { StatementLedgerTable } from "./StatementLedgerTable";

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
    shipmentCode: null,
    ...over,
  };
}

afterEach(cleanup);

describe("StatementLedgerTable · anuladas (SDD-0556)", () => {
  it("la anulada se ve en 0, el total del libro no la cuenta y su pago va en la nota", () => {
    render(
      <StatementLedgerTable
        invoices={[
          inv({ id: "v", code: "F-VIVA", total: 1000, paid: 0 }),
          inv({ id: "a", code: "F-ANULADA", status: "anulada", total: 500, paid: 200, issuedAt: "2026-07-05" }),
        ]}
      />,
    );
    expect(screen.getByText("Factura F-ANULADA · anulada")).toBeInTheDocument();
    expect(screen.queryByText("Abono · F-ANULADA")).toBeNull();
    // Total de cargos: sólo la viva.
    expect(screen.getByText("Totales").parentElement).toHaveTextContent("USD 1,000.00");
    expect(screen.getByText("Totales").parentElement).not.toHaveTextContent("USD 1,500.00");
    expect(
      screen.getByText(
        "Recibimos USD 200.00 en pagos de facturas que después se anularon (F-ANULADA). " +
          "No se descuentan de tu saldo pendiente: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución.",
      ),
    ).toBeInTheDocument();
  });

  it("sin pagos en anuladas no hay nota", () => {
    render(
      <StatementLedgerTable
        invoices={[
          inv({ id: "v", code: "F-VIVA", total: 1000, paid: 400 }),
          inv({ id: "a", code: "F-ANULADA", status: "anulada", total: 500, paid: 0 }),
        ]}
      />,
    );
    expect(screen.queryByText(/facturas que después se anularon/)).toBeNull();
  });
});

describe("StatementLedgerTable · sobrepagos (SDD-0556)", () => {
  it("con un sobrepago, el saldo neto lleva la nota de lo pagado de más", () => {
    // El KPI «Saldo pendiente» dice USD 200.00 (recorta P1 a 0) y el libro
    // USD 180.00 (neto). La nota explica los 20 de diferencia.
    render(
      <StatementLedgerTable
        invoices={[
          inv({ id: "p1", code: "F-P1", status: "pagada", total: 100, paid: 120 }),
          inv({ id: "p2", code: "F-P2", total: 200, paid: 0, issuedAt: "2026-07-05" }),
        ]}
      />,
    );
    expect(screen.getByText("Totales").parentElement).toHaveTextContent("USD 180.00");
    expect(
      screen.getByText(
        "Incluye USD 20.00 pagados de más en facturas ya pagadas; tu asesor los aplica o te los devuelve.",
      ),
    ).toBeInTheDocument();
  });

  it("sin sobrepagos no hay nota", () => {
    render(<StatementLedgerTable invoices={[inv({ total: 1000, paid: 400 })]} />);
    expect(screen.queryByText(/pagados de más/)).toBeNull();
  });
});
