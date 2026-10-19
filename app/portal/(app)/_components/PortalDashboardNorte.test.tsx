/**
 * SDD-0556 · La portada del portal cuando las facturas no se pudieron leer.
 *
 * Antes, un error al leer facturas devolvía una lista vacía y la portada decía
 * «Saldo pendiente USD 0.00 · al día»: un dato falso con cara de verdad. Ahora
 * `getDashboardKpis` marca `invoicesAvailable: false` y la portada dice «No
 * disponible», sin tumbar envíos ni el resto del tablero.
 *
 * Y con algo por pagar, en cualquier moneda, la portada nunca dice «al día».
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type {
  PortalClient,
  PortalDashboardKpis,
  PortalInvoiceRow,
} from "@/lib/portal/portal-types";
import { resumenDeCuenta } from "@/lib/portal/saldo-de-cuenta";
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

/** Una fila como la devuelve `listMyInvoices`. */
function fila(over: Partial<PortalInvoiceRow>): PortalInvoiceRow {
  return {
    id: String(over.code),
    code: "F-2026-0001",
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

  it("sin poder leerlas: «No disponible», ningún monto ni «al día», y los envíos siguen", () => {
    // Con `invoicesAvailable: false` los campos de facturas «no valen nada»
    // (portal-types). Se ponen distintos de cero a propósito: así la prueba
    // falla si alguna parte de la portada los muestra igual, incluida la
    // tarjeta de saldo de la columna derecha. Con ceros, esa guarda quedaba
    // sin probar (un 0 la oculta por sí solo).
    montar(
      kpis({
        invoicesAvailable: false,
        invoicedTotal: 1000,
        outstandingBalance: 600,
        pendingInvoiceCount: 1,
      }),
    );
    expect(tarjeta("Facturado")).toHaveTextContent("No disponible");
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("No disponible");
    expect(screen.queryByText("1 factura por pagar")).toBeNull();
    expect(screen.queryByText(/facturas? por pagar/)).toBeNull();
    expect(screen.queryByText(/USD 600\.00/)).toBeNull();
    expect(screen.queryByText(/USD 1,000\.00/)).toBeNull();
    expect(screen.queryByText("al día")).toBeNull();
    expect(screen.queryByRole("link", { name: /Ver facturas/ })).toBeNull();
    expect(screen.getByText(/2 envíos activos · facturas no disponibles por ahora/)).toBeInTheDocument();
    expect(screen.queryByText(/1 factura pendiente/)).toBeNull();
    expect(tarjeta("Envíos activos")).toHaveTextContent("2");
  });
});

describe("PortalDashboardNorte · nunca «al día» con algo por pagar (SDD-0556)", () => {
  it("USD 400/100 más VES 2000/2000: «USD 300.00 · por pagar», sin «al día»", () => {
    // Las cifras salen de `resumenDeCuenta`, como en `getDashboardKpis`. Antes
    // la moneda dominante era VES (2000 > 400) y la portada decía «VES 0.00 ·
    // al día» con una factura pendiente en USD.
    const r = resumenDeCuenta([
      fila({ code: "F-USD", currency: "USD", total: 400, paid: 100 }),
      fila({ code: "F-VES", currency: "VES", total: 2000, paid: 2000 }),
    ]);
    montar(
      kpis({
        invoicedTotal: r.facturado,
        outstandingBalance: r.porPagar,
        currency: r.currency,
        mixedCurrencies: r.mixedCurrencies,
        pendingInvoiceCount: r.facturasPorPagar,
      }),
    );
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("USD 300.00");
    expect(tarjeta("Saldo pendiente")).toHaveTextContent("por pagar");
    expect(screen.queryByText("al día")).toBeNull();
    expect(screen.getByText("1 factura por pagar")).toBeInTheDocument();
    // Con varias monedas, «Facturado» no promete que USD sea la principal.
    expect(tarjeta("Facturado")).toHaveTextContent("solo USD · hay otras monedas");
    expect(screen.queryByText("moneda dominante")).toBeNull();
  });

  it("con una factura pendiente y el monto dominante en 0: ni «al día» ni tono de éxito", () => {
    // La forma que tenían los KPIs antes de que la moneda dominante siguiera a
    // la deuda. La portada no se apoya sólo en el monto: el conteo también manda.
    montar(
      kpis({
        outstandingBalance: 0,
        currency: "VES",
        mixedCurrencies: true,
        pendingInvoiceCount: 1,
      }),
    );
    const saldo = tarjeta("Saldo pendiente");
    expect(saldo).toHaveTextContent("por pagar");
    expect(saldo).not.toHaveTextContent("al día");
    // El tono se ve en el color del ícono: aviso, no éxito.
    expect(saldo.innerHTML).toContain("--color-status-warning");
    expect(saldo.innerHTML).not.toContain("--color-status-success");
  });

  it("sin nada por pagar sí dice «al día», con tono de éxito", () => {
    montar(kpis({ outstandingBalance: 0, pendingInvoiceCount: 0 }));
    const saldo = tarjeta("Saldo pendiente");
    expect(saldo).toHaveTextContent("al día");
    expect(saldo.innerHTML).toContain("--color-status-success");
  });
});
