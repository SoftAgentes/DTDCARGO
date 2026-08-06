import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/studio/expense-types";
import { MobileErpClient } from "./MobileErpClient";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  voidExpenseAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../actions", () => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  voidExpenseAction: mocks.voidExpenseAction,
}));
vi.mock("@/app/studio/(app)/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/BrandMark", () => ({ BrandMark: () => <span>DTD Cargo</span> }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const EXPENSE: Expense = {
  id: "30000000-0000-4000-8000-000000000001",
  tenant_id: "10000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000001",
  expense_code: "EXP-2026-0001",
  amount: 25,
  currency: "USD",
  amount_usd: 25,
  fx_rate: 1,
  category: "taxi",
  scope: "external",
  method: "cash",
  shipment_id: null,
  note: "Traslado de prueba",
  location: "Yiwu",
  billable: false,
  receipt_path: "tenant/expense/receipt.jpg",
  receipt_document_id: "90000000-0000-4000-8000-000000000001",
  account_id: null,
  occurred_at: "2026-08-03T12:00:00.000Z",
  created_at: "2026-08-03T12:00:00.000Z",
  updated_at: "2026-08-03T12:00:00.000Z",
  deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.voidExpenseAction.mockResolvedValue({ ok: true, outcome: "voided" });
});
afterEach(cleanup);

function renderMobile(role: string) {
  return render(
    <MobileErpClient
      user={{
        id: "20000000-0000-4000-8000-000000000001",
        firstName: "Prueba",
        fullName: "Persona de prueba",
        initials: "PP",
        role,
        email: "fixture@example.invalid",
      }}
      shipments={[]}
      clients={[]}
      expenses={[EXPENSE]}
      receiptUrls={{}}
      expensesTodayUsd={25}
      operatingLat={null}
      operatingLng={null}
      initialTab="expenses"
    />,
  );
}

describe("MobileErpClient · anulación de gasto SDD-0243", () => {
  it("oculta la acción a roles sin capability", async () => {
    renderMobile("warehouse");
    await userEvent.click(screen.getByRole("button", { name: "Editar gasto EXP-2026-0001" }));
    expect(screen.queryByRole("button", { name: "Anular este gasto" })).not.toBeInTheDocument();
  });

  it("accounting usa ConfirmDialog y conserva una referencia para reintento", async () => {
    renderMobile("accounting");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar gasto EXP-2026-0001" }));
    await user.click(screen.getByRole("button", { name: "Anular este gasto" }));
    expect(mocks.voidExpenseAction).not.toHaveBeenCalled();
    expect(screen.getByText(/registro y su recibo se conservarán/i)).toBeVisible();
    await user.type(
      screen.getByLabelText("Motivo de la anulación"),
      "Gasto duplicado después de conciliación",
    );
    await user.click(screen.getByLabelText(/prefiero anular con un clic/i));
    await user.click(screen.getByRole("button", { name: "Anular gasto" }));
    await waitFor(() => expect(mocks.voidExpenseAction).toHaveBeenCalledTimes(1));
    expect(mocks.voidExpenseAction).toHaveBeenCalledWith(
      EXPENSE.id,
      "Gasto duplicado después de conciliación",
      expect.stringMatching(/^expense-void:/),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
