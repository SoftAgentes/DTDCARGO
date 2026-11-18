import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuilderRow } from "@/lib/studio/reports/builder-types";
import { BuilderView } from "./BuilderView";

const missing: BuilderRow = { dims: { client: "Cliente pendiente", status: "Emitida", currency: "CNY", tasa: "Sin tasa" }, metrics: {}, filters: { status: "Emitida", currency: "CNY", tasa: "Sin tasa" } };
const known: BuilderRow = { dims: { client: "Cliente pendiente", status: "Emitida", currency: "USD", tasa: "Con tasa" }, metrics: { amount: 100, balance: 100 }, filters: { status: "Emitida", currency: "USD", tasa: "Con tasa" } };

async function view(rows: BuilderRow[]) {
  await act(async () => {
    render(<BuilderView source="invoices" rows={rows} period="3M" onSource={vi.fn()} />);
  });
  fireEvent.change(screen.getByLabelText("3 · Métrica"), { target: { value: "1" } });
}

beforeEach(() => window.localStorage.clear());

describe("0572 revisión · Constructor real sin depender de dimensión Tasa", () => {
  it("por cliente mantiene parcial y contador al sumar monto", async () => {
    await view([known, missing]);
    expect(screen.getAllByText(/conversión incompleta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 documento sin tasa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
  });

  it("solo desconocido no aparece como 0 USD definitivo", async () => {
    await view([missing]);
    expect(screen.queryAllByText("$0.00")).toHaveLength(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 documento sin tasa/i).length).toBeGreaterThan(0);
  });

  it("cero conocido sigue visible y count no depende de FX", async () => {
    await view([{ ...known, metrics: { amount: 0, balance: 0 } }, missing]);
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0); // subtotal conocido, explícitamente parcial
    expect(screen.getAllByText(/subtotal/i).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("3 · Métrica"), { target: { value: "0" } });
    expect(screen.queryByText(/conversión incompleta/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("filtrar Con tasa recupera un total completo sin cambiar agrupación Cliente", async () => {
    await view([known, missing]);
    fireEvent.change(screen.getByLabelText("4 · Filtro"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Tasa ="), { target: { value: "Con tasa" } });
    expect(screen.queryByText(/conversión incompleta/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
  });
});
