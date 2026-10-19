/**
 * SDD-0557 · El estado de resultados gerencial dice cuándo el mayor mezcla monedas.
 *
 * Con facturas en bolívares o yuanes asentadas por su nominal (B2), las cifras
 * del mayor no son todas USD. La tarjeta se titula «USD funcional», así que con
 * el control «no comparable» tiene que decirlo al lado de las cifras. Sin
 * facturas en otra moneda, no hay nota.
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resumirIngreso } from "@/lib/studio/accounting/ingreso-periodo";
import { control, RANGO_MES } from "@/lib/studio/accounting/__tests__/ingreso-fixture";
import type { IncomeStatement } from "@/lib/studio/reports/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { IncomeStatementCard } from "../_components/ReportesClient";

const VES = { id: "v1", status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500, fund_class: "local_revenue" };
const USD = { id: "u1", status: "emitida", issued_at: "2025-03-05", currency: "USD", fx_rate: null, base_amount: 1000, fund_class: "local_revenue" };

function estado(ingreso: IncomeStatement["ingreso"]): IncomeStatement {
  return {
    rows: [{ label: "Ingresos", amount: 37500, pct: null, emphasis: false }],
    income: 37500,
    netIncome: 37500,
    range: { from: RANGO_MES.from, to: RANGO_MES.to },
    ingreso,
  };
}

afterEach(() => cleanup());

describe("IncomeStatementCard · mayor mezclado (SDD-0557)", () => {
  it("con una factura en VES asentada al nominal, la tarjeta avisa que las cifras no son todas USD", () => {
    render(createElement(IncomeStatementCard, { income: estado(resumirIngreso([VES], RANGO_MES, control(36500, 36500, true, ["v1"]))) }));
    expect(screen.getByRole("note")).toHaveTextContent(/mezclan el nominal de facturas en bolívares o yuanes/);
  });

  it("sin facturas en otra moneda no hay nota", () => {
    render(createElement(IncomeStatementCard, { income: estado(resumirIngreso([USD], RANGO_MES, control(1000, 1000, true, ["u1"]))) }));
    expect(screen.queryByRole("note")).toBeNull();
  });
});
