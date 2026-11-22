/**
 * SDD-0660 (revisión de #668, I1): en el acta de amonestación la fecha vive en el
 * paso 1 y el campo se desmonta al avanzar. Una fecha a medio escribir o imposible
 * no puede pasar al acta como la última válida (o como «hoy»): «Siguiente» espera.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AmonestacionDrawer } from "../AmonestacionDrawer";

vi.mock("../../actions", () => ({ emitirAmonestacionAction: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

const EMPLEADOS = [{ id: "e1", full_name: "Ana Pérez", employee_code: "E-1" }] as never;

function montar() {
  render(<AmonestacionDrawer employees={EMPLEADOS} onClose={() => {}} />);
  return {
    fecha: screen.getByLabelText(/Fecha de emisión/) as HTMLInputElement,
    siguiente: screen.getByRole("button", { name: "Siguiente" }),
    user: userEvent.setup(),
  };
}

describe("AmonestacionDrawer · fecha de emisión", () => {
  it("con la fecha de hoy se puede avanzar", () => {
    const { siguiente } = montar();
    expect(siguiente).toBeEnabled();
  });

  it("a medio escribir no deja avanzar", async () => {
    const { fecha, siguiente, user } = montar();
    await user.type(fecha, "{Backspace}");
    expect(siguiente).toBeDisabled();
  });

  it("una fecha imposible no deja avanzar", async () => {
    const { fecha, siguiente, user } = montar();
    await user.clear(fecha);
    await user.type(fecha, "31022026");
    expect(siguiente).toBeDisabled();
  });

  it("vacía no deja avanzar; corregida, sí", async () => {
    const { fecha, siguiente, user } = montar();
    await user.clear(fecha);
    expect(siguiente).toBeDisabled();
    await user.type(fecha, "15032026");
    expect(siguiente).toBeEnabled();
  });
});
