/**
 * El primer error de un panel real de Nómina recibe el foco, con el panel, `Field`,
 * `ErrorBox` y `useDialogA11y` juntos.
 *
 * El navegador suelta el foco de un botón que se deshabilita. jsdom no, e ignora
 * `blur()` en un control deshabilitado: `soltarFoco` lo habilita sólo para soltarlo.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import { PrestamoDrawer } from "../PrestamoDrawer";

const mocks = vi.hoisted(() => ({ create: vi.fn(), close: vi.fn() }));
vi.mock("../../actions", () => ({ createLoanAction: mocks.create }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

const EMPLEADOS = [{ id: "e1", full_name: "Ana Pérez", employee_code: "E-1" }] as unknown as Employee[];

const soltarFoco = (boton: HTMLButtonElement) => {
  boton.disabled = false;
  boton.blur();
  boton.disabled = true;
};

/** Envía el formulario con la respuesta pendiente, y devuelve cómo resolverla. */
async function enviar(enfocar: (panel: HTMLElement) => HTMLElement) {
  let resolver!: (v: unknown) => void;
  mocks.create.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
  render(<PrestamoDrawer employees={EMPLEADOS} onClose={mocks.close} />);
  const panel = screen.getByRole("dialog", { name: "Nuevo préstamo" });
  const boton = within(panel).getByRole<HTMLButtonElement>("button", { name: "Registrar préstamo" });
  enfocar(panel).focus();
  fireEvent.submit(panel.querySelector("form")!);
  await waitFor(() => expect(boton).toBeDisabled());
  return { panel, boton, responder: (v: unknown) => act(async () => resolver(v)) };
}

beforeEach(() => {
  mocks.create.mockReset();
  mocks.close.mockReset();
});

describe("PrestamoDrawer", () => {
  it("los campos tienen nombre: la etiqueta, no el texto de ejemplo", () => {
    render(<PrestamoDrawer employees={EMPLEADOS} onClose={mocks.close} />);
    expect(screen.getByRole("combobox", { name: /^Empleado/ })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /^Monto del préstamo/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notas" })).toBeInTheDocument();
  });

  it("con errores por campo, tras pulsar el botón el foco va al primer campo con error", async () => {
    const { panel, boton, responder } = await enviar((p) => within(p).getByRole("button", { name: "Registrar préstamo" }));
    soltarFoco(boton);
    await responder({ fieldErrors: { principal_usd: "Debe ser mayor que cero.", concept: "Muy largo." } });
    const monto = within(panel).getByLabelText(/^Monto del préstamo/);
    await waitFor(() => expect(monto).toHaveFocus());
    expect(monto).toHaveAttribute("aria-invalid", "true");
    expect(monto).toHaveAccessibleDescription("Debe ser mayor que cero.");
    expect(within(panel).getByLabelText("Concepto")).toHaveAttribute("aria-invalid", "true");
    expect(within(panel).getByLabelText("Notas")).not.toHaveAttribute("aria-invalid");
  });

  it("con errores por campo, tras enviar con Enter desde otro campo el foco va al primero con error", async () => {
    const { panel, responder } = await enviar((p) => within(p).getByLabelText("Concepto"));
    expect(within(panel).getByLabelText("Concepto")).toHaveFocus();
    await responder({ fieldErrors: { principal_usd: "Debe ser mayor que cero." } });
    await waitFor(() => expect(within(panel).getByLabelText(/^Monto del préstamo/)).toHaveFocus());
  });

  it("con un error general, el foco va al aviso", async () => {
    const { panel, boton, responder } = await enviar((p) => within(p).getByRole("button", { name: "Registrar préstamo" }));
    soltarFoco(boton);
    await responder({ error: "No se pudo registrar el préstamo." });
    await waitFor(() => expect(within(panel).getByRole("alert")).toHaveFocus());
  });
});
