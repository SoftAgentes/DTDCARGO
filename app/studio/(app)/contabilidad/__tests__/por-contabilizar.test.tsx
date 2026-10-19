/**
 * SDD-0557 · Contabilidad › Por contabilizar (solo lectura).
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  cruzarDocumentosConAsientos,
  type CuadreDelLibro,
} from "@/lib/studio/accounting/libro-control";
import { cuadreSubdiario } from "@/lib/studio/accounting/subdiario";
import { PorContabilizarTab } from "../_components/PorContabilizarTab";

function cuadre(conHallazgos: boolean): CuadreDelLibro {
  const documentos = cruzarDocumentosConAsientos(
    conHallazgos
      ? [
          { tipo: "factura", id: "f1", codigo: "F-2025-0001", fecha: "2025-03-05", moneda: "USD", monto: 1160, vivo: true },
          { tipo: "factura", id: "f9", codigo: "F-2025-0009", fecha: "2025-03-02", moneda: "USD", monto: 50, vivo: false },
        ]
      : [],
    conHallazgos
      ? [{ id: "e9", status: "asentado", source: "invoice", deleted_at: null, invoice_id: "f9", receipt_id: null, bill_id: null, supplier_payment_id: null }]
      : [],
  );
  return {
    fecha: "2025-03-18",
    documentos,
    subdiario: cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [{ status: "emitida", currency: "USD", fx_rate: null, total_amount: 1160, paid_amount: 0 }],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: { saldo: 0, debe: 0, haber: 0 },
      mayorProveedores: null,
    }),
  };
}

describe("PorContabilizarTab", () => {
  it("subdiario contra mayor, documentos sin asiento con enlace y el conteo de anulados", () => {
    render(<PorContabilizarTab cuadre={cuadre(true)} />);
    const filaClientes = screen.getByRole("rowheader", { name: /Clientes/ }).closest("tr")!;
    expect(within(filaClientes).getByText("No cuadra")).toBeInTheDocument();
    expect(within(filaClientes).getAllByText("1,160.00")).toHaveLength(2); // saldo y diferencia
    expect(screen.getByText("Cuenta no encontrada")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "F-2025-0001" })).toHaveAttribute("href", "/studio/facturacion/F-2025-0001");
    expect(screen.getByText("Sin asiento")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Factura: 1" })).toHaveAttribute("href", "/studio/facturacion");
  });

  it("sin hallazgos: estado vacío honesto y sin anulados con asiento", () => {
    render(<PorContabilizarTab cuadre={cuadre(false)} />);
    expect(screen.getByText("Todos los documentos tienen su asiento")).toBeInTheDocument();
    expect(screen.getByText("Ningún documento anulado conserva un asiento vivo.")).toBeInTheDocument();
  });
});
