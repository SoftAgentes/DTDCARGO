/**
 * SDD-0556 · La portada del portal cuando las facturas no se pudieron leer.
 *
 * Antes, un error al leer facturas devolvía una lista vacía y la portada decía
 * «Saldo pendiente USD 0.00 · al día»: un dato falso con cara de verdad. Ahora
 * `getDashboardKpis` marca `invoicesAvailable: false` y la portada dice «No
 * disponible», sin tumbar envíos ni el resto del tablero.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PortalClient, PortalDashboardKpis } from "@/lib/portal/portal-types";
import { PortalDashboardNorte } from "./PortalDashboardNorte";

const cliente: PortalClient = {
  id: "c1",
  markbox: "DTD-TEST",
  name: "Cliente Prueba",
  email: null,
  phone: null,
  address: null,
  docKind: null,
  rif: null,
  city: null,
  state: null,
};

function kpis(over: Partial<PortalDashboardKpis> = {}): PortalDashboardKpis {
  return {
    activeShipments: 2,
    deliveredYtd: 1,
    invoicesAvailable: true,
    invoicedTotal: 1000,
    outstandingBalance: 600,
    currency: "USD",
    mixedCurrencies: false,
    pendingInvoiceCount: 1,
    ...over,
  };
}

function montar(k: PortalDashboardKpis) {
  render(
    <PortalDashboardNorte
      client={cliente}
      kpis={k}
      nextArrival={null}
      nextArrivalNaviera={null}
      shipments={[]}
    />,
  );
}

/** La tarjeta KPI de una etiqueta (la etiqueta está en su primera fila). */
function tarjeta(label: string): HTMLElement {
  const etiquetas = screen.getAllByText(label);
  return etiquetas[0].parentElement!.parentElement as HTMLElement;
}

afterEach(cleanup);

describe("PortalDashboardNorte · facturas no disponibles (SDD-0556)", () => {
  it("con las facturas leídas: montos, «por pagar» y la tarjeta de saldo", () => {
    montar(kpis());
    expect(tarjeta("Facturado")).toHaveTextContent("USD 1,000.00");
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("USD 600.00");
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("por pagar");
    expect(screen.getByText(/2 envíos activos · 1 factura pendiente/)).toBeInTheDocument();
    expect(screen.getByText("1 factura por pagar")).toBeInTheDocument();
  });

  it("sin poder leerlas: «No disponible», nunca «USD 0.00 · al día», y los envíos siguen", () => {
    montar(
      kpis({
        invoicesAvailable: false,
        invoicedTotal: 0,
        outstandingBalance: 0,
        pendingInvoiceCount: 0,
      }),
    );
    expect(tarjeta("Facturado")).toHaveTextContent("No disponible");
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("No disponible");
    expect(screen.queryByText("USD 0.00")).toBeNull();
    expect(screen.queryByText("al día")).toBeNull();
    expect(screen.queryByText(/facturas? por pagar/)).toBeNull();
    expect(screen.getByText(/2 envíos activos · facturas no disponibles por ahora/)).toBeInTheDocument();
    expect(screen.queryByText(/0 facturas pendientes/)).toBeNull();
    expect(tarjeta("Envíos activos")).toHaveTextContent("2");
  });
});
