import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { costingTotals, marginByRoute, marginByClient, costPerCbmByRoute, type CostingRow } from "@/lib/studio/costing/queries";
import { shipmentEconomics } from "@/lib/studio/costing/types";
import { buildAgingSide, groupByRoute, groupByService, type ReportShipment, type CombinedReport } from "@/lib/studio/reports/types";
import type { Shipment } from "@/lib/studio/shipment-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
import { ReportesClient } from "./ReportesClient";

function combined(revenue: number, cost: number, sinTasa: number): CombinedReport {
  const rows: CostingRow[] = [{
    shipment: { id: "P", code: "DTDU-P", client_name: "Cliente parcial", origin: "CN", destination: "VE", volume_m3: 10 } as Shipment,
    costs: null,
    facturasSinTasa: sinTasa,
    eco: shipmentEconomics({ revenueUsd: revenue, costs: { freight: cost, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 } }),
  }];
  return { totals: costingTotals(rows), byRoute: marginByRoute(rows), byClient: marginByClient(rows), byCbm: costPerCbmByRoute(rows), withCosts: 1, shipments: 1 };
}

describe("0572 revisión · Mixto real conserva completitud de Costing", () => {
  it.each(["rent-route", "margin-client"])("%s no certifica margen positivo ni negativo", (rep) => {
    const { rerender } = render(<ReportesClient category="mix" period="3M" rep={rep} combined={combined(100, 10, 2)} />);
    expect(screen.queryAllByText("$90.00")).toHaveLength(0);
    expect(screen.queryByText("90%")).not.toBeInTheDocument();
    expect(screen.getAllByText(/conversión incompleta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 embarque sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$10").length).toBeGreaterThan(0);
    rerender(<ReportesClient category="mix" period="3M" rep={rep} combined={combined(100, 200, 1)} />);
    expect(screen.queryAllByText("-$100.00")).toHaveLength(0);
    expect(screen.queryByText("−100%")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("costo/CBM continúa válido sin ingreso/CBM ni margen/CBM definitivos", () => {
    render(<ReportesClient category="mix" period="3M" rep="cost-cbm" combined={combined(100, 20, 1)} />);
    expect(screen.getByText("$2")).toBeInTheDocument();
    expect(screen.queryByText("$10")).not.toBeInTheDocument();
    expect(screen.queryByText("$8.00")).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 embarque sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(1);
  });

  it("solo excluidas conserva costos; cero conocido conserva margen 0", () => {
    const { rerender } = render(<ReportesClient category="mix" period="3M" rep="rent-route" combined={combined(0, 10, 1)} />);
    expect(screen.queryAllByText("-$10.00")).toHaveLength(0);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    rerender(<ReportesClient category="mix" period="3M" rep="rent-route" combined={combined(0, 0, 0)} />);
    expect(screen.queryByText(/conversión incompleta/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("$0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });
});

describe("0572 revisión · Aging distingue desconocido de ausencia", () => {
  it.each([[1, 0], [0, 1], [1, 2]])("solo excluidas CxC=%s CxP=%s conserva su existencia y CSV", (cxc, cxp) => {
    const aging = { cxc: { ...buildAgingSide([]), sinTasa: cxc }, cxp: { ...buildAgingSide([]), sinTasa: cxp } };
    render(<ReportesClient category="con" period="3M" rep="aging" aging={aging} />);
    expect(screen.queryByText("Sin saldos por cobrar ni por pagar")).not.toBeInTheDocument();
    if (cxc) expect(screen.queryByText("Sin saldos por cobrar.")).not.toBeInTheDocument();
    if (cxp) expect(screen.queryByText("Sin saldos por pagar.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /exportar csv/i })).toBeEnabled();
  });

  it("mezcla conserva saldo convertido con estado parcial y verdadero vacío sigue vacío", () => {
    const empty = buildAgingSide([]);
    const { rerender } = render(<ReportesClient category="con" period="3M" rep="aging" aging={{ cxc: { ...buildAgingSide([{ balance: 100, daysOverdue: 2 }]), sinTasa: 1 }, cxp: empty }} />);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    rerender(<ReportesClient category="con" period="3M" rep="aging" aging={{ cxc: empty, cxp: empty }} />);
    expect(screen.getByText("Sin saldos por cobrar ni por pagar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportar csv/i })).toBeDisabled();
  });
});

describe("0572 revisión · Facturado contra cobrado", () => {
  it("solo excluidas no afirma ausencia de movimientos", () => {
    render(<ReportesClient category="con" period="3M" rep="cashflow" cashflow={{ series: [{ month: "2026-06", label: "JUN 26", billed: 0, collected: 0 }], totalBilled: 0, totalCollected: 0, outstanding: 0, overdue: 0, facturasSinTasa: 1, recibosSinTasa: 1 }} />);
    expect(screen.getAllByText(/sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /exportar csv/i })).toBeEnabled();
  });
});

describe("0572 revisión · Operacional", () => {
  it.each(["routes", "services"])("%s rotula subtotal conocido y conserva factura excluida", (rep) => {
    const shipment = { id: "s1", code: "S1", origin: "CN", destination: "VE", shipment_service: "consolidado_lcl", cbm: 10 } as ReportShipment;
    const revenue = new Map([["S1", 100]]);
    const missing = new Map([["S1", 1]]);
    render(<ReportesClient category="op" period="3M" rep={rep} routes={groupByRoute([shipment], revenue, missing)} services={groupByService([shipment], revenue, missing)} />);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1.*sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("$10/CBM")).not.toBeInTheDocument();
    expect(screen.getAllByText("$100").length).toBeGreaterThan(0);
  });
});
