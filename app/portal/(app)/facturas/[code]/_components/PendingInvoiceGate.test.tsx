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
  embarques: [],
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
  it("con varios embarques lista sus códigos y suma la medida de todos: nunca la de uno junto al monto de todos", () => {
    render(
      <PendingInvoiceGate
        pendiente={{
          ...pendiente,
          embarques: [
            { code: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 },
            { code: "DTD-A116-08", cbm: 0.5, weightKg: 120 },
            { code: "DTD-A116-09", cbm: null, weightKg: null },
          ],
        }}
      />,
    );
    expect(screen.getByText("Embarques (3)")).toBeInTheDocument();
    expect(screen.getByText("DTD-A116-06 · DTD-A116-08 · DTD-A116-09")).toBeInTheDocument();
    expect(screen.getByText("Medida total")).toBeInTheDocument();
    expect(screen.getByText("1.522 m³ · 528.55 kg")).toBeInTheDocument();
    expect(screen.getByText(/Suma de los 3 embarques; el monto también los cubre a todos/)).toBeInTheDocument();
    expect(screen.queryByText("1.022 m³ · 408.55 kg")).toBeNull();
    expect(screen.queryByText("Embarque")).toBeNull();
  });
  it("con un solo embarque en las líneas se ve como siempre", () => {
    render(<PendingInvoiceGate pendiente={{ ...pendiente, embarques: [{ code: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 }] }} />);
    expect(screen.getByText("Embarque")).toBeInTheDocument();
    expect(screen.getByText("DTD-A116-06")).toBeInTheDocument();
    expect(screen.getByText("1.022 m³ · 408.55 kg")).toBeInTheDocument();
    expect(screen.queryByText(/Suma de los/)).toBeNull();
  });
});
