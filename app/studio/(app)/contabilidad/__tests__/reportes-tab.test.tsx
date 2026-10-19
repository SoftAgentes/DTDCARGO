/**
 * SDD-0557 · Contabilidad › Reportes con período explícito.
 *
 *  - DAT-01: con un rango al revés no se calcula nada y el error queda junto
 *    al formulario, sin caer en silencio al mes en curso.
 *  - El enlace al diario que va junto a la comprobación NO lleva `desde`: es
 *    «hasta el corte», así suma lo mismo que la tabla.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeBalances } from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
import { balanceSheet, profitAndLoss } from "@/lib/studio/accounting/reports";
import { balanceDeComprobacion, type ReportesDelLibro } from "@/lib/studio/accounting/libro-control";
import { resumirIngreso } from "@/lib/studio/accounting/ingreso-periodo";
import { FACTURAS_DEL_MES, RANGO_MES } from "@/lib/studio/accounting/__tests__/ingreso-fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/studio/contabilidad",
  useSearchParams: () => new URLSearchParams("tab=reportes"),
}));

import { ReportesTab } from "../_components/ReportesTab";

const acc = (id: string, code: string, type: Account["type"], name: string): Account => ({
  id, code, type, name, tenant_id: "t", parent_id: null, qbo_type: null, subtype: null,
  is_postable: true, notes: null, created_at: "", updated_at: "",
});

function reportes(): ReportesDelLibro {
  const plan = [acc("cxc", "1.1.2", "A", "Cuentas por cobrar"), acc("i", "4", "I", "Ingresos"), acc("v", "4.5", "I", "Ventas")];
  const saldos = computeBalances(plan, [
    { account_id: "cxc", debit: 1500, credit: 0 },
    { account_id: "v", debit: 0, credit: 1500 },
  ]);
  return {
    rango: RANGO_MES,
    pnl: profitAndLoss(plan, saldos),
    balance: balanceSheet(plan, saldos),
    comprobacion: balanceDeComprobacion(plan, saldos, RANGO_MES.to),
    ingreso: resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, { ventas: 1500, ingresos: 1500 }),
  };
}

describe("ReportesTab", () => {
  it("rango al revés: muestra el error, conserva lo tecleado y no calcula reportes", () => {
    render(
      <ReportesTab
        reportes={null}
        filtro={{ desde: "2025-03-10", hasta: "2025-03-01", error: "El rango está al revés: «desde» (2025-03-10) es posterior a «hasta» (2025-03-01)." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/al revés/);
    expect(screen.getByLabelText("Desde")).toHaveValue("2025-03-10");
    expect(screen.getByLabelText("Desde")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Balance de comprobación/)).toBeNull();
    expect(screen.queryByLabelText("Ingreso del período")).toBeNull();
  });

  it("con reportes: la cifra oficial, la comprobación y el diario hasta el corte sin desde", () => {
    render(<ReportesTab reportes={reportes()} filtro={{ desde: RANGO_MES.from, hasta: RANGO_MES.to, error: null }} />);
    expect(screen.getByTestId("ingreso-facturado")).toHaveTextContent("$2,000.00");
    expect(screen.getByText(/menos que lo facturado/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `Balance de comprobación al ${RANGO_MES.to}` })).toBeInTheDocument();
    expect(screen.getByTestId("comprobacion-total-debe")).toHaveTextContent("1,500.00");
    const diario = screen.getByRole("link", { name: /Diario hasta el corte \(CSV\)/ });
    expect(diario).toHaveAttribute("href", `/api/studio/contabilidad/export?tipo=diario&hasta=${RANGO_MES.to}`);
    expect(diario.getAttribute("href")).not.toContain("desde");
    expect(screen.getByRole("link", { name: "Revisa qué falta en Por contabilizar" })).toHaveAttribute(
      "href",
      "/studio/contabilidad?tab=subdiario",
    );
  });
});
