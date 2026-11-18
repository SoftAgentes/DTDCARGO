/**
 * SDD-0557 · El estado de resultados gerencial dice cuándo el mayor mezcla monedas.
 *
 * Con facturas en bolívares o yuanes asentadas por su nominal (B2), las cifras
 * del mayor no son todas USD. La tarjeta se titula «USD funcional», así que con
 * el control «no comparable» tiene que decirlo al lado de las cifras. Sin
 * facturas en otra moneda, no hay nota.
 */
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resumirIngreso, type ContextoControlI2 } from "@/lib/studio/accounting/ingreso-periodo";
import { control, RANGO_MES } from "@/lib/studio/accounting/__tests__/ingreso-fixture";
import { vistaDelEstado, type IncomeStatement } from "@/lib/studio/reports/types";
import { IngresoDelPeriodoCard } from "@/app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { IncomeStatementCard } from "../_components/ReportesClient";

const VES = { id: "v1", status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500, fund_class: "local_revenue" };
const USD = { id: "u1", status: "emitida", issued_at: "2025-03-05", currency: "USD", fx_rate: null, base_amount: 1000, fund_class: "local_revenue" };

/** Contexto crudo del asiento: VES conserva36500 nominales; USD conserva1000. */
function contexto(factura: typeof VES | typeof USD): ContextoControlI2 {
  const entry = `asiento-${factura.id}`;
  return {
    completo: true,
    documentos: [{ ...factura, tenant_id: "gerencial-test", deleted_at: null }],
    asientos: [{ id: entry, tenant_id: "gerencial-test", invoice_id: factura.id,
      entry_date: "2025-03-05", status: "asentado", source: "invoice", deleted_at: null, reverses_entry_id: null }],
    lineas: [{ id: `${entry}-ar`, entry_id: entry, account_id: "ar", debit: factura.base_amount, credit: 0 },
      { id: `${entry}-ventas`, entry_id: entry, account_id: "ventas", debit: 0, credit: factura.base_amount }],
    cuentas: [{ id: "ar", tenant_id: "gerencial-test", code: "1.1.2", type: "A", parent_id: null },
      { id: "ventas", tenant_id: "gerencial-test", code: "4.5", type: "I", parent_id: null }],
  };
}

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
    render(createElement(IncomeStatementCard, { income: estado(resumirIngreso([VES], RANGO_MES, control(36500, 36500, true, ["v1"]), contexto(VES))) }));
    expect(screen.getByRole("status")).toHaveTextContent(/mezclan el nominal de facturas en bolívares o yuanes/);
  });

  it("sin facturas en otra moneda no hay nota", () => {
    render(createElement(IncomeStatementCard, { income: estado(resumirIngreso([USD], RANGO_MES, control(1000, 1000, true, ["u1"]), contexto(USD))) }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("unidad desconocida con neto0 conserva diagnóstico y oculta certificación monetaria sólo en el gerencial", () => {
    const ingreso = resumirIngreso([USD], RANGO_MES, control(0, 0, false));
    const income: IncomeStatement = {
      rows: [{ label: "Ingresos", amount: 0, pct: 0, emphasis: false }],
      income: 0, netIncome: 0, range: RANGO_MES, ingreso,
    };
    expect(vistaDelEstado(income)).toBe("completo");
    render(createElement("div", null,
      createElement(IngresoDelPeriodoCard, { ingreso }),
      createElement(IncomeStatementCard, { income }),
    ));
    const titulo = screen.getByText("Gerencial · unidad monetaria sin verificar");
    const gerencial = titulo.parentElement;
    expect(gerencial).not.toBeNull();
    const tarjeta = within(gerencial!);
    expect(tarjeta.getByRole("status")).toHaveTextContent("No se ha verificado la unidad monetaria del mayor.");
    expect(tarjeta.getByRole("status")).toHaveTextContent("Revisa el control de Ingreso del período");
    expect(tarjeta.getByText("No disponible")).toBeInTheDocument();
    expect(tarjeta.getByText("—")).toBeInTheDocument();
    expect(gerencial).not.toHaveTextContent(/\$|USD funcional|0%/);
    expect(screen.getByTestId("ingreso-facturado")).toHaveTextContent("$1,000.00");
  });
});
