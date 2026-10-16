/**
 * SDD-0543 · La puerta de una factura por aceptar: muestra el monto y el
 * embarque, pide aceptar los T&C y NO pinta conceptos ni PDF.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PendingInvoiceGate } from "./PendingInvoiceGate";

afterEach(cleanup);

const pendiente = {
  code: "F-2026-0007",
  baseAmount: 876.78,
  totalAmount: 876.78,
  currency: "USD",
  shipmentCode: "DTD-A116-06",
  cbm: 1.022,
  weightKg: 408.55,
  invoiceId: "i1",
  shipmentId: "s1",
  clientName: "Cliente Prueba",
  ivaRate: 0,
  ivaAmount: 0,
  fxRate: null,
  lines: [{ desc: "Flete DDP · DTD-A116-06 · 1.022 m³ × $750", qty: 1.022, unitPrice: 750 }],
  notes: null,
};

describe("PendingInvoiceGate", () => {
  it("pide aceptar los T&C y lleva al flujo de aceptación", () => {
    render(<PendingInvoiceGate pendiente={pendiente} />);
    expect(screen.getByText("F-2026-0007")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /aceptar los T&C del portal para ver el detalle/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revisar y aceptar/ })).toHaveAttribute(
      "href",
      "/portal/facturas/F-2026-0007/aceptar",
    );
    expect(screen.getByText("DTD-A116-06")).toBeInTheDocument();
    expect(screen.getByText("1.022 m³ · 408.55 kg")).toBeInTheDocument();
  });
  it("muestra el monto pero ningún concepto de la factura", () => {
    render(<PendingInvoiceGate pendiente={pendiente} />);
    expect(screen.getByText(/876[.,]78/)).toBeInTheDocument();
    // Ni la línea de la factura, ni el bloque «Conceptos», ni el PDF del detalle real.
    expect(screen.queryByText(/Flete DDP/)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Conceptos/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /PDF/ })).toBeNull();
  });
  it("sin embarque ni medida pinta guiones, no vacíos", () => {
    render(<PendingInvoiceGate pendiente={{ ...pendiente, shipmentCode: null, cbm: null, weightKg: null }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
