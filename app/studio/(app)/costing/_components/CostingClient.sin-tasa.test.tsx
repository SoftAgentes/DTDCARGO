import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { costingTotals, marginByRoute, type CostingRow } from "@/lib/studio/costing/queries";
import { buildForecast } from "@/lib/studio/costing/ui";
import { shipmentEconomics } from "@/lib/studio/costing/types";
import type { Shipment } from "@/lib/studio/shipment-types";

// Los editores ajenos a esta lectura no se abren. CostingClient, sus helpers y
// las primitivas visibles permanecen reales: no simular la exclusión a probar.
vi.mock("./CostEditorDrawer", () => ({ CostEditorDrawer: () => null }));
vi.mock("./TemplateDrawer", () => ({ TemplateDrawer: () => null }));

import { CostingClient } from "./CostingClient";

function row(id: string, revenue: number, cost: number, sinTasa = 0): CostingRow {
  return {
    shipment: { id, code: `DTDU-${id}`, client_name: `Cliente ${id}`, origin: "CN", destination: id === "P" ? "VE" : "US", shipment_service: "consolidado_lcl" } as Shipment,
    costs: null,
    facturasSinTasa: sinTasa,
    eco: shipmentEconomics({ revenueUsd: revenue, costs: { freight: cost, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 } }),
  };
}

function view(rows: CostingRow[]) {
  return render(<CostingClient rows={rows} totals={costingTotals(rows)} routes={marginByRoute(rows)} templates={[]} forecast={buildForecast([], [])} vesRate={null} />);
}

describe("0572 · Costing real con facturas sin tasa", () => {
  it.each([10, 200])("Overview no clasifica parcial con costo %s ni certifica margen total", (cost) => {
    view([row("P", 100, cost, 1), row("A", 100, 50)]);
    expect(screen.queryByText("DTDU-P")).not.toBeInTheDocument();
    expect(screen.getByText("DTDU-A")).toBeInTheDocument();
    expect(screen.getByText("Revenue · subtotal convertido")).toBeInTheDocument();
    const margin = screen.getAllByText("Margen bruto")[0].parentElement!;
    expect(within(margin).getByText("—")).toHaveStyle({ color: "var(--ink)" });
    expect(within(margin).getByText(/conversión incompleta/i)).toBeInTheDocument();
    expect(screen.queryByText(/quedan de margen bruto/)).not.toBeInTheDocument();
  });

  it.each([10, 200])("Ranking conserva subtotal/costo %s y muestra margen neutral pendiente", (cost) => {
    view([row("P", 100, cost, 1), row("A", 100, 50)]);
    fireEvent.click(screen.getByRole("tab", { name: "Ranking de embarques" }));
    const partial = screen.getByText("DTDU-P").parentElement!;
    expect(within(partial).getByText("$100")).toBeInTheDocument();
    expect(within(partial).getByText(`$${cost}`)).toBeInTheDocument();
    expect(within(partial).getByText(/subtotal/i)).toBeInTheDocument();
    expect(within(partial).getByText(/1 factura sin tasa/)).toBeInTheDocument();
    expect(within(partial).getByText("—")).toHaveStyle({ color: "var(--ink)" });
    expect(within(partial).queryByText(`${100 - cost}.0%`)).not.toBeInTheDocument();
    expect(within(partial).queryByText(`$${100 - cost}`)).not.toBeInTheDocument();
    const codes = screen.getAllByText(/^DTDU-/).map((el) => el.textContent);
    expect(codes).toEqual(["DTDU-A", "DTDU-P"]);
  });

  it("Margen por ruta transmite la misma incompletitud y conserva sus costos", () => {
    view([row("P", 100, 10, 1), row("A", 100, 50)]);
    fireEvent.click(screen.getByRole("tab", { name: "Margen por ruta" }));
    const route = screen.getByText("VE").parentElement!.parentElement!;
    expect(within(route).getByText("$100")).toBeInTheDocument();
    expect(within(route).getByText("$10")).toBeInTheDocument();
    expect(within(route).getByText(/subtotal/i)).toBeInTheDocument();
    expect(within(route).getByText(/1 embarque sin tasa/)).toBeInTheDocument();
    expect(within(route).getByText("—")).toHaveStyle({ color: "var(--ink)" });
    expect(within(route).queryByText("90.0%")).not.toBeInTheDocument();
    expect(within(route).queryByText("$90")).not.toBeInTheDocument();
  });

  it("cero conocido conserva cero y margen evaluable; sin tasa de display desactiva VES", () => {
    view([row("Z", 0, 0)]);
    expect(screen.getByText("Revenue total")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "VES" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Ranking de embarques" }));
    const zero = screen.getByText("DTDU-Z").parentElement!;
    expect(within(zero).getAllByText("$0")).toHaveLength(3);
    expect(within(zero).getByText("0.0%")).toBeInTheDocument();
    expect(within(zero).queryByText(/sin tasa/i)).not.toBeInTheDocument();
  });
});
