import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_PARAMS } from "@/lib/calculadora";
import { CalculadoraForm } from "./CalculadoraForm";

afterEach(cleanup);

function row(label: string): HTMLElement {
  const element = screen.getByText(label, { selector: "span" }).closest("div");
  expect(element).not.toBeNull();
  return element!;
}

describe("SDD-0502 · desglose del mínimo con batería", () => {
  it("muestra centavos sólo cuando hacen falta y cada fila suma el total", () => {
    render(
      <CalculadoraForm
        directWhatsApp
        serverRate={{ per_cbm: 850, min_charge: 50, valid_until: null }}
        serverConfig={{ ...DEFAULT_PARAMS, recargoBateriaMult: 1.5 }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("12"), { target: { value: "0.01" } });
    fireEvent.change(screen.getByPlaceholderText("4800"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /lleva baterías/i }));

    expect(within(row("Volumen base")).getByText("$8.50")).toBeInTheDocument();
    expect(within(row("Ajuste a mínimo")).getByText("+$41.50")).toBeInTheDocument();
    expect(within(row("Baterías")).getByText("+$25")).toBeInTheDocument();
    expect(screen.getAllByText("$75")).toHaveLength(2);
  });
});
