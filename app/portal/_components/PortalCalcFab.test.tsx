import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortalCalcFab } from "./PortalCalcFab";

afterEach(cleanup);

describe("PortalCalcFab · intención de apertura", () => {
  it("mantiene Rápida para el evento genérico y abre FCL cuando el CTA lo solicita", () => {
    render(<PortalCalcFab />);

    act(() => window.dispatchEvent(new Event("portal:open-calc")));

    expect(screen.getByRole("dialog", { name: "Calculadora" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Operación" })).toBeInTheDocument();
    expect(screen.queryByTitle("Cotizador FCL")).not.toBeInTheDocument();

    act(() =>
      window.dispatchEvent(
        new CustomEvent("portal:open-calc", { detail: { tab: "fcl" } }),
      ),
    );

    expect(screen.getByTitle("Cotizador FCL")).toHaveAttribute(
      "src",
      "/fcl/embed?theme=light",
    );
  });
});
