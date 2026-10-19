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
      facturas: [{ status: "emitida", currency: "USD", fx_rate: null, total_amount: 1160, paid_amount: 0, asientoVivo: false }],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      // 1.1.2 con movimiento (un debe y un haber que se anulan): hay con qué comparar.
      mayorClientes: { saldo: 0, debe: 300, haber: 300 },
      mayorProveedores: null,
    }),
  };
}

/** El trazo del check de éxito de `StatusIcon` (components/StatusIcon.tsx). */
const CHECK_DE_EXITO = 'path[d="m7 12 3 3 7-7"]';

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
    // El denominador son las vivas: f1 viva sin asiento; f9 anulada, aparte.
    // Con la anulada adentro diría «1 sin asiento de 2».
    expect(screen.getByTestId("conteo-factura")).toHaveTextContent("Factura: 1 sin asiento de 1 viva · 1 anulada aparte");
  });

  it("proveedores con una CxP en yuanes sin tasa: la nota dice que el saldo no está en USD", () => {
    const base = cuadre(false);
    render(
      <PorContabilizarTab
        cuadre={{
          ...base,
          subdiario: cuadreSubdiario({
            fecha: "2025-03-18",
            facturas: [],
            cxp: [{ status: "pendiente", currency: "CNY", fx_rate: null, total_amount: 70000, paid_amount: 0 }],
            recibosNoUsdConAsiento: 0,
            mayorClientes: { saldo: 0, debe: 0, haber: 0 },
            mayorProveedores: { saldo: 70000, debe: 0, haber: 70000 },
          }),
        }}
      />,
    );
    expect(screen.getByText(/1 CxP sin tasa va al nominal, como su asiento: el saldo no está en USD\./)).toBeInTheDocument();
  });

  it("1.1.2 sin movimiento con una factura abierta en VES (decisión 6): «Sin movimiento en el mayor», sin diferencia y con su nota", () => {
    const base = cuadre(false);
    render(
      <PorContabilizarTab
        cuadre={{
          ...base,
          subdiario: cuadreSubdiario({
            fecha: "2025-03-18",
            facturas: [{ status: "emitida", currency: "VES", fx_rate: 36.5, total_amount: 36500, paid_amount: 0, asientoVivo: false }],
            cxp: [],
            recibosNoUsdConAsiento: 0,
            mayorClientes: { saldo: 0, debe: 0, haber: 0 },
            // Control: 2.1.1 con movimiento y sin CxP abiertas cuadra, con su check.
            mayorProveedores: { saldo: 0, debe: 50, haber: 50 },
          }),
        }}
      />,
    );
    const filaClientes = screen.getByRole("rowheader", { name: /Clientes/ }).closest("tr")!;
    expect(within(filaClientes).getByText("Sin movimiento en el mayor")).toBeInTheDocument();
    expect(within(filaClientes).queryByText("No comparable")).toBeNull();
    // Saldo de documentos 1,000.00; mayor 0.00; diferencia «—».
    expect(within(filaClientes).getByText("1,000.00")).toBeInTheDocument();
    expect(within(filaClientes).getByText("—")).toBeInTheDocument();
    // Es un aviso: el ícono que se pinta es el triángulo de aviso, no el check.
    expect(filaClientes.querySelector(CHECK_DE_EXITO)).toBeNull();
    expect(filaClientes.querySelector('path[d="M12 3 2 21h20L12 3Zm0 6v5m0 3h.01"]')).not.toBeNull();
    const filaProveedores = screen.getByRole("rowheader", { name: /Proveedores/ }).closest("tr")!;
    expect(within(filaProveedores).getByText("Cuadra")).toBeInTheDocument();
    expect(filaProveedores.querySelector(CHECK_DE_EXITO)).not.toBeNull();
    expect(
      screen.getByText(/Sin movimiento en el mayor \(cuenta 1\.1\.2\): las facturas abiertas no llegaron al mayor\./),
    ).toBeInTheDocument();
  });

  it("sin hallazgos: estado vacío honesto y sin anulados con asiento", () => {
    render(<PorContabilizarTab cuadre={cuadre(false)} />);
    expect(screen.getByText("Todos los documentos tienen su asiento")).toBeInTheDocument();
    expect(screen.getByText("Ningún documento anulado conserva un asiento vivo.")).toBeInTheDocument();
  });
});
