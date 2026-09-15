/**
 * SDD-0467 · La confirmación del borrado avisa que el cliente pierde su acceso
 * al Portal, y un borrado fallido se muestra sin cerrar el drawer.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@/lib/studio/client-types";

const mocks = vi.hoisted(() => ({
  softDeleteClientAction: vi.fn(),
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
  useToast: () => ({ success: vi.fn(), error: mocks.toastError, info: vi.fn(), warning: vi.fn() }),
}));

import { ClientDrawer, DELETE_CLIENT_CONFIRM } from "./ClientDrawer";

const CLIENT: Client = {
  id: "40000000-0000-4000-8000-000000000001",
  tenant_id: "30000000-0000-4000-8000-000000000001",
  markbox: "DTD-1234",
  name: "Cliente Sintético",
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
  doc_kind: "persona",
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

function renderDrawer() {
  return render(<ClientDrawer mode="edit" client={CLIENT} onClose={mocks.onClose} />);
}

describe("ClientDrawer · confirmación del borrado (SDD-0467)", () => {
  beforeEach(() => {
    mocks.softDeleteClientAction.mockReset();
    mocks.toastError.mockReset();
    mocks.onClose.mockReset();
  });
  afterEach(() => cleanup());

  it("el texto avisa la pérdida del acceso al Portal, con tuteo y sin voseo", () => {
    expect(DELETE_CLIENT_CONFIRM).toMatch(/pierde su acceso al Portal/);
    expect(DELETE_CLIENT_CONFIRM).not.toMatch(/\b(perdés|tenés|podés|querés|borrá|confirmá)\b/i);
  });

  it("pedir eliminar muestra la advertencia antes de borrar nada", async () => {
    renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(screen.getByText(DELETE_CLIENT_CONFIRM)).toBeTruthy();
    expect(mocks.softDeleteClientAction).not.toHaveBeenCalled();
  });

  it("confirmar llama al borrado y cierra el drawer cuando sale bien", async () => {
    mocks.softDeleteClientAction.mockResolvedValue({ ok: true });
    renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.softDeleteClientAction).toHaveBeenCalledWith("DTD-1234");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("si el borrado falla, muestra el error y no cierra", async () => {
    const error =
      "No se pudo confirmar el borrado. Recarga la lista: si el cliente sigue ahí, conserva su acceso al Portal y puedes intentarlo de nuevo.";
    mocks.softDeleteClientAction.mockResolvedValue({ error });
    renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(error));
    expect(mocks.onClose).not.toHaveBeenCalled();
  });
});
