/**
 * SDD-0515 · PinViewDialog: «Ver PIN» con motivo.
 *
 * Lo que se afirma:
 *  - sin motivo no se pide el PIN; con motivo se llama a la action con el id y
 *    el motivo;
 *  - el PIN se muestra con «Copiar PIN» y sale del DOM al cerrar (Cerrar o
 *    Escape), sin escribirse en el navegador;
 *  - un PIN anterior a 0475 muestra el aviso de restablecerlo;
 *  - un rechazo se queda en el diálogo y no muestra PIN.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { ViewPinResult } from "@/lib/studio/operario-pin";

const viewMock = vi.fn<(id: string, motivo: string) => Promise<ViewPinResult>>();

vi.mock("../actions", () => ({
  viewOperarioPinAction: (id: string, motivo: string) => viewMock(id, motivo),
}));

import { PinViewDialog } from "./PinViewDialog";

const OPERARIO: OperarioRow = {
  id: "50000000-0000-4000-8000-000000000001",
  tenant_id: "10000000-0000-4000-8000-000000000001",
  warehouse_id: null,
  region: "ve",
  display_name: "Yusneidy Pérez",
  display_name_cn: null,
  role: "operario",
  active: true,
  last_login_at: null,
  created_at: "2026-05-26T00:00:00Z",
  warehouse_code: null,
  warehouse_name_es: null,
};

const MOTIVO = "No recuerda su PIN y está en el turno";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      {open && <PinViewDialog operario={OPERARIO} onClose={() => setOpen(false)} />}
    </>
  );
}

let setItem: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  viewMock.mockReset();
  viewMock.mockResolvedValue({ ok: true, pin: "6083" });
  setItem = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function verConMotivo(user: ReturnType<typeof userEvent.setup>, motivo = MOTIVO) {
  if (motivo) await user.type(screen.getByRole("textbox", { name: "Motivo" }), motivo);
  await user.click(screen.getByRole("button", { name: "Ver PIN" }));
}

describe("PinViewDialog", () => {
  it("avisa que queda en la auditoría y, sin motivo, no pide el PIN", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("dialog", { name: `Ver PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    expect(screen.getByText(/Cada consulta queda en la auditoría con tu nombre y el motivo/)).toBeInTheDocument();
    await verConMotivo(user, "");
    expect(viewMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });

  it("con motivo muestra el PIN, lo copia y al cerrar lo borra", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness />);
    await verConMotivo(user);

    expect(await screen.findByText("6083")).toBeInTheDocument();
    expect(viewMock).toHaveBeenCalledWith(OPERARIO.id, MOTIVO);
    expect(screen.getByRole("dialog", { name: `PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar PIN" }));
    expect(writeText).toHaveBeenCalledWith("6083");

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("6083");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain("6083");

    // Al reabrir arranca de cero: vuelve a pedir el motivo.
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("textbox", { name: "Motivo" })).toHaveValue("");
    expect(document.body.textContent).not.toContain("6083");
    expect(viewMock).toHaveBeenCalledTimes(1);
  });

  it("Escape también cierra y borra el PIN", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await verConMotivo(user);
    await screen.findByText("6083");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.textContent).not.toContain("6083");
  });

  it("un PIN anterior al cambio pide restablecerlo", async () => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ ok: true, pin: null });
    render(<Harness />);
    await verConMotivo(user);

    expect(
      await screen.findByText("Este PIN es anterior al cambio: restablécelo una vez para poder verlo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar PIN" })).not.toBeInTheDocument();
  });

  it("si el servidor rechaza, el error queda en el diálogo y no hay PIN", async () => {
    const user = userEvent.setup();
    viewMock.mockResolvedValue({ error: "No tienes permiso para realizar esta acción." });
    render(<Harness />);
    await verConMotivo(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    expect(screen.getByRole("dialog", { name: `Ver PIN de ${OPERARIO.display_name}` })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b\d{4}\b/);
  });
});
