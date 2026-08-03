import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseRowActions } from "./ExpenseRowActions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  voidExpenseAction: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../actions", () => ({ voidExpenseAction: mocks.voidExpenseAction }));
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
  resolveErrorMessage: (_t: unknown, result: { error?: string }) => result.error,
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: mocks.success, error: vi.fn() }),
}));
vi.mock("@/app/studio/_components/icons", () => ({
  Icon: {
    more: () => <span aria-hidden="true">more</span>,
    edit: () => <span aria-hidden="true">edit</span>,
    trash: () => <span aria-hidden="true">trash</span>,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.voidExpenseAction.mockResolvedValue({ ok: true, outcome: "voided" });
});
afterEach(cleanup);

function renderActions(canVoid = true) {
  return render(
    <ExpenseRowActions
      expenseId="30000000-0000-4000-8000-000000000001"
      expenseCode="EXP-2026-0001"
      onEdit={vi.fn()}
      canVoid={canVoid}
    />,
  );
}

async function openVoidDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "expenses.table.col_actions" }));
  await user.click(screen.getByRole("menuitem", { name: "expenses.row.void" }));
  return user;
}

describe("ExpenseRowActions · SDD-0243", () => {
  it("oculta la acción cuando el rol no tiene la capability", async () => {
    const user = userEvent.setup();
    renderActions(false);
    await user.click(screen.getByRole("button", { name: "expenses.table.col_actions" }));
    expect(screen.queryByRole("menuitem", { name: "expenses.row.void" })).not.toBeInTheDocument();
  });

  it("implementa menú con roving focus y restaura foco con Escape", async () => {
    const user = userEvent.setup();
    renderActions();
    const trigger = screen.getByRole("button", { name: "expenses.table.col_actions" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const first = await screen.findByRole("menuitem", { name: "expenses.row.edit" });
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "expenses.row.void" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("abrir el diálogo no muta y explica la conservación", async () => {
    renderActions();
    await openVoidDialog();
    expect(mocks.voidExpenseAction).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "expenses.row.void_title" })).toBeVisible();
    expect(screen.getByText("expenses.row.void_message")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("exige motivo y envía una sola referencia idempotente", async () => {
    renderActions();
    const user = await openVoidDialog();
    await user.click(screen.getByLabelText("expenses.row.void_alternative"));
    await user.click(screen.getByRole("button", { name: "expenses.row.void_confirm" }));
    expect(mocks.voidExpenseAction).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText("expenses.row.void_reason"),
      "Gasto duplicado después de conciliación",
    );
    await user.click(screen.getByRole("button", { name: "expenses.row.void_confirm" }));
    await waitFor(() => expect(mocks.voidExpenseAction).toHaveBeenCalledTimes(1));
    expect(mocks.voidExpenseAction).toHaveBeenCalledWith(
      "30000000-0000-4000-8000-000000000001",
      "Gasto duplicado después de conciliación",
      expect.stringMatching(/^expense-void:/),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("conserva diálogo, motivo y error cuando el servidor rechaza", async () => {
    mocks.voidExpenseAction.mockResolvedValue({ error: "El gasto cambió." });
    renderActions();
    const user = await openVoidDialog();
    const reason = screen.getByLabelText("expenses.row.void_reason");
    await user.type(reason, "Revisión contra conciliación bancaria");
    await user.click(screen.getByLabelText("expenses.row.void_alternative"));
    await user.click(screen.getByRole("button", { name: "expenses.row.void_confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El gasto cambió.");
    expect(reason).toHaveValue("Revisión contra conciliación bancaria");
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
