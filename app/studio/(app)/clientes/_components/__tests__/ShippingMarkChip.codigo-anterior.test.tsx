/**
 * SDD-0664 · La ficha muestra los Shipping Marks anteriores sin abrir el panel.
 * Códigos inventados.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../actions", () => ({ renombrarMarkboxAction: vi.fn() }));

const { ShippingMarkChip } = await import("../ShippingMarkChip");

const entrada = (markbox: string, dia: string) => ({
  id: `h-${markbox}`,
  markbox,
  reason: null,
  retiredAt: `2026-08-${dia}T00:00:00Z`,
});

afterEach(cleanup);

describe("ShippingMarkChip · código anterior a la vista", () => {
  it("con un código anterior, se lee junto al vigente sin abrir nada", () => {
    render(
      <ShippingMarkChip
        clientId="c1"
        markbox="DTD-8901"
        historial={[entrada("DTD-Z901", "14")]}
        canEdit={false}
      />,
    );
    expect(screen.getByTestId("codigo-anterior")).toHaveTextContent("antes DTD-Z901");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Uno solo: no hace falta el contador.
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it("con tres, muestra los dos más recientes y cuenta el resto", () => {
    render(
      <ShippingMarkChip
        clientId="c1"
        markbox="DTD-8901"
        historial={[entrada("DTD-9050", "20"), entrada("DTD-Z901", "14"), entrada("DTD-Z900", "01")]}
        canEdit={false}
      />,
    );
    expect(screen.getByTestId("codigo-anterior")).toHaveTextContent("antes DTD-9050 · DTD-Z901");
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("sin historial no muestra nada de eso", () => {
    render(<ShippingMarkChip clientId="c1" markbox="DTD-9001" historial={[]} canEdit={false} />);
    expect(screen.queryByTestId("codigo-anterior")).toBeNull();
    expect(screen.getByRole("button")).toHaveTextContent("DTD-9001");
  });
});
