import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptRowActions } from "./ReceiptRowActions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  changeReceiptPaymentStatusAction: vi.fn(),
  changeReceiptStatusAction: vi.fn(),
  markReceiptVerifiedAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../actions", () => ({
  changeReceiptPaymentStatusAction: mocks.changeReceiptPaymentStatusAction,
  changeReceiptStatusAction: mocks.changeReceiptStatusAction,
  markReceiptVerifiedAction: mocks.markReceiptVerifiedAction,
}));

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
  resolveErrorMessage: () => null,
}));

vi.mock("@/app/studio/_components/icons", () => ({
  Icon: {
    check: () => <span aria-hidden="true">check</span>,
    more: () => <span aria-hidden="true">more</span>,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changeReceiptPaymentStatusAction.mockResolvedValue({ ok: true });
  mocks.changeReceiptStatusAction.mockResolvedValue({ ok: true });
  mocks.markReceiptVerifiedAction.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

function renderActions(invoiceVerifiedAt: string | null = null) {
  return render(
    <ReceiptRowActions
      receiptId="receipt-1"
      currentStatus="pendiente_consolidacion"
      currentPaymentStatus="pendiente"
      invoiceVerifiedAt={invoiceVerifiedAt}
    />,
  );
}

describe("ReceiptRowActions", () => {
  it("implementa roving focus y restaura el foco al cerrar con Escape", async () => {
    const user = userEvent.setup();
    renderActions();

    const trigger = screen.getByRole("button", {
      name: "warehouse_cn.row.aria_actions",
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const firstEnabled = await screen.findByRole("menuitem", {
      name: "warehouse_cn.status.consolidated",
    });
    await waitFor(() => expect(firstEnabled).toHaveFocus());

    await user.keyboard("{End}");
    expect(
      screen.getByRole("menuitem", {
        name: "warehouse_cn.row.action_verify_invoice",
      }),
    ).toHaveFocus();

    await user.keyboard("{Home}");
    expect(firstEnabled).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("expone la verificación como acción de menú sin estado ARIA incompatible", async () => {
    const user = userEvent.setup();
    renderActions("2026-07-31T00:00:00.000Z");

    await user.click(
      screen.getByRole("button", {
        name: "warehouse_cn.row.aria_actions",
      }),
    );

    const verifyToggle = await screen.findByRole("menuitem", {
      name: "warehouse_cn.row.action_unverify_invoice",
    });
    expect(verifyToggle).not.toHaveAttribute("aria-pressed");
    expect(verifyToggle).not.toHaveAttribute("aria-checked");

    await user.click(verifyToggle);
    await waitFor(() => {
      expect(mocks.markReceiptVerifiedAction).toHaveBeenCalledWith(
        "receipt-1",
        false,
      );
    });
  });

  it("abre hacia arriba cuando no hay espacio suficiente debajo", async () => {
    const user = userEvent.setup();
    renderActions();

    const trigger = screen.getByRole("button", {
      name: "warehouse_cn.row.aria_actions",
    });
    vi.spyOn(trigger.parentElement!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 700,
      top: 700,
      right: 200,
      bottom: 732,
      left: 0,
      width: 200,
      height: 32,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });

    await user.click(trigger);
    expect(await screen.findByRole("menu")).toHaveStyle({
      bottom: "calc(100% + 4px)",
    });
  });
});
