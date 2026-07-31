import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumericInput } from "./NumericInput";

afterEach(() => cleanup());

function renderField(onChange = vi.fn()) {
  const result = render(
    <form aria-label="Prueba numérica">
      <NumericInput
        name="amount"
        aria-label="Monto"
        type="currency"
        onChange={onChange}
      />
    </form>,
  );
  const input = screen.getByRole("textbox", { name: "Monto" });
  const hidden = result.container.querySelector(
    'input[type="hidden"][name="amount"]',
  ) as HTMLInputElement;
  return { ...result, input, hidden, onChange };
}

describe("NumericInput · NUM-01 v1.1", () => {
  it("conserva el último valor válido cuando queda 10+ y marca error al confirmar", () => {
    const { input, hidden, onChange } = renderField();

    fireEvent.change(input, { target: { value: "10" } });
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(hidden).toHaveValue("10");

    fireEvent.change(input, { target: { value: "10+" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hidden).toHaveValue("10");
    expect(input).toHaveAttribute("aria-invalid", "false");

    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Completa la operación.",
    );
    expect(
      screen.getByRole("form", { name: "Prueba numérica" }),
    ).not.toBeValid();
  });

  it("confirma con Enter y reemplaza la expresión por el total canónico", () => {
    const { input, hidden, onChange } = renderField();

    fireEvent.change(input, { target: { value: "10 + 5 + 8 + 9" } });
    expect(onChange).toHaveBeenLastCalledWith(32);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("32");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(hidden).toHaveValue("32");
  });

  it.each([
    ["0.1 + 0.2", "0.3", 0.3],
    ["1,5 + 2,5", "4", 4],
    ["1.200,50 + 2.300,50", "3501", 3501],
  ])(
    "envía decimal canónico para %s",
    (expression, canonical, numericValue) => {
      const { input, hidden, onChange } = renderField();
      fireEvent.change(input, { target: { value: expression } });

      expect(onChange).toHaveBeenLastCalledWith(numericValue);
      expect(hidden).toHaveValue(canonical);
    },
  );

  it("revalida en vivo después del primer error", () => {
    const { input } = renderField();
    fireEvent.change(input, { target: { value: "10+" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "10+5" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
