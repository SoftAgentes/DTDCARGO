/**
 * SDD-0469 · El borrado de un cliente se confirma con un ConfirmDialog R2 que
 * nombra al cliente y su consecuencia (MP-01), con motivo opcional. Un borrado
 * que no alcanzó ninguna fila, o que falló, se muestra dentro del diálogo sin
 * cerrar el drawer y se puede reintentar.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@/lib/studio/client-types";

const mocks = vi.hoisted(() => ({
  softDeleteClientAction: vi.fn(),
  toastShow: vi.fn(),
  toastError: vi.fn(),
  onClose: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
  geocodeClientAddressAction: vi.fn(),
  softDeleteClientAction: mocks.softDeleteClientAction,
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({
    show: mocks.toastShow,
    success: vi.fn(),
    error: mocks.toastError,
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import {
  ClientDrawer,
  DELETE_CLIENT_CONFIRM_LABEL,
  DELETE_CLIENT_REASON_LABEL,
  DELETE_CLIENT_TITLE,
  DELETE_CLIENT_UNCONFIRMED,
  deleteClientConfirmMessage,
} from "./ClientDrawer";

// Nombre con signos y acentos, y Shipping Mark distinto del id: si el diálogo
// confundiera id y Shipping Mark, o escapara mal el nombre, se ve.
const CLIENT: Client = {
  id: "40000000-0000-4000-8000-000000000481",
  tenant_id: "30000000-0000-4000-8000-000000000001",
  markbox: "DTD-4821",
  name: "Inversiones «Ñandú» & Hijos, C.A.",
  email: null,
  phone: null,
  address: null,
  rif: null,
  contact_name: null,
  tier: "regular",
  notes: null,
  lat: null,
  lng: null,
  registration_channel: "admin",
  doc_kind: "empresa",
  doc_verify_status: null,
  doc_verify_source: null,
  doc_registry_name: null,
  doc_verified_at: null,
  cedula_photo_path: null,
  advisor_id: null,
  aliado_id: null,
  person_id: null,
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
  deleted_at: null,
};

const NOT_FOUND =
  "No se eliminó ningún cliente: ya estaba eliminado, no existe o no tienes acceso a él. Recarga la lista.";
const VOSEO = /\b(perdés|tenés|podés|querés|borrá|confirmá|eliminá|escribí|recargá|intentá|vos)\b/i;

function renderDrawer() {
  return render(<ClientDrawer mode="edit" client={CLIENT} onClose={mocks.onClose} />);
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  return screen.getByRole("dialog", { name: DELETE_CLIENT_TITLE });
}

describe("ClientDrawer · confirmación R2 del borrado (SDD-0469)", () => {
  beforeEach(() => {
    mocks.softDeleteClientAction.mockReset();
    mocks.toastShow.mockReset();
    mocks.toastError.mockReset();
    mocks.onClose.mockReset();
  });
  afterEach(() => cleanup());

  it("pedir eliminar abre un diálogo que nombra al cliente, su Shipping Mark y la consecuencia, sin borrar nada", async () => {
    renderDrawer();

    const dialog = await openDialog();
    const text = dialog.textContent ?? "";

    expect(text).toContain("Inversiones «Ñandú» & Hijos, C.A.");
    expect(text).toContain("Shipping Mark DTD-4821");
    expect(text).toContain("Sale de las listas del Studio");
    expect(text).toContain("pierde su acceso al Portal");
    expect(text).not.toContain(CLIENT.id);
    expect(mocks.softDeleteClientAction).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it("no promete una restauración que el Studio no tiene, y usa tuteo sin voseo", async () => {
    const message = deleteClientConfirmMessage(CLIENT);

    expect(message).toMatch(/Desde el Studio no se puede restaurar\.$/);
    expect(message).not.toMatch(/podrás restaurar|puedes restaurar|deshacer|recuperar/i);
    for (const copy of [message, DELETE_CLIENT_TITLE, DELETE_CLIENT_CONFIRM_LABEL, DELETE_CLIENT_REASON_LABEL, DELETE_CLIENT_UNCONFIRMED]) {
      expect(copy).not.toMatch(VOSEO);
    }
  });

  it("es destructivo: foco inicial en Cancelar, confirmación roja con verbo y objeto, motivo opcional", async () => {
    renderDrawer();

    const dialog = await openDialog();
    const confirm = within(dialog).getByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL });
    const reason = within(dialog).getByLabelText(DELETE_CLIENT_REASON_LABEL);

    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" })));
    expect(confirm.className).toContain("studio-btn-danger");
    expect(reason.hasAttribute("required")).toBe(false);
  });

  it("cancelar cierra el diálogo sin borrar ni cerrar el drawer", async () => {
    renderDrawer();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: DELETE_CLIENT_TITLE })).toBeNull();
    expect(mocks.softDeleteClientAction).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it("confirmar con motivo borra por id con ese motivo, avisa el resultado y cierra", async () => {
    mocks.softDeleteClientAction.mockResolvedValue({ ok: true });
    renderDrawer();

    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(DELETE_CLIENT_REASON_LABEL), "Ficha duplicada");
    await userEvent.click(within(dialog).getByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL }));

    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.softDeleteClientAction).toHaveBeenCalledWith(CLIENT.id, "Ficha duplicada");
    expect(mocks.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "success", message: "Cliente DTD-4821 eliminado. Ya no aparece en las listas." }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("confirmar sin motivo manda el motivo vacío", async () => {
    mocks.softDeleteClientAction.mockResolvedValue({ ok: true });
    renderDrawer();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL }));

    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.softDeleteClientAction).toHaveBeenCalledWith(CLIENT.id, "");
  });

  it("si no se borró ninguna fila, el error queda en el diálogo, no cierra y el reintento con el mismo error sigue vivo", async () => {
    mocks.softDeleteClientAction
      .mockResolvedValueOnce({ error: NOT_FOUND })
      .mockResolvedValueOnce({ error: NOT_FOUND })
      .mockResolvedValueOnce({ ok: true });
    renderDrawer();

    const dialog = await openDialog();
    // SDD-0486: el error y el fin de la transición llegan en commits distintos de
    // React. Entre uno y otro la alerta ya está, pero el botón sigue en
    // «Procesando…» y deshabilitado. Con `getByRole`, el reintento dependía de
    // qué corría primero, si el Scheduler (setImmediate) o el setTimeout(0) con
    // que RTL cierra cada findBy, y bajo carga fallaba. Se espera el botón.
    const confirm = () => within(dialog).findByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL });

    await userEvent.click(await confirm());
    expect((await within(dialog).findByRole("alert")).textContent).toBe(NOT_FOUND);
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toastShow).not.toHaveBeenCalled();

    await userEvent.click(await confirm());
    await waitFor(() => expect(mocks.softDeleteClientAction).toHaveBeenCalledTimes(2));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(NOT_FOUND);
    expect(mocks.onClose).not.toHaveBeenCalled();

    await userEvent.click(await confirm());
    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.softDeleteClientAction).toHaveBeenCalledTimes(3);
  });

  it("si la acción lanza, dice que no se pudo confirmar y no cierra ni avisa éxito", async () => {
    mocks.softDeleteClientAction.mockRejectedValue(new Error("red caída"));
    renderDrawer();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(DELETE_CLIENT_UNCONFIRMED);
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toastShow).not.toHaveBeenCalled();
  });

  it("mientras borra bloquea la doble ejecución y la cancelación", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    mocks.softDeleteClientAction.mockImplementation(
      () => new Promise<{ ok: true }>((r) => { resolve = r; }),
    );
    renderDrawer();

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: DELETE_CLIENT_CONFIRM_LABEL }));

    const busy = await within(dialog).findByRole("button", { name: "Procesando…" });
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(busy);
    expect(mocks.softDeleteClientAction).toHaveBeenCalledTimes(1);
    expect(mocks.onClose).not.toHaveBeenCalled();

    resolve({ ok: true });
    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
  });
});
