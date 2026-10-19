/**
 * SDD-0522 · Tracking › «Eliminar envío»: sólo para quien puede (admin), con
 * motivo obligatorio además del código tipeado, y la consecuencia real.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteShipment: vi.fn(),
  cancelShipment: vi.fn(),
  leerPlan: vi.fn(),
  ejecutarPaso: vi.fn(),
  show: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../../actions", () => ({
  deleteShipment: (...a: unknown[]) => mocks.deleteShipment(...a),
  cancelShipment: (...a: unknown[]) => mocks.cancelShipment(...a),
}));
// SDD-0560: el asistente que se ofrece cuando lo bloquean dependencias.
vi.mock("@/app/studio/(app)/embarques/actions", () => ({
  leerPlanDeBorradoAction: (...a: unknown[]) => mocks.leerPlan(...a),
  ejecutarPasoDeBorradoAction: (...a: unknown[]) => mocks.ejecutarPaso(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.show, success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));

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
    // Sin la marca `bloqueado` no se ofrece el asistente.
    expect(within(dialogo).queryByRole("button", { name: "Ver los pasos para eliminarlo" })).toBeNull();
  });
});

describe("FooterActions · asistente de borrado (SDD-0560)", () => {
  async function bloquear() {
    const user = userEvent.setup();
    mocks.deleteShipment.mockResolvedValue({
      error: "No se puede eliminar: tiene 1 gasto (Gastos). Primero anula, elimina o desvincula eso en su módulo.",
      bloqueado: true,
    });
    render(<FooterActions {...SHIPMENT} status="in_transit" canDelete />);
    await user.click(screen.getByRole("button", { name: "Eliminar envío" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/escribe el código del envío/i), SHIPMENT.shipmentCode);
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar eliminación" }));
    return { user, dialogo };
  }

  it("si lo bloquean dependencias, el modal ofrece ver los pasos y abre el asistente", async () => {
    mocks.leerPlan.mockResolvedValue({ ok: false, error: "No se pudo revisar." });
    const { user, dialogo } = await bloquear();
    await user.click(await within(dialogo).findByRole("button", { name: "Ver los pasos para eliminarlo" }));
    expect(await screen.findByRole("heading", { name: "Eliminar S-2026-0042 paso a paso" })).toBeTruthy();
    expect(mocks.leerPlan).toHaveBeenCalledWith("shp-1");
    // El modal de borrado directo se cerró: queda sólo el asistente.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("al eliminar desde el asistente: un aviso y de vuelta al listado", async () => {
    const { calcularPlan } = await import("@/lib/studio/borrado/asistente");
    mocks.leerPlan.mockResolvedValue({
      ok: true,
      plan: calcularPlan({
        embarque: { id: "shp-1", codigo: "S-2026-0042" },
        info: { bloqueos: {}, avisos: {} },
        facturas: [],
        gastos: [],
        cxp: [],
        rutas: [],
        consolidaciones: [],
        recepciones: [],
        compras: [],
      }),
    });
    const hecho = "Embarque S-2026-0042 eliminado. Ya no aparece en Embarques, Tracking ni el Portal.";
    mocks.ejecutarPaso.mockResolvedValue({ ok: true, hecho, eliminado: true, plan: null });
    const { user, dialogo } = await bloquear();
    await user.click(await within(dialogo).findByRole("button", { name: "Ver los pasos para eliminarlo" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar embarque…" }));
    const confirmacion = screen.getAllByRole("dialog")[1];
    await user.type(within(confirmacion).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(confirmacion).getByRole("button", { name: "Eliminar embarque" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/studio/tracking"));
    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(mocks.show.mock.calls[0][0]).toMatchObject({ eventKey: "shipments:deleted", message: hecho });
  });
});
