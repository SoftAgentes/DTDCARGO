/**
 * SDD-0556 · La card de una factura en el portal (Finanzas y la vista móvil de
 * Mis facturas). Una anulada con abono parcial mostraba «Saldo USD 700.00»: le
 * cobraba al cliente una factura que ya no existe.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PortalInvoiceRow } from "@/lib/portal/portal-types";
import { InvoiceRow } from "../InvoiceRow";

function inv(over: Partial<PortalInvoiceRow> = {}): PortalInvoiceRow {
  return {
    id: "i1",
    code: "F-2026-0001",
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 300,
    issuedAt: "2026-09-01",
    dueDate: "2026-09-30",
    shipmentCode: null,
    ...over,
  };
}

afterEach(cleanup);

describe("InvoiceRow", () => {
  it("una viva con saldo muestra su «Saldo» y el total sin tachar", () => {
    render(<InvoiceRow invoice={inv()} />);
    expect(screen.getByText("Saldo")).toBeInTheDocument();
    expect(screen.getByText("USD 700.00")).toBeInTheDocument();
    expect(screen.getByText("USD 1,000.00")).not.toHaveClass("line-through");
  });

  it("una anulada con abono no muestra «Saldo»: total tachado y lo recibido a la vista", () => {
    render(<InvoiceRow invoice={inv({ status: "anulada" })} />);
    expect(screen.queryByText("Saldo")).toBeNull();
    expect(screen.queryByText("USD 700.00")).toBeNull();
    expect(screen.getByText("USD 1,000.00")).toHaveClass("line-through");
    expect(screen.getByText("Recibido")).toBeInTheDocument();
    expect(screen.getByText("USD 300.00")).toBeInTheDocument();
  });

  it("una anulada sin pagos no dice «Recibido»", () => {
    render(<InvoiceRow invoice={inv({ status: "anulada", paid: 0 })} />);
    expect(screen.queryByText("Recibido")).toBeNull();
    expect(screen.queryByText("Saldo")).toBeNull();
  });
});
