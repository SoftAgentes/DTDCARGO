/**
 * `Field` de Nómina: asocia su etiqueta al control y, con error, lo marca y lo liga
 * al mensaje. De eso depende que `useDialogA11y` le lleve el foco al primer campo con
 * error y que un lector de pantalla diga cuál es y qué le pasa.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBox, Field } from "../form-bits";

describe("Field", () => {
  it.each([
    ["input", <input key="c" />, "textbox"],
    ["select", <select key="c" />, "combobox"],
    ["textarea", <textarea key="c" />, "textbox"],
  ])("asocia la etiqueta a un %s", (_tag, control, rol) => {
    render(
      <Field label="Monto" required>
        {control}
      </Field>,
    );
    expect(screen.getByRole(rol, { name: /^Monto/ })).toBeInTheDocument();
  });

  it("sin error no marca el control", () => {
    render(
      <Field label="Monto">
        <input />
      </Field>,
    );
    const campo = screen.getByLabelText("Monto");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(campo).not.toHaveAttribute("aria-describedby");
  });

  it("con error marca el control y lo liga al mensaje", () => {
    render(
      <Field label="Monto" error="Debe ser mayor que cero.">
        <input />
      </Field>,
    );
    const campo = screen.getByLabelText("Monto");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("Debe ser mayor que cero.");
  });

  it("respeta el id del control y su descripción previa", () => {
    render(
      <>
        <p id="ayuda">En dólares.</p>
        <Field label="Monto" error="Debe ser mayor que cero.">
          <input id="monto" aria-describedby="ayuda" />
        </Field>
      </>,
    );
    const campo = screen.getByLabelText("Monto");
    expect(campo).toHaveAttribute("id", "monto");
    expect(campo).toHaveAccessibleDescription("En dólares. Debe ser mayor que cero.");
  });

  it("no toca un grupo de controles, que conserva sus propias etiquetas", () => {
    render(
      <Field label="Causa" error="Escoge una.">
        <div data-testid="grupo">
          <label>
            <input type="radio" name="causa" /> Renuncia
          </label>
        </div>
      </Field>,
    );
    const grupo = screen.getByTestId("grupo");
    expect(grupo).not.toHaveAttribute("id");
    expect(grupo).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Causa")).not.toHaveAttribute("for");
    expect(screen.getByText("Escoge una.")).toBeVisible();
  });
});

describe("ErrorBox", () => {
  it("puede recibir el foco sin entrar en el orden de Tab", () => {
    render(<ErrorBox>No se pudo registrar.</ErrorBox>);
    expect(screen.getByRole("alert")).toHaveAttribute("tabindex", "-1");
  });
});
