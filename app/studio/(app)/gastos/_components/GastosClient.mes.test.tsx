/**
 * SDD-0660 (revisión de #668, I2 y N2): el filtro de mes de Gastos no vive en un
 * <form>. A medio escribir no navega (el filtro no se vacía al reescribir el mes)
 * y «Exportar» espera, para no bajar un mes distinto al que se ve en el campo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/studio/expense-types";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace }),
  usePathname: () => "/studio/gastos",
  useSearchParams: () => new URLSearchParams("month=2026-10"),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n")>()),
  useT: () => (key: string) => (key === "expenses.filter.month_label" ? "Mes" : key),
  useLocale: () => "es",
}));
vi.mock("../actions", () => ({ resolveExpenseAlertAction: vi.fn(), exportExpensesCsvAction: vi.fn() }));
vi.mock("./ExpenseDrawer", () => ({ ExpenseDrawer: () => null }));
vi.mock("./ExpenseRowActions", () => ({ ExpenseRowActions: () => null }));

import { GastosClient } from "./GastosClient";

afterEach(() => {
  cleanup();
  replace.mockClear();
  push.mockClear();
});

const GASTO: Expense = {
  id: "g1", tenant_id: "t1", user_id: "u1", expense_code: "G-1", amount: 10, currency: "USD", amount_usd: 10, fx_rate: 1,
  category: "otro", scope: "external", method: "cash", shipment_id: null, note: "Sintético", location: null, billable: false,
  receipt_path: null, receipt_document_id: null, account_id: "c1", occurred_at: "2026-10-05T12:00:00Z",
  created_at: "2026-10-05T12:00:00Z", updated_at: "2026-10-05T12:00:00Z", deleted_at: null,
};

function montar() {
  render(
    <GastosClient expenses={[GASTO]} shipments={[]} scope="external" month="2026-10" fxPrefill={{}} activeAlerts={[]}
      attachmentsPilotEnabled={false} canVoidExpense={false} />,
  );
  return {
    mes: screen.getByLabelText("Mes") as HTMLInputElement,
    exportar: screen.getByRole("button", { name: "expenses.export_btn" }),
    user: userEvent.setup(),
  };
}

describe("Gastos · filtro de mes a medio escribir", () => {
  it("con el mes completo se puede exportar", () => {
    const { mes, exportar } = montar();
    expect(mes).toHaveValue("10/2026");
    expect(exportar).toBeEnabled();
  });

  it("a medio escribir no navega ni deja exportar", async () => {
    const { mes, exportar, user } = montar();
    await user.type(mes, "{Backspace}");
    expect(mes).toHaveValue("10/202");
    expect(exportar).toBeDisabled();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
