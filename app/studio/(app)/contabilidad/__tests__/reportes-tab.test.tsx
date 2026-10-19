/**
 * SDD-0557 · Contabilidad › Reportes con período explícito.
 *
 *  - DAT-01: con un rango al revés no se calcula nada y el error queda junto
 *    al formulario, sin caer en silencio al mes en curso. Aunque llegaran
 *    reportes junto con el error, la pestaña no los pinta.
 *  - El enlace al diario que va junto a la comprobación NO lleva `desde`: es
 *    «hasta el corte», así suma lo mismo que la tabla.
 *  - La tarjeta «Ingreso del período» (la misma de Reportes › Estado de
 *    resultados): «no comparable» con bolívares o yuanes y «sin movimiento»
 *    con 0 contra 0, los dos sin el ícono de éxito ni el enlace a Por
 *    contabilizar.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeBalances } from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
import { balanceSheet, profitAndLoss } from "@/lib/studio/accounting/reports";
import { balanceDeComprobacion, type ReportesDelLibro } from "@/lib/studio/accounting/libro-control";
import { resumirIngreso, type IngresoPeriodo } from "@/lib/studio/accounting/ingreso-periodo";
import {
  FACTURAS_DEL_MES,
  FACTURAS_EN_USD,
  RANGO_MES,
  control,
} from "@/lib/studio/accounting/__tests__/ingreso-fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/studio/contabilidad",
  useSearchParams: () => new URLSearchParams("tab=reportes"),
}));

import { ReportesTab } from "../_components/ReportesTab";
import { IngresoDelPeriodoCard } from "../_components/IngresoDelPeriodoCard";

const acc = (id: string, code: string, type: Account["type"], name: string): Account => ({
  id, code, type, name, tenant_id: "t", parent_id: null, qbo_type: null, subtype: null,
  is_postable: true, notes: null, created_at: "", updated_at: "",
});

function reportes(ingreso: IngresoPeriodo = resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(600))): ReportesDelLibro {
  const plan = [acc("cxc", "1.1.2", "A", "Cuentas por cobrar"), acc("i", "4", "I", "Ingresos"), acc("v", "4.5", "I", "Ventas")];
  const saldos = computeBalances(plan, [
    { account_id: "cxc", debit: 600, credit: 0 },
    { account_id: "v", debit: 0, credit: 600 },
  ]);
  return {
    rango: RANGO_MES,
    pnl: profitAndLoss(plan, saldos),
    balance: balanceSheet(plan, saldos),
    comprobacion: balanceDeComprobacion(plan, saldos, RANGO_MES.to),
    ingreso,
  };
}

const ERROR_AL_REVES = "El rango está al revés: «desde» (2025-03-10) es posterior a «hasta» (2025-03-01).";

describe("ReportesTab", () => {
  it("rango al revés: muestra el error, conserva lo tecleado y no calcula reportes", () => {
    render(
      <ReportesTab
        reportes={null}
        filtro={{ desde: "2025-03-10", hasta: "2025-03-01", error: ERROR_AL_REVES }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/al revés/);
    expect(screen.getByLabelText("Desde")).toHaveValue("2025-03-10");
    expect(screen.getByLabelText("Desde")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Balance de comprobación/)).toBeNull();
    expect(screen.queryByLabelText("Ingreso del período")).toBeNull();
  });

  it("DAT-01: con el error, aunque lleguen reportes de otro período, no se pintan debajo", () => {
    render(
      <ReportesTab
        reportes={reportes()}
        filtro={{ desde: "2025-03-10", hasta: "2025-03-01", error: ERROR_AL_REVES }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/No se calculó ningún reporte/);
    expect(screen.queryByLabelText("Ingreso del período")).toBeNull();
    expect(screen.queryByText(/Balance de comprobación/)).toBeNull();
    expect(screen.queryByText("Estado de resultados")).toBeNull();
  });

  it("con reportes: la cifra oficial, la comprobación y el diario hasta el corte sin desde", () => {
    render(<ReportesTab reportes={reportes()} filtro={{ desde: RANGO_MES.from, hasta: RANGO_MES.to, error: null }} />);
    expect(screen.getByTestId("ingreso-facturado")).toHaveTextContent("$1,000.00");
    expect(screen.getByText(/menos que lo facturado/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `Balance de comprobación al ${RANGO_MES.to}` })).toBeInTheDocument();
    expect(screen.getByTestId("comprobacion-total-debe")).toHaveTextContent("600.00");
    const diario = screen.getByRole("link", { name: /Diario hasta el corte \(CSV\)/ });
    expect(diario).toHaveAttribute("href", `/api/studio/contabilidad/export?tipo=diario&hasta=${RANGO_MES.to}`);
    expect(diario.getAttribute("href")).not.toContain("desde");
    expect(screen.getByRole("link", { name: "Revisa qué falta en Por contabilizar" })).toHaveAttribute(
      "href",
      "/studio/contabilidad?tab=subdiario",
    );
  });

  it("con bolívares o yuanes en el período: «no comparable» en Contabilidad › Reportes, sin diferencia ni enlace", () => {
    render(
      <ReportesTab
        reportes={reportes(resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, control(37500)))}
        filtro={{ desde: RANGO_MES.from, hasta: RANGO_MES.to, error: null }}
      />,
    );
    const linea = screen.getByTestId("ingreso-control");
    expect(linea).toHaveAttribute("data-estado", "no_comparable");
    expect(linea).toHaveAttribute("data-tono", "neutral");
    expect(linea).toHaveTextContent(/No comparable: 3 facturas del período están en bolívares o yuanes/);
    expect(linea).toHaveTextContent(/tarea 2\.3/);
    expect(linea).not.toHaveTextContent(/más que lo facturado|menos que lo facturado/);
    expect(screen.queryByRole("link", { name: /Por contabilizar/ })).toBeNull();
  });
});

describe("IngresoDelPeriodoCard (Contabilidad › Reportes y Reportes › Estado de resultados)", () => {
  it("cuadra: ícono de éxito, sin enlace", () => {
    render(<IngresoDelPeriodoCard ingreso={resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(1000))} />);
    expect(screen.getByTestId("ingreso-control")).toHaveAttribute("data-tono", "success");
    expect(screen.getByTestId("ingreso-control")).toHaveTextContent(
      "En el mayor (cuenta 4.5, asientos de factura): $1,000.00. Cuadra con el mayor (cuenta 4.5).",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("sin movimiento: texto neutro, sin el ícono de éxito y sin «Cuadra»", () => {
    render(<IngresoDelPeriodoCard ingreso={resumirIngreso([], RANGO_MES, control(0, 0, false))} />);
    const linea = screen.getByTestId("ingreso-control");
    expect(linea).toHaveAttribute("data-estado", "sin_movimiento");
    expect(linea).toHaveAttribute("data-tono", "neutral");
    expect(linea).toHaveTextContent("Sin movimiento: no hay facturas del período ni asientos de factura en la cuenta 4.5.");
    expect(linea).not.toHaveTextContent(/Cuadra/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("no comparable: neutro y sin enlace, aunque el número del mayor sea distinto", () => {
    const una = [{ status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500 }];
    render(<IngresoDelPeriodoCard ingreso={resumirIngreso(una, RANGO_MES, control(36500))} />);
    const linea = screen.getByTestId("ingreso-control");
    expect(linea).toHaveAttribute("data-tono", "neutral");
    expect(linea).toHaveTextContent(/No comparable: 1 factura del período está en bolívares o yuanes/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("otros ingresos: el manual a 4.5 y el 4.6 se ven aparte", () => {
    render(<IngresoDelPeriodoCard ingreso={resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(1000, 1300))} />);
    expect(
      screen.getByText(/Otros ingresos del mayor que no salen del asiento de una factura \(4\.6 y asientos manuales, también a 4\.5\): \$300\.00/),
    ).toBeInTheDocument();
  });
});
