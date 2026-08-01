import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  createWithholdingAction: vi.fn(async () => ({})),
}));

import { WithholdingDrawer } from "./WithholdingDrawer";

afterEach(cleanup);

describe("WithholdingDrawer · slice R3 NUM-01", () => {
  it("acepta una suma decimal localizada en la base y envía el total canónico", () => {
    const { container } = render(
      <WithholdingDrawer
        period="2026-07"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const base = screen.getByRole("textbox", {
      name: "Base de IVA de la compra",
    });
    fireEvent.change(base, {
      target: { value: "1.200,50 + 2.300,50" },
    });

    expect(
      container.querySelector('input[type="hidden"][name="base"]'),
    ).toHaveValue("3501");
    expect(
      container.querySelector('input[type="hidden"][name="amount"]'),
    ).toHaveValue("2625.75");
    expect(screen.getByText("2,625.75")).toBeInTheDocument();
  });

  it("no reemplaza el total anterior si el porcentaje termina en +", () => {
    const { container } = render(
      <WithholdingDrawer
        period="2026-07"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const pct = screen.getByRole("textbox", {
      name: "Porcentaje de retención",
    });

    fireEvent.change(pct, { target: { value: "75+" } });
    expect(
      container.querySelector('input[type="hidden"][name="pct"]'),
    ).toHaveValue("75");

    fireEvent.blur(pct);
    expect(pct).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Completa la operación.")).toHaveAttribute(
      "role",
      "alert",
    );
  });
});
