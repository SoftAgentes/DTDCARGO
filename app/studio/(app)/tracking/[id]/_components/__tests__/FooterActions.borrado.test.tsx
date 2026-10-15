/**
 * SDD-0522 · Tracking › «Eliminar envío»: sólo para quien puede (admin), con
 * motivo obligatorio además del código tipeado, y la consecuencia real.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deleteShipment: vi.fn(), cancelShipment: vi.fn() }));
vi.mock("../../actions", () => ({
  deleteShipment: (...a: unknown[]) => mocks.deleteShipment(...a),
  cancelShipment: (...a: unknown[]) => mocks.cancelShipment(...a),
}));

const { FooterActions } = await import("../FooterActions");

const SHIPMENT = { shipmentId: "shp-1", shipmentCode: "S-2026-0042" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteShipment.mockResolvedValue({ error: "No se puede eliminar: tiene 1 gasto (Gastos). Primero anula, elimina o desvincula eso en su módulo." });
});
afterEach(cleanup);

describe("FooterActions · eliminar envío", () => {
  it("sin permiso no se pinta el botón", () => {
    render(<FooterActions {...SHIPMENT} status="in_transit" />);
    expect(screen.queryByRole("button", { name: "Eliminar envío" })).toBeNull();
    // Cancelar envío sigue siendo de quien edita Tracking.
    expect(screen.getByRole("button", { name: "Cancelar envío" })).toBeTruthy();
  });

  it("confirmar exige motivo de 4+ y el código exacto; manda los dos", async () => {
    const user = userEvent.setup();
    render(<FooterActions {...SHIPMENT} status="in_transit" canDelete />);
    await user.click(screen.getByRole("button", { name: "Eliminar envío" }));
    const dialogo = screen.getByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar eliminación" });

    expect(dialogo.textContent).toContain("saca de Embarques, Tracking, el Portal del cliente y el calendario");
    expect(dialogo.textContent).toContain("solo se recupera desde la base de datos");
    expect(dialogo.textContent).not.toMatch(/Supabase/);

    await user.type(within(dialogo).getByLabelText(/escribe el código del envío/i), SHIPMENT.shipmentCode);
    expect(confirmar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText(/Motivo/), "abc");
    expect(confirmar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText(/Motivo/), "d");
    expect(confirmar).toBeEnabled();

    await user.click(confirmar);
    expect(mocks.deleteShipment).toHaveBeenCalledWith("shp-1", "abcd");
    // Lo que bloquea queda a la vista, en el modal.
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("tiene 1 gasto (Gastos)");
  });
});
