import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
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
    ["1200,50 + 2300,50", "3501", 3501],
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

describe("NumericInput · CBM (type=volume) hasta 4 decimales", () => {
  function renderVolume() {
    const result = render(
      <form aria-label="CBM">
        <NumericInput name="cbm" aria-label="CBM" type="volume" />
      </form>,
    );
    const input = screen.getByRole("textbox", { name: "CBM" });
    const hidden = result.container.querySelector(
      'input[type="hidden"][name="cbm"]',
    ) as HTMLInputElement;
    return { input, hidden, container: result.container };
  }

  it.each([
    ["0.0012", "= 0,0012 m³"],
    ["1.5", "= 1,5 m³"],
    ["2", "= 2 m³"],
    ["0.12", "= 0,12 m³"],
  ])("«%s» se guarda tal cual y la vista no rellena con ceros", (texto, vista) => {
    const { input, hidden, container } = renderVolume();
    fireEvent.change(input, { target: { value: texto } });
    expect(hidden.value).toBe(texto);
    expect(container.textContent).toContain(vista);
  });
});

describe("NumericInput · SDD-0687 opción A, entrada sin miles y salida 1.234,50", () => {
  // Las combinaciones de prueba se arman a mano; el tipo estricto lo cubre el
  // último caso (`type="decimal"` sin modo no compila).
  const Campo = NumericInput as unknown as ComponentType<Record<string, unknown>>;

  function renderCon(props: Record<string, unknown>) {
    const onChange = vi.fn();
    const result = render(
      <form aria-label="Cifras">
        <Campo name="campo" aria-label="Campo" onChange={onChange} {...props} />
      </form>,
    );
    const input = screen.getByRole("textbox", { name: "Campo" });
    const hidden = result.container.querySelector(
      'input[type="hidden"][name="campo"]',
    ) as HTMLInputElement;
    const preview = result.container.querySelector(`#${input.id}-preview`) as HTMLElement;
    return { ...result, input, hidden, preview, onChange };
  }

  it("dinero: el eco muestra «= 1.234,50»", () => {
    const { input, hidden, preview } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "1234,50" } });
    expect(preview).toHaveTextContent("= 1.234,50");
    expect(hidden).toHaveValue("1234.5");
  });

  it("dinero: «12.50» se acepta y el eco dice «= 12,50» (decisión 6 A)", () => {
    const { input, hidden, preview } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "12.50" } });
    expect(preview).toHaveTextContent("= 12,50");
    expect(hidden).toHaveValue("12.5");
  });

  it("dinero: «1.234» excede la precisión y no deja vivo el 1,23 tecleado antes", () => {
    const { input, hidden, onChange, container } = renderCon({ type: "currency" });
    for (const paso of ["1", "1.", "1.2", "1.23", "1.234"]) {
      fireEvent.change(input, { target: { value: paso } });
    }
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(hidden).toHaveValue("");
    expect(input).toHaveAttribute("data-numeric-status", "invalid");

    fireEvent.blur(input);
    expect(input).toHaveValue("1.234");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("máximo 2 decimales");
    expect(screen.getByRole("form", { name: "Cifras" })).not.toBeValid();
    expect(container.textContent).not.toContain("= 1,23");
  });

  it.each(["1,234", "10,000", "10.000", "1,234.50"])("dinero: «%s» no emite ningún monto", (texto) => {
    const { input, hidden, onChange } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: texto } });
    expect(onChange).not.toHaveBeenCalledWith(expect.any(Number));
    expect(hidden).toHaveValue("");
  });

  it("dinero: al corregir con «1234,00» vuelve a emitir 1234", () => {
    const { input, hidden, onChange } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "1.234" } });
    fireEvent.change(input, { target: { value: "1234,00" } });
    expect(onChange).toHaveBeenLastCalledWith(1234);
    expect(hidden).toHaveValue("1234");
  });

  it("peso: «1.234» es 1,234 kg y el eco no esconde el tercer decimal (decisión 2 A)", () => {
    const { input, hidden, preview } = renderCon({ type: "weight" });
    fireEvent.change(input, { target: { value: "1.234" } });
    expect(hidden).toHaveValue("1.234");
    expect(preview).toHaveTextContent("= 1,234 kg");
  });

  it("peso: 236 se ve «= 236,00 kg» con la precisión del campo", () => {
    const { input, preview } = renderCon({ type: "weight" });
    fireEvent.change(input, { target: { value: "236" } });
    expect(preview).toHaveTextContent("= 236,00 kg");
  });

  it("tasa: «36,500» es 36,5 y se ve con 2 a 4 decimales (decisión 5 B)", () => {
    const { input, hidden, preview } = renderCon({ type: "decimal", modo: "tasa" });
    fireEvent.change(input, { target: { value: "36,500" } });
    expect(hidden).toHaveValue("36.5");
    expect(preview).toHaveTextContent("= 36,50");

    fireEvent.change(input, { target: { value: "36,51259999" } });
    expect(hidden).toHaveValue("36.51259999");
    expect(preview).toHaveTextContent("= 36,51259999");
  });

  it("tasa: «36.500» es decimal y conserva el valor al confirmar", () => {
    const { input, hidden, preview } = renderCon({ type: "decimal", modo: "tasa" });
    fireEvent.change(input, { target: { value: "36.500" } });
    expect(hidden).toHaveValue("36.5");
    expect(preview).toHaveTextContent("= 36,50");
    fireEvent.blur(input);
    expect(input).toHaveValue("36,5");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("tasa: un valor guardado con tres decimales se abre con coma y sigue válido", () => {
    const { input, hidden } = renderCon({ type: "decimal", modo: "tasa", defaultValue: 36.512 });
    expect(input).toHaveValue("36,512");
    expect(input).toHaveAttribute("data-numeric-status", "valid");
    expect(hidden).toHaveValue("36.512");
    fireEvent.blur(input);
    expect(input).toHaveValue("36,512");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("al confirmar deja el decimal con coma, que se vuelve a leer igual", () => {
    const { input, hidden } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "1200,50 + 0,50" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("1201");
    fireEvent.change(input, { target: { value: "1234,5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("1234,5");
    expect(hidden).toHaveValue("1234.5");
  });

  it("CBM con 3 decimales: el cuarto se rechaza", () => {
    const { input, hidden } = renderCon({ type: "volume", decimales: 3 });
    fireEvent.change(input, { target: { value: "0,1234" } });
    expect(hidden).toHaveValue("");
    fireEvent.change(input, { target: { value: "0,123" } });
    expect(hidden).toHaveValue("0.123");
  });

  it("precio por ft³ (dinero con 4 decimales): se abre con defaultValue 3.498 y sigue válido (revisión #790 B1)", () => {
    const { input, hidden } = renderCon({ type: "currency", precision: 2, decimales: 4, defaultValue: 3.498 });
    expect(input).toHaveValue("3,498");
    expect(input).toHaveAttribute("data-numeric-status", "valid");
    expect(hidden).toHaveValue("3.498");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "false");
    fireEvent.change(input, { target: { value: "3,4985" } });
    expect(hidden).toHaveValue("3.4985");
  });

  it("precio por ft³: punto y coma son decimales, sin ocultar precisión", () => {
    const { input, hidden } = renderCon({ type: "currency", precision: 2, decimales: 4 });
    fireEvent.change(input, { target: { value: "3,498" } });
    expect(hidden).toHaveValue("3.498");
    fireEvent.change(input, { target: { value: "3.498" } });
    expect(hidden).toHaveValue("3.498");
    expect(input).toHaveAttribute("data-numeric-status", "valid");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("el eco no es una región viva mientras se escribe (ERR-01)", () => {
    const { input, preview } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "1234,50" } });
    expect(preview).not.toHaveAttribute("aria-live");
    expect(preview).not.toHaveAttribute("role");
    expect(input.getAttribute("aria-describedby")).toContain(preview.id);
  });


  it.each([
    [{ type: "volume" }, "0.366", "0.366", "= 0,366 m³"],
    [{ type: "volume" }, "1250", "1250", "= 1.250 m³"],
    [{ type: "currency" }, "1234.50", "1234.5", "= 1.234,50"],
    [{ type: "currency", currency: "EUR" }, "1234,50", "1234.5", "= 1.234,50"],
    [{ type: "currency", currency: "VES" }, "1234,50", "1234.5", "= 1.234,50"],
    [{ type: "decimal", modo: "porcentaje", unit: "%" }, "12.5", "12.5", "= 12,50 %"],
    [{ type: "currency", decimales: 4 }, "3.498", "3.498", "= 3,498"],
    [{ type: "weight" }, "-0.366", "-0.366", "= -0,366 kg"],
  ])("vista inmediata %s, %s", (props, texto, canonico, vista) => {
    const { input, hidden, preview } = renderCon(props);
    fireEvent.change(input, { target: { value: texto } });
    expect(hidden).toHaveValue(canonico);
    expect(preview).toHaveTextContent(vista);
    expect(input).toHaveValue(texto);
  });

  it.each(["1.234,50", "1,234.50", "1.234.567", "1,234,567"])("agrupación %s invalida el monto anterior y permite corregir", (texto) => {
    const { input, hidden, preview, onChange } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "1250" } });
    fireEvent.change(input, { target: { value: texto } });
    expect(hidden).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(preview).not.toHaveAttribute("role");
    fireEvent.blur(input);
    expect(input).toHaveValue(texto);
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el número sin puntos de miles");
    expect(input).not.toBeValid();
    fireEvent.change(input, { target: { value: "1234,50" } });
    expect(hidden).toHaveValue("1234.5");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["12.", "12,", "12+"])("parcial %s conserva el último valor y bloquea confirmar", (texto) => {
    const { input, hidden, onChange } = renderCon({ type: "currency" });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.change(input, { target: { value: texto } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hidden).toHaveValue("12");
    expect(input).toHaveAttribute("aria-invalid", "false");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).not.toBeValid();
  });

  it("cero, vacío y rango conservan su validación", () => {
    const { input, hidden, onChange } = renderCon({ type: "currency", min: 0, max: 100 });
    fireEvent.change(input, { target: { value: "0" } });
    expect(hidden).toHaveValue("0");
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.change(input, { target: { value: "" } });
    expect(hidden).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: "100" } });
    fireEvent.change(input, { target: { value: "100.01" } });
    expect(hidden).toHaveValue("100");
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.blur(input);
    expect(input).not.toBeValid();
    expect(screen.getByRole("alert")).toHaveTextContent("Máximo 100,00");
    fireEvent.change(input, { target: { value: "-1" } });
    expect(input).not.toBeValid();
    expect(screen.getByRole("alert")).toHaveTextContent("Mínimo 0,00");
  });

  it("type=decimal exige el modo (no hay modo por defecto)", () => {
    // @ts-expect-error falta `modo`: un decimal puede ser tasa, porcentaje o monto.
    const elemento = <NumericInput type="decimal" aria-label="Sin modo" />;
    expect(elemento).toBeTruthy();
  });
});
