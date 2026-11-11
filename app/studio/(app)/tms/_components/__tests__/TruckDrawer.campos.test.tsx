/**
 * Los campos compartidos de flota marcan su error y lo ligan al mensaje. De eso depende
 * que `useDialogA11y` lleve el foco al primer campo con error.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldSelect, FieldText } from "../TruckDrawer";

vi.mock("../../actions", () => ({ createTruckAction: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

const MSG = "Esa patente ya existe.";

describe("campos de flota", () => {
  it.each([
    ["texto", { type: "text" }],
    ["área de texto", { rows: 2 }],
    ["número", { type: "number" }],
  ])("FieldText de %s con error se marca y se liga al mensaje", (_nombre, props) => {
    render(<FieldText label="Patente" name="plate" value="" onChange={() => {}} error={MSG} {...props} />);
    const campo = screen.getByLabelText("Patente");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.getAttribute("aria-describedby")).toContain("tms-plate-error");
    expect(document.getElementById("tms-plate-error")).toHaveTextContent(MSG);
  });

  it("FieldSelect con error se marca y se liga al mensaje", () => {
    render(<FieldSelect label="Tipo" name="kind" value="" onChange={() => {}} options={[{ value: "", label: "—" }]} error={MSG} />);
    const campo = screen.getByLabelText("Tipo");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(MSG);
  });

  it("sin error no marca nada", () => {
    render(<FieldText label="Patente" name="plate" value="" onChange={() => {}} />);
    const campo = screen.getByLabelText("Patente");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(campo).not.toHaveAttribute("aria-describedby");
  });
});
