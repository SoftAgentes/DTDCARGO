/**
 * SDD-0556 · Finanzas usa la MISMA definición de deuda que Facturas e Inicio.
 *
 * Antes tenía su propia copia del cálculo: sumaba las anuladas a lo facturado y
 * al saldo pendiente, y no decía nada de lo que se había pagado en ellas. Se
 * renderiza la página real con sus consultas simuladas.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ facturas: [] as unknown[] }));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/portal/demo", () => ({ showNortePortal: () => false }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: async () => ({ id: "c1", markbox: "DTD-8001", name: "Cliente Prueba" }),
  listMyInvoices: async () => h.facturas,
  listMyShipments: async () => [],
  listMyEstimates: async () => [],
}));

import PortalFinanzasPage from "./page";

function factura(over: Record<string, unknown>) {
  return {
    id: String(over.code),
    status: "emitida",
    currency: "USD",
    total: 1000,
    paid: 0,
    issuedAt: "2026-09-01",
    dueDate: "2026-09-30",
    shipmentCode: null,
    ...over,
  };
}

function kpi(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

async function abrir() {
  render(await PortalFinanzasPage());
}

afterEach(() => {
  cleanup();
  h.facturas = [];
});

describe("/portal/finanzas · KPIs sin anuladas (SDD-0556)", () => {
  it("lo facturado y el saldo pendiente no cuentan las anuladas; la nota informa lo pagado en ellas", async () => {
    // Antes: facturado USD 11,499.00 y saldo USD 10,799.00.
    h.facturas = [
      factura({ code: "F-VIVA", total: 1000, paid: 400 }),
      factura({ code: "F-ANULADA-1", status: "anulada", total: 9999 }),
      factura({ code: "F-ANULADA-2", status: "anulada", total: 500, paid: 300 }),
    ];
    await abrir();
    expect(kpi("Total facturado")).toHaveTextContent("USD 1,000.00");
    expect(kpi("Pagado")).toHaveTextContent("USD 400.00");
    expect(kpi("Saldo pendiente")).toHaveTextContent("USD 600.00");
    expect(
      screen.getByText(/Recibimos USD 300\.00 en pagos de facturas que después se anularon \(F-ANULADA-2\)\. No se descuentan de tu saldo pendiente/),
    ).toBeInTheDocument();
  });

  it("una anulada en otra moneda no cambia la moneda de los KPIs ni avisa de otras monedas", async () => {
    h.facturas = [
      factura({ code: "F-USD", total: 500 }),
      factura({ code: "F-VES", currency: "VES", status: "anulada", total: 999999, paid: 100 }),
    ];
    await abrir();
    expect(kpi("Total facturado")).toHaveTextContent("USD 500.00");
    expect(screen.queryByText(/Tienes facturas en otras monedas/)).toBeNull();
    // Su pago no desaparece por estar en otra moneda.
    expect(screen.getByText(/Recibimos VES 100\.00 en pagos de facturas que después se anularon/)).toBeInTheDocument();
  });

  it("la anulada sigue en la lista con el monto tachado y sin «Saldo»", async () => {
    h.facturas = [factura({ code: "F-ANULADA-2", status: "anulada", total: 500, paid: 300 })];
    await abrir();
    const fila = screen.getByRole("link", { name: "Ver detalle de la factura F-ANULADA-2" });
    expect(within(fila).getByText("USD 500.00")).toHaveClass("line-through");
    expect(within(fila).queryByText("Saldo")).toBeNull();
  });

  it("sin anuladas no hay nota", async () => {
    h.facturas = [factura({ code: "F-VIVA", total: 1000, paid: 400 })];
    await abrir();
    expect(screen.queryByText(/facturas que después se anularon/)).toBeNull();
    expect(kpi("Saldo pendiente")).toHaveTextContent("USD 600.00");
  });
});
